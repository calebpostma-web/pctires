/**
 * Cloudflare Pages Function: /functions/stripe-webhook.js
 *
 * DURABLE order-placement path. Stripe's servers POST here on
 * `payment_intent.succeeded` — this fires even if the customer's browser is gone
 * (essential for Affirm, which redirects the customer off-site to pay).
 *
 * Flow:
 *   1. Verify the Stripe signature (STRIPE_WEBHOOK_SECRET) over the RAW body.
 *   2. On payment_intent.succeeded for one of OUR PaymentIntents
 *      (metadata.source === 'pctires-web'), read the stashed order from KV
 *      (order:<piId>, written by create-pi.js) and run order-core.processOrder():
 *      place the TDG order + send emails, with durable dedup.
 *
 * Register the endpoint in Stripe Dashboard → Developers → Webhooks:
 *   URL:    https://pctires.ca/stripe-webhook
 *   Events: payment_intent.succeeded
 * Then set STRIPE_WEBHOOK_SECRET (whsec_...) in Cloudflare Pages env.
 *
 * Bindings / env: STRIPE_WEBHOOK_SECRET, STRIPE_SECRET, ORDERS_KV,
 *                 RESEND_API_KEY, TDG_API_KEY, SKIP_TDG (opt).
 */

import { processOrder } from './order-core.js';

// ─── Verify Stripe webhook signature (HMAC-SHA256 over `${t}.${rawBody}`) ──────
async function verifyStripeSignature(rawBody, sigHeader, secret, toleranceSec = 300) {
  if (!sigHeader || !secret) return false;

  let t = null;
  const v1s = [];
  for (const part of sigHeader.split(',')) {
    const [k, v] = part.trim().split('=');
    if (k === 't') t = v;
    else if (k === 'v1' && v) v1s.push(v);
  }
  if (!t || !v1s.length) return false;

  // Replay protection: reject if the timestamp is outside tolerance.
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(t)) > toleranceSec) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${rawBody}`));
  const expected = [...new Uint8Array(sigBuf)].map(b => b.toString(16).padStart(2, '0')).join('');

  // Constant-time-ish compare against each provided v1 (Stripe sends >1 during key rotation).
  for (const v1 of v1s) {
    if (v1.length !== expected.length) continue;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
    if (mismatch === 0) return true;
  }
  return false;
}

// ─── Best-effort: label the payment method (Affirm vs card) for the internal email ─
async function getPaymentLabel(pi, env) {
  try {
    // Newer API returns latest_charge as an ID; older expands charges.data[0].
    const chargeFromPi = pi?.charges?.data?.[0];
    let type = chargeFromPi?.payment_method_details?.type;

    if (!type && pi?.latest_charge && env.STRIPE_SECRET) {
      const res = await fetch(`https://api.stripe.com/v1/charges/${pi.latest_charge}`, {
        headers: { Authorization: `Bearer ${env.STRIPE_SECRET}` },
      });
      if (res.ok) {
        const charge = await res.json();
        type = charge?.payment_method_details?.type;
      }
    }
    if (!type && Array.isArray(pi?.payment_method_types) && pi.payment_method_types.length === 1) {
      type = pi.payment_method_types[0];
    }
    if (type === 'affirm') return 'Affirm (financing)';
    if (type === 'card')   return 'Card';
    return type ? type : 'Card';
  } catch {
    return 'Card';
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await request.text();
  const sig = request.headers.get('Stripe-Signature');

  const ok = await verifyStripeSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!ok) {
    console.error('Stripe webhook signature verification failed');
    return new Response('Invalid signature', { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // We only act on successful payments. Ack everything else so Stripe stops retrying.
  if (event.type !== 'payment_intent.succeeded') {
    return new Response(JSON.stringify({ received: true, ignored: event.type }), { status: 200 });
  }

  const pi = event.data?.object;
  if (!pi || pi.metadata?.source !== 'pctires-web') {
    // Not one of our PaymentIntents — ignore.
    return new Response(JSON.stringify({ received: true, ignored: 'not-pctires' }), { status: 200 });
  }

  // Pull the stashed order payload (written by create-pi.js at PI creation).
  let order = null;
  if (env.ORDERS_KV) {
    try {
      const raw = await env.ORDERS_KV.get('order:' + pi.id);
      if (raw) order = JSON.parse(raw);
    } catch (e) {
      console.error('KV read error for order:' + pi.id, e);
    }
  }

  if (!order) {
    // Order payload not found. Most likely KV lag right after creation — return 500
    // so Stripe retries with backoff. metadata.source confirms it IS our PI, so this
    // is a real order we must not silently drop.
    console.error('No stashed order for PI', pi.id, '- returning 500 for Stripe retry');
    return new Response(JSON.stringify({ error: 'order-not-found', pi: pi.id }), { status: 500 });
  }

  // Fill server-authoritative fields.
  order.paymentIntentId = pi.id;
  order.paymentMethod = await getPaymentLabel(pi, env);

  try {
    const result = await processOrder(order, env);
    return new Response(JSON.stringify({ received: true, ...result }), { status: 200 });
  } catch (err) {
    console.error('Webhook processOrder error:', err);
    // Return 500 so Stripe retries — better a retry than a lost order.
    return new Response(JSON.stringify({ error: 'processing-failed', message: err.message }), { status: 500 });
  }
}
