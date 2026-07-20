/**
 * Cloudflare Pages Function: /functions/quote.js
 *
 * Shareable quote links. Owner (Caleb) builds a cart, hits "Share Quote",
 * gets a short URL like pctires.ca/q/A4F7XYZ2. Customer opens the link, sees
 * the exact pre-built cart, checks out via existing Stripe flow.
 *
 * Endpoints (all hit /quote):
 *   POST   /quote          — Create a quote (owner-auth required)
 *   GET    /quote?code=X   — Retrieve a quote
 *   PATCH  /quote          — Mark a quote as paid (after Stripe success)
 *
 * Requires:
 *   - KV namespace bound as QUOTES_KV (create in Cloudflare dashboard)
 *   - env var OWNER_PASSWORD (owner auth is via signed token from /owner-auth)
 */

import { verifyOwnerToken } from './owner-token.js';

const QUOTE_TTL_SECONDS = 30 * 24 * 60 * 60;       // 30 days for open quotes
const PAID_TTL_SECONDS  = 90 * 24 * 60 * 60;       // 90 days for paid quotes
const CODE_ALPHABET     = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L ambiguity
const CODE_LENGTH       = 8;
const PUBLIC_HOST       = 'https://pctires.ca';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function generateCode() {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return s;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (!env.QUOTES_KV) {
    return json({ error: 'QUOTES_KV not bound. Set up KV namespace in Cloudflare Pages settings.' }, 500);
  }

  try {
    // ── GET — retrieve a quote ─────────────────────────────────────
    if (method === 'GET') {
      const url = new URL(request.url);
      const code = (url.searchParams.get('code') || '').toUpperCase();
      if (!code) return json({ error: 'Missing code parameter' }, 400);
      const raw = await env.QUOTES_KV.get(code);
      if (!raw) return json({ error: 'Quote not found or expired' }, 404);
      return json(JSON.parse(raw), 200);
    }

    // ── POST — create a quote (owner auth) ─────────────────────────
    if (method === 'POST') {
      const body = await request.json();
      const ownerOk = await verifyOwnerToken(body.ownerToken, env);
      if (!ownerOk) {
        return json({ error: 'Unauthorized' }, 401);
      }
      if (!Array.isArray(body.cart) || body.cart.length === 0) {
        return json({ error: 'Cart is empty' }, 400);
      }

      // Generate a unique code (retry up to 5 times on collision — extremely unlikely)
      let code = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateCode();
        const existing = await env.QUOTES_KV.get(candidate);
        if (!existing) { code = candidate; break; }
      }
      if (!code) return json({ error: 'Code generation failed, try again' }, 500);

      const quote = {
        code,
        cart: body.cart,
        appliedPromo: body.appliedPromo || null,
        finalTotal: (typeof body.finalTotal === 'number' && body.finalTotal > 0) ? Math.round(body.finalTotal * 100) / 100 : null,
        customerName:  (body.customerName  || '').toString().slice(0, 100),
        customerPhone: (body.customerPhone || '').toString().slice(0, 30),
        note:          (body.note          || '').toString().slice(0, 1000),
        status: 'open',
        createdAt: Date.now(),
      };

      await env.QUOTES_KV.put(code, JSON.stringify(quote), { expirationTtl: QUOTE_TTL_SECONDS });
      return json({ code, url: `${PUBLIC_HOST}/q/${code}` }, 201);
    }

    // ── PATCH — mark a quote as paid (called from client after Stripe success) ──
    if (method === 'PATCH') {
      const body = await request.json();
      const code = (body.code || '').toString().toUpperCase();
      if (!code) return json({ error: 'Missing code' }, 400);

      const raw = await env.QUOTES_KV.get(code);
      if (!raw) return json({ error: 'Quote not found' }, 404);
      const quote = JSON.parse(raw);

      // Only allow open → paid transition, and require a paymentIntentId so this
      // can't be triggered without an actual Stripe charge having happened
      if (body.status === 'paid' && body.paymentIntentId) {
        if (quote.status === 'paid') return json({ ok: true, already: true }, 200);
        quote.status = 'paid';
        quote.paidAt = Date.now();
        quote.paymentIntentId = String(body.paymentIntentId).slice(0, 100);
        await env.QUOTES_KV.put(code, JSON.stringify(quote), { expirationTtl: PAID_TTL_SECONDS });
        return json({ ok: true }, 200);
      }

      return json({ error: 'Invalid PATCH operation' }, 400);
    }

    return json({ error: 'Method not allowed' }, 405);

  } catch (err) {
    return json({ error: 'Server error', message: err.message }, 500);
  }
}
