/**
 * Cloudflare Pages Function: /functions/send-service-request.js
 *
 * Called when a customer submits a service booking / quote / hold request
 * (index.html, swap.html, farm-tires.html, trailer-tires.html, used.html).
 * Sends ONE internal notification email to PC Tires via Resend.
 *
 * Hardened 2026-11-18 after an automated vulnerability scanner posted ~100
 * junk requests straight to this endpoint (bypassing the on-page form checks):
 *   - only accepts posts that come from our own site (Origin check)
 *   - name + phone are validated here on the server, not just in the browser
 *   - every field is length-capped and HTML-escaped before it goes in the email
 *   - rate limited per IP and per day (TECH_KV), so a flood can't burn the
 *     Resend quota that order emails also depend on
 *
 * Environment variable required (set in Cloudflare Dashboard):
 *   RESEND_API_KEY - re_...
 * Optional binding: TECH_KV (already bound) - used for rate limiting.
 */

const FROM_EMAIL    = 'bookings@pctires.ca';
const NOTIFY_EMAILS = ['calebpostma@gmail.com', 'postmacontracting@gmail.com'];

const ALLOWED_ORIGINS = new Set(['https://pctires.ca', 'https://www.pctires.ca']);

// Limits: a real customer sends one or two requests; the shop gets a few dozen a day at peak.
const PER_IP_PER_HOUR = 15;
const GLOBAL_PER_DAY  = 120;

function originAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Cloudflare Pages preview deployments of this project
  return /^https:\/\/([a-z0-9-]+\.)?pctires\.pages\.dev$/.test(origin);
}

// Browsers send Origin on every POST. If a privacy tool strips it, fall back to
// the Referer so a real customer on our own page is never turned away.
function fromOurSite(request) {
  const origin = request.headers.get('Origin') || '';
  if (origin) return originAllowed(origin);
  const ref = request.headers.get('Referer') || '';
  try { return ref ? originAllowed(new URL(ref).origin) : false; } catch (e) { return false; }
}

function corsFor(origin) {
  return {
    'Access-Control-Allow-Origin': originAllowed(origin) ? origin : 'https://pctires.ca',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
  };
}

function esc(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Coerce to a trimmed single-spaced string, strip control characters, cap length.
function clean(v, max) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return '';
  return String(v)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

async function rateLimit(env, ip) {
  if (!env.TECH_KV) return { allowed: true };
  try {
    const hourKey = `svcrl:ip:${ip}:${Math.floor(Date.now() / 3600000)}`;
    const dayKey  = `svcrl:global:${new Date().toISOString().slice(0, 10)}`;
    const [ipCount, dayCount] = await Promise.all([
      env.TECH_KV.get(hourKey),
      env.TECH_KV.get(dayKey),
    ]);
    if (parseInt(ipCount || '0', 10) >= PER_IP_PER_HOUR) return { allowed: false, error: 'Too many requests. Please call 519-397-4686.' };
    if (parseInt(dayCount || '0', 10) >= GLOBAL_PER_DAY)  return { allowed: false, error: 'Please call 519-397-4686 to book.' };
    await Promise.all([
      env.TECH_KV.put(hourKey, String(parseInt(ipCount || '0', 10) + 1), { expirationTtl: 3700 }),
      env.TECH_KV.put(dayKey,  String(parseInt(dayCount || '0', 10) + 1), { expirationTtl: 90000 }),
    ]);
  } catch (e) { /* KV problems never block a real customer */ }
  return { allowed: true };
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '';
  const CORS = corsFor(origin);
  const reply = (obj, status) => new Response(JSON.stringify(obj), { status, headers: CORS });

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== 'POST') {
    return reply({ error: 'Method not allowed' }, 405);
  }
  // Only our own pages may post here.
  if (!fromOurSite(request)) {
    return reply({ ok: false, error: 'Forbidden' }, 403);
  }

  let req;
  try {
    req = await request.json();
  } catch (e) {
    return reply({ ok: false, error: 'Invalid request.' }, 400);
  }
  if (!req || typeof req !== 'object' || Array.isArray(req)) {
    return reply({ ok: false, error: 'Invalid request.' }, 400);
  }

  const service       = clean(req.service, 120);
  const customerName  = clean(req.customerName, 80);
  const customerPhone = clean(req.customerPhone, 40);
  const customerEmail = clean(req.customerEmail, 120);
  const vehicle       = clean(req.vehicle, 120);
  const notes         = clean(req.notes, 1500);
  const preferredDate = clean(req.preferredDate, 80);
  const preferredTime = clean(req.preferredTime, 40);
  const price         = clean(req.price, 160);
  const quantityRaw   = clean(req.quantity, 6);
  const quantity      = /^\d{1,3}$/.test(quantityRaw) ? quantityRaw : '';
  const durationNum   = Number(req.duration);
  const duration      = Number.isFinite(durationNum) && durationNum >= 0 && durationNum <= 600 ? durationNum : 0;

  // ── Server-side validation (the browser checks can be bypassed) ──────────
  const phoneDigits = customerPhone.replace(/\D/g, '');
  const badChars = /[<>{}$`|;\\=]/;
  if (!service) return reply({ ok: false, error: 'Missing service.' }, 400);
  if (customerName.length < 2 || badChars.test(customerName)) {
    return reply({ ok: false, error: 'Please enter your name.' }, 400);
  }
  if (phoneDigits.length < 7 || phoneDigits.length > 15 || badChars.test(customerPhone)) {
    return reply({ ok: false, error: 'Please enter a valid phone number.' }, 400);
  }
  // Email, vehicle and notes are optional free text: never reject a real
  // customer over them - they are length-capped and escaped instead.

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rl = await rateLimit(env, ip);
  if (!rl.allowed) return reply({ ok: false, error: rl.error }, 429);

  try {
    const resendKey = env.RESEND_API_KEY;
    if (!resendKey) {
      // Still return success so UX isn't broken - just won't send email
      console.warn('RESEND_API_KEY not set');
      return reply({ ok: true, warn: 'Email not sent - API key missing' }, 200);
    }

    const subject = `[PC Tires] Service Request — ${service} — ${customerName}`.slice(0, 200);

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}
  .card{background:#fff;border-radius:6px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
  .header{background:#111;padding:24px 28px;display:flex;align-items:center;gap:12px}
  .logo{font-size:22px;font-weight:900;letter-spacing:2px;color:#f5c518}
  .header-sub{font-size:12px;color:#888;letter-spacing:1px;text-transform:uppercase;margin-top:2px}
  .body{padding:28px}
  .alert{background:#fef9e7;border:1px solid #f5c518;border-radius:4px;padding:14px 16px;margin-bottom:22px;font-size:14px;font-weight:600;color:#111}
  table{width:100%;border-collapse:collapse;font-size:14px}
  td{padding:10px 0;border-bottom:1px solid #f0f0f0;vertical-align:top}
  td:first-child{color:#888;width:38%;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.5px}
  td:last-child{color:#111;font-weight:500}
  .footer{background:#f9f9f9;padding:16px 28px;font-size:12px;color:#aaa;border-top:1px solid #eee}
</style></head>
<body>
<div class="card">
  <div class="header">
    <div>
      <div class="logo">PC TIRES</div>
      <div class="header-sub">New Service Request</div>
    </div>
  </div>
  <div class="body">
    <div class="alert">📅 New service booking request — please confirm with the customer.</div>
    <table>
      <tr><td>Service</td><td><strong>${esc(service)}</strong></td></tr>
      ${quantity ? `<tr><td>Quantity</td><td>${esc(quantity)}</td></tr>` : ''}
      <tr><td>Duration</td><td>${duration} minutes</td></tr>
      <tr><td>Price</td><td>${esc(price) || '—'}</td></tr>
      <tr><td>Preferred Date</td><td>${esc(preferredDate) || '—'}</td></tr>
      <tr><td>Preferred Time</td><td>${esc(preferredTime) || '—'}</td></tr>
      <tr><td>Customer</td><td>${esc(customerName)}</td></tr>
      <tr><td>Phone</td><td><a href="tel:${esc(phoneDigits)}">${esc(customerPhone)}</a></td></tr>
      <tr><td>Email</td><td>${esc(customerEmail) || '—'}</td></tr>
      <tr><td>Vehicle</td><td>${esc(vehicle) || '—'}</td></tr>
      <tr><td>Notes</td><td>${esc(notes) || '—'}</td></tr>
    </table>
  </div>
  <div class="footer">PC Tires · 7144 Grande River Line, Pain Court, ON · 519-397-4686</div>
</div>
</body>
</html>`;

    // One email addressed to both internal inboxes (halves Resend usage vs. two sends)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: NOTIFY_EMAILS, subject, html }),
    });
    if (!res.ok) console.error('send-service-request: Resend returned', res.status);

    return reply({ ok: true }, 200);

  } catch (err) {
    // Always return 200 so the UI shows success even if email fails
    console.error('send-service-request error:', err.message);
    return reply({ ok: true, warn: 'Email not sent' }, 200);
  }
}
