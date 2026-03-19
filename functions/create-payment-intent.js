/**
 * Cloudflare Pages Function: /functions/create-payment-intent.js
 *
 * Creates a Stripe PaymentIntent server-side so the secret key never
 * touches the browser. Called by the frontend just before the payment
 * step renders Stripe Elements.
 *
 * Environment variable required (set in Cloudflare Dashboard):
 *   STRIPE_SECRET — sk_live_...
 */

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

  try {
    const { amountCents, orderNumber, customerEmail, description } = await request.json();

    if (!amountCents || amountCents < 50) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400, headers: CORS });
    }

    const stripeSecret = env.STRIPE_SECRET;
    if (!stripeSecret) {
      return new Response(JSON.stringify({ error: 'Stripe not configured' }), { status: 500, headers: CORS });
    }

    // Create PaymentIntent via Stripe API
    const body = new URLSearchParams({
      amount:   String(amountCents),
      currency: 'cad',
      'automatic_payment_methods[enabled]': 'true',
      description: description || `PC Tires order ${orderNumber}`,
      receipt_email: customerEmail || '',
      metadata: JSON.stringify({ orderNumber: orderNumber || '' }),
    });

    const res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const pi = await res.json();

    if (pi.error) {
      return new Response(JSON.stringify({ error: pi.error.message }), { status: 400, headers: CORS });
    }

    return new Response(JSON.stringify({ clientSecret: pi.client_secret, paymentIntentId: pi.id }), {
      status: 200, headers: CORS,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error', message: err.message }), {
      status: 500, headers: CORS,
    });
  }
}
