// /functions/statuspay-link.js
//
// Short codes for /statuspay — the owner-built payment link used when a status
// card holder settles the balance on an order that was placed online at 13%.
//
// Flow: customer orders online and pays the deposit like anyone else. They show
// up at the shop with their card. Caleb builds a link here from the "Subtotal
// before tax" line of his order email; the page prices it at 5% GST, subtracts
// whatever deposit they already paid, and the customer pays the balance while
// typing in their own status card details.
//
//   POST /statuspay-link  { ownerToken, orderNumber, pretax, deposit, goods, ... }
//     -> { ok: true, code, url }
//   GET  /statuspay-link?c=CODE
//     -> { ok: true, orderNumber, pretax, gst, newTotal, deposit, balance }
//
// Storage: QUOTES_KV, keys prefixed "SP:" so they never collide with quote
// codes (bare 8-char keys) or pay-link codes ("PL:"). TTL 60 days.
//
// POST is owner-gated — only Caleb can create one, because creating one is
// what grants the tax relief.

import { verifyOwnerToken } from './owner-token.js';

const CORS = {
  'Access-Control-Allow-Origin': 'https://pctires.ca',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH   = 8;
const TTL_SECONDS   = 60 * 24 * 60 * 60;

const GST_RATE = 0.05;
const HST_RATE = 0.13;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

function generateCode() {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return s;
}

const CTRL = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');
const clean = (v, max) => String(v || '').replace(CTRL, '').trim().slice(0, max);
const round2 = n => Math.round(Number(n) * 100) / 100;

// Single source of truth for the arithmetic. The page mirrors this so the owner
// sees the same numbers before he sends the link.
//
// Input is the PRE-TAX subtotal, straight off the "Subtotal before tax" line of
// the order email. Nothing here ever touches 13% — the exemption means the
// provincial 8% simply never applies, so there is nothing to strip back off.
export function computeStatusTotals(pretaxIn, deposit) {
  const pretax  = round2(pretaxIn);
  const dep     = round2(deposit || 0);
  const gst     = round2(pretax * GST_RATE);
  const hst     = round2(pretax * HST_RATE);
  // Derive the relief from the two rounded figures so the three always
  // reconcile to the cent: hst - relief === gst, every time.
  const relief  = round2(hst - gst);
  const newTot  = round2(pretax + gst);
  const balance = round2(newTot - dep);
  return { pretax, hst, relief, gst, newTotal: newTot, deposit: dep, balance };
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  if (method === 'OPTIONS') return onRequestOptions();

  if (!env.QUOTES_KV) return json({ ok: false, error: 'QUOTES_KV not bound.' }, 500);

  try {
    // GET: resolve a code (public — the customer needs this)
    if (method === 'GET') {
      const url = new URL(request.url);
      const code = clean(url.searchParams.get('c'), 12).toUpperCase();
      if (!code || !/^[A-Z2-9]{8}$/.test(code)) return json({ ok: false, error: 'Invalid code.' }, 400);
      const raw = await env.QUOTES_KV.get('SP:' + code);
      if (!raw) return json({ ok: false, error: 'Link not found or expired.' }, 404);
      const d = JSON.parse(raw);
      if (d.paid) return json({ ok: false, error: 'This balance has already been paid.', paid: true }, 409);
      return json({ ok: true, ...d });
    }

    // PATCH: mark paid, so a link can't be reused
    if (method === 'PATCH') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'Invalid request.' }, 400); }
      const code = clean(body.code, 12).toUpperCase();
      if (!/^[A-Z2-9]{8}$/.test(code)) return json({ ok: false, error: 'Invalid code.' }, 400);
      const raw = await env.QUOTES_KV.get('SP:' + code);
      if (!raw) return json({ ok: false, error: 'Not found.' }, 404);
      const d = JSON.parse(raw);
      d.paid = true;
      d.paidAt = Date.now();
      d.statusCard = clean(body.statusCard, 40);
      d.statusBand = clean(body.statusBand, 40);
      d.statusName = clean(body.statusName, 100);
      await env.QUOTES_KV.put('SP:' + code, JSON.stringify(d), { expirationTtl: TTL_SECONDS });
      return json({ ok: true });
    }

    // POST: create a code (owner only)
    if (method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'Invalid request.' }, 400); }

      const ownerOk = await verifyOwnerToken(body.ownerToken, env);
      if (!ownerOk) return json({ ok: false, error: 'Sign in as owner first.' }, 401);

      const pretax  = Number(body.pretax);
      const deposit = Number(body.deposit || 0);
      if (isNaN(pretax) || pretax <= 0 || pretax > 20000) {
        return json({ ok: false, error: 'Subtotal must be between $0.01 and $20,000.' }, 400);
      }
      if (isNaN(deposit) || deposit < 0) {
        return json({ ok: false, error: 'Deposit cannot be negative.' }, 400);
      }

      const totals = computeStatusTotals(pretax, deposit);
      if (deposit > totals.newTotal) {
        return json({ ok: false, error: 'Deposit is more than the order total.' }, 400);
      }
      if (totals.balance < 0.50) return json({ ok: false, error: 'Balance is under $0.50 — take it in person.' }, 400);
      if (totals.balance > 5000) return json({ ok: false, error: 'Balance over $5000 — split it or take it in person.' }, 400);

      const rec = {
        ...totals,
        orderNumber: clean(body.orderNumber, 40),
        desc:        clean(body.desc, 120),
        goods:       clean(body.goods, 200),
        name:        clean(body.name, 80),
        email:       clean(body.email, 120),
        phone:       clean(body.phone, 30),
        createdAt:   Date.now(),
        paid:        false,
      };

      let code = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateCode();
        const existing = await env.QUOTES_KV.get('SP:' + candidate);
        if (!existing) { code = candidate; break; }
      }
      if (!code) return json({ ok: false, error: 'Code generation failed, try again.' }, 500);

      await env.QUOTES_KV.put('SP:' + code, JSON.stringify(rec), { expirationTtl: TTL_SECONDS });
      return json({ ok: true, code, url: 'https://pctires.ca/statuspay?c=' + code, ...totals }, 201);
    }

    return json({ ok: false, error: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ ok: false, error: 'Server error', message: err.message }, 500);
  }
}
