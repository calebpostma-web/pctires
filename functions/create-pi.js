/**
 * Cloudflare Pages Function: /functions/create-pi.js
 *
 * Creates a Stripe PaymentIntent server-side so the secret key never touches the
 * browser. Called by the frontend at "Pay" time (deferred Payment Element flow)
 * with the final amount AND the full order payload.
 *
 * What changed for Affirm:
 *   - automatic_payment_methods stays enabled → Affirm shows automatically once
 *     enabled in the Stripe Dashboard and the amount is within Affirm's range.
 *   - Affirm requires a shipping address on the PaymentIntent → we attach the
 *     PC Tires shop address (tires ship to shop for install/pickup).
 *   - metadata.source = 'pctires-web' so the webhook can recognise our PIs.
 *   - The full order payload is stashed in KV (order:<piId>, TTL 24h) so the
 *     webhook can place the order even if the customer's browser is gone
 *     (the Affirm redirect case).
 *
 * Env / bindings: STRIPE_SECRET, ORDERS_KV (KV namespace PC_TIRES_ORDERS).
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// Tires ship to the shop; used as the Affirm-required shipping address.
const SHIP = {
  line1:       '7144 Grande River Line',
  city:        'Pain Court',
  state:       'ON',
  postal_code: 'N0P 1M0',
  country:     'CA',
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
    const { amountCents, orderNumber, customerEmail, description, order } = await request.json();

    if (!amountCents || amountCents < 50) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400, headers: CORS });
    }

    const stripeSecret = env.STRIPE_SECRET;
    if (!stripeSecret) {
      return new Response(JSON.stringify({ error: 'Stripe not configured' }), { status: 500, headers: CORS });
    }

    const body = new URLSearchParams({
      amount:   String(amountCents),
      currency: 'cad',
      'automatic_payment_methods[enabled]': 'true',
      // Redirect-based methods (Affirm) require redirects to be allowed.
      'automatic_payment_methods[allow_redirects]': 'always',
      description: description || `PC Tires order ${orderNumber}`,
    });

    // Tag the PI so the webhook can identify our orders and skip everything else.
    body.set('metadata[source]', 'pctires-web');
    if (orderNumber) body.set('metadata[orderNumber]', String(orderNumber));

    // Affirm requires a shipping address on the PaymentIntent.
    const shipName = (order && order.customerName) ? String(order.customerName) : 'PC Tires Customer';
    body.set('shipping[name]', shipName);
    body.set('shipping[address][line1]',       SHIP.line1);
    body.set('shipping[address][city]',        SHIP.city);
    body.set('shipping[address][state]',       SHIP.state);
    body.set('shipping[address][postal_code]', SHIP.postal_code);
    body.set('shipping[address][country]',     SHIP.country);

    // receipt_email only when it looks valid — a malformed email makes Stripe
    // reject the ENTIRE PaymentIntent (a customer typo once killed checkout).
    const cleanEmail = (customerEmail || '').trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      body.set('receipt_email', cleanEmail);
    }

    const stripeHeaders = {
      'Authorization': `Bearer ${stripeSecret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    // Idempotency: same orderNumber within 24h returns the EXISTING PI, never a
    // second one — the backstop against double-charging on retries/double-posts.
    if (orderNumber) stripeHeaders['Idempotency-Key'] = `pi-${orderNumber}`;

    const res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: stripeHeaders,
      body: body.toString(),
    });

    const pi = await res.json();

    if (pi.error) {
      return new Response(JSON.stringify({ error: pi.error.message }), { status: 400, headers: CORS });
    }

    // Stash the full order payload so the webhook can place it even if the
    // customer's browser never comes back (Affirm redirect). TTL 24h.
    if (order && env.ORDERS_KV) {
      try {
        const stashed = { ...order, orderNumber: order.orderNumber || orderNumber, paymentIntentId: pi.id };
        await env.ORDERS_KV.put('order:' + pi.id, JSON.stringify(stashed), { expirationTtl: 86400 });
      } catch (e) {
        // Non-fatal: card orders still have the client-side backup path. Log it.
        console.error('KV stash failed for', pi.id, e);
      }
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
