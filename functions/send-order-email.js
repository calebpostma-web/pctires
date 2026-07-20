/**
 * Cloudflare Pages Function: /functions/send-order-email.js
 *
 * CLIENT-SIDE ("backup") order path. Called by the browser from finishOrder()
 * immediately after an inline CARD payment succeeds. Places the TDG order and
 * sends the confirmation + internal emails.
 *
 * As of the Affirm build this is a thin wrapper around order-core.processOrder(),
 * which is ALSO called by stripe-webhook.js (the durable path). Durable KV dedup
 * (keyed by paymentIntentId) guarantees the order is placed exactly once no matter
 * which path fires first — so keeping this backup can never double-place.
 *
 * Affirm orders never hit this endpoint (the customer is redirected away before
 * finishOrder runs) — they are placed by the webhook.
 *
 * Environment: RESEND_API_KEY, TDG_API_KEY, ORDERS_KV (binding), SKIP_TDG (opt).
 */

import { processOrder } from './order-core.js';
import { verifyOwnerToken } from './owner-token.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// Confirm with Stripe that a PaymentIntent actually succeeded (server-side).
// Stops anyone from POSTing a fake order to place a real TDG order for free.
async function stripePaymentSucceeded(piId, env) {
  try {
    const secret = env.STRIPE_SECRET;
    if (!secret || !piId) return false;
    const res = await fetch('https://api.stripe.com/v1/payment_intents/' + encodeURIComponent(piId), {
      headers: { 'Authorization': 'Bearer ' + secret },
    });
    if (!res.ok) return false;
    const pi = await res.json();
    // Must be a fully-succeeded PaymentIntent that OUR checkout created
    // (metadata.source) — blocks reusing an unrelated PaymentIntent from the account.
    return !!pi && pi.status === 'succeeded' && pi.metadata && pi.metadata.source === 'pctires-web';
  } catch (e) {
    return false;
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });
  }

  let order;
  try {
    order = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: CORS });
  }

  if (!order.paymentMethod) order.paymentMethod = 'Card';

  // ── AUTH GATE ─────────────────────────────────────────────────────────────
  // This endpoint places a REAL TDG order (real money). It must never place one
  // on an unauthenticated request. Two legitimate cases:
  //   1) A normal customer order — must carry a Stripe PaymentIntent that Stripe
  //      confirms actually succeeded.
  //   2) An owner no-charge order (e-transfer/cash/pay-on-pickup) — no payment,
  //      so it must carry a valid signed owner token.
  const piId = order.paymentIntentId && String(order.paymentIntentId).trim();
  if (piId) {
    const paid = await stripePaymentSucceeded(piId, env);
    if (!paid) {
      return new Response(JSON.stringify({ error: 'Payment not verified' }), { status: 402, headers: CORS });
    }
  } else {
    const ownerOk = await verifyOwnerToken(order.ownerToken, env);
    if (!ownerOk) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  try {
    const result = await processOrder(order, env);
    return new Response(JSON.stringify(result), { status: 200, headers: CORS });
  } catch (err) {
    console.error('send-order-email error:', err);
    return new Response(JSON.stringify({ error: 'Server error', message: err.message }), {
      status: 500, headers: CORS,
    });
  }
}
