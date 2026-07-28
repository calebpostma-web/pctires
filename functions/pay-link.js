// /functions/pay-link.js
// Short codes for pay.html payment links, so texts and QR codes carry
// https://pctires.ca/pay?c=CODE instead of a 150-character query string.
//
// POST /pay-link  { amount, desc?, name?, email?, invoice? }
//   -> { ok: true, code, url }
// GET  /pay-link?c=CODE
//   -> { ok: true, amount, desc, name, email, invoice }
//
// Storage: QUOTES_KV (already bound for /quote), keys prefixed "PL:" so they
// can never collide with quote codes (which are bare 8-char keys).
// TTL 60 days. Rate limited via TECH_KV like send-quote-sms.js.

const CORS = {
  'Access-Control-Allow-Origin': 'https://pctires.ca',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const CODE_LENGTH   = 8;
const TTL_SECONDS   = 60 * 24 * 60 * 60; // 60 days

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

const clean = (v, max) => String(v || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);

async function rateLimit(env, ip) {
  if (!env.TECH_KV) return { allowed: true };
  try {
    const hourKey = `plrl:ip:${ip}:${Math.floor(Date.now() / 3600000)}`;
    const dayKey  = `plrl:global:${new Date().toISOString().slice(0, 10)}`;
    const [ipCount, dayCount] = await Promise.all([
      env.TECH_KV.get(hourKey),
      env.TECH_KV.get(dayKey),
    ]);
    if (parseInt(ipCount || '0', 10) >= 20)  return { allowed: false, error: 'Too many links created. Try again in an hour.' };
    if (parseInt(dayCount || '0', 10) >= 200) return { allowed: false, error: 'Daily link limit reached.' };
    await Promise.all([
      env.TECH_KV.put(hourKey, String(parseInt(ipCount || '0', 10) + 1), { expirationTtl: 3700 }),
      env.TECH_KV.put(dayKey,  String(parseInt(dayCount || '0', 10) + 1), { expirationTtl: 90000 }),
    ]);
  } catch (e) { /* KV problems never block */ }
  return { allowed: true };
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  if (method === 'OPTIONS') return onRequestOptions();

  if (!env.QUOTES_KV) {
    return json({ ok: false, error: 'QUOTES_KV not bound.' }, 500);
  }

  try {
    // ── GET: resolve a code ────────────────────────────────────────────
    if (method === 'GET') {
      const url = new URL(request.url);
      const code = clean(url.searchParams.get('c'), 12).toUpperCase();
      if (!code || !/^[A-Z2-9]{8}$/.test(code)) return json({ ok: false, error: 'Invalid code.' }, 400);
      const raw = await env.QUOTES_KV.get('PL:' + code);
      if (!raw) return json({ ok: false, error: 'Link not found or expired.' }, 404);
      const d = JSON.parse(raw);
      return json({ ok: true, amount: d.amount, desc: d.desc, name: d.name, email: d.email, invoice: d.invoice });
    }

    // ── POST: create a code ────────────────────────────────────────────
    if (method === 'POST') {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const rl = await rateLimit(env, ip);
      if (!rl.allowed) return json({ ok: false, error: rl.error }, 429);

      let body;
      try { body = await request.json(); }
      catch (e) { return json({ ok: false, error: 'Invalid request.' }, 400); }

      const amount = Math.round(parseFloat(body.amount) * 100) / 100;
      if (isNaN(amount) || amount < 0.5 || amount > 5000) {
        return json({ ok: false, error: 'Amount must be between $0.50 and $5000.' }, 400);
      }

      const rec = {
        amount:  amount.toFixed(2),
        desc:    clean(body.desc, 120),
        name:    clean(body.name, 80),
        email:   clean(body.email, 120),
        invoice: clean(body.invoice, 40),
        createdAt: Date.now(),
      };

      let code = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateCode();
        const existing = await env.QUOTES_KV.get('PL:' + candidate);
        if (!existing) { code = candidate; break; }
      }
      if (!code) return json({ ok: false, error: 'Code generation failed, try again.' }, 500);

      await env.QUOTES_KV.put('PL:' + code, JSON.stringify(rec), { expirationTtl: TTL_SECONDS });
      return json({ ok: true, code, url: 'https://pctires.ca/pay?c=' + code }, 201);
    }

    return json({ ok: false, error: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ ok: false, error: 'Server error', message: err.message }, 500);
  }
}
