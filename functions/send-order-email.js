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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

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
