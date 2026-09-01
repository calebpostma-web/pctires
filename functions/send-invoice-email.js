// /functions/send-invoice-email.js
// Emails a pay.html payment link to a customer, server-side via Resend —
// replaces the mailto: handoff in the pay.html link generator (which popped
// "open this application" on machines with no mail app).
//
// POST JSON { email, name?, amount, desc?, invoice?, link }
//   -> { ok: true } or { ok: false, error }
//
// Guard rails: link must be a pctires.ca/pay URL (this is not a general
// mailer), rate limited via TECH_KV, from orders@pctires.ca with a BCC copy
// to the shop inbox for records.
//
// Env: RESEND_API_KEY (already set for order emails). Binding: TECH_KV.

const CORS = {
  'Access-Control-Allow-Origin': 'https://pctires.ca',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const FROM_EMAIL  = 'PC Tires <orders@pctires.ca>';
const SHOP_EMAIL  = 'postmacontracting@gmail.com';  // bcc: internal copy, direct to Gmail
const REPLY_TO    = 'contact@pctires.ca';                   // what the customer sees and replies to

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (v, max) => String(v || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);

async function rateLimit(env, ip) {
  if (!env.TECH_KV) return { allowed: true };
  try {
    const hourKey = `invemail:ip:${ip}:${Math.floor(Date.now() / 3600000)}`;
    const dayKey  = `invemail:global:${new Date().toISOString().slice(0, 10)}`;
    const [ipCount, dayCount] = await Promise.all([
      env.TECH_KV.get(hourKey),
      env.TECH_KV.get(dayKey),
    ]);
    if (parseInt(ipCount || '0', 10) >= 10)  return { allowed: false, error: 'Too many emails from this device. Try again in an hour.' };
    if (parseInt(dayCount || '0', 10) >= 100) return { allowed: false, error: 'Daily email limit reached.' };
    await Promise.all([
      env.TECH_KV.put(hourKey, String(parseInt(ipCount || '0', 10) + 1), { expirationTtl: 3700 }),
      env.TECH_KV.put(dayKey,  String(parseInt(dayCount || '0', 10) + 1), { expirationTtl: 90000 }),
    ]);
  } catch (e) { /* never block on KV trouble */ }
  return { allowed: true };
}

function buildHtml({ name, amount, desc, invoice, link }) {
  const first = esc((name || '').split(' ')[0]);
  const greeting = first ? `Hi ${first},` : 'Hi,';
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e5e5;border-top:4px solid #f5c518;max-width:520px;width:100%;">
  <tr><td style="padding:28px 32px 8px;">
    <div style="font-size:22px;font-weight:800;letter-spacing:2px;color:#0a0a0a;"><span style="color:#c99b00;">PC</span> TIRES</div>
  </td></tr>
  <tr><td style="padding:8px 32px 0;font-size:15px;color:#333;line-height:1.6;">
    <p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 18px;">Your PC Tires invoice is ready.</p>
  </td></tr>
  <tr><td style="padding:0 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f2;border:1px solid #eee;">
      <tr><td style="padding:16px 20px;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;">Amount due</div>
        <div style="font-size:32px;font-weight:800;color:#0a0a0a;">$${esc(amount)} <span style="font-size:14px;color:#888;">CAD</span></div>
        ${invoice ? `<div style="font-size:13px;color:#555;margin-top:8px;">Invoice #: <strong>${esc(invoice)}</strong></div>` : ''}
        ${desc ? `<div style="font-size:13px;color:#555;margin-top:4px;">For: ${esc(desc)}</div>` : ''}
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:22px 32px;" align="center">
    <a href="${esc(link)}" style="display:inline-block;background:#f5c518;color:#0a0a0a;text-decoration:none;font-weight:800;font-size:15px;letter-spacing:1px;padding:14px 38px;">PAY SECURELY ONLINE</a>
    <div style="font-size:12px;color:#999;margin-top:10px;">Payment is encrypted and processed by Stripe.</div>
  </td></tr>
  <tr><td style="padding:0 32px 26px;font-size:14px;color:#555;line-height:1.6;">
    <p style="margin:0;">Questions? Call us at <a href="tel:5193974686" style="color:#0a0a0a;font-weight:700;text-decoration:none;">519-397-4686</a>.</p>
    <p style="margin:14px 0 0;">Thanks,<br>PC Tires — Chatham-Kent, ON</p>
  </td></tr>
</table>
<div style="font-size:11px;color:#aaa;padding:14px;">PC Tires · 7144 Grande River Line, Pain Court, ON · pctires.ca</div>
</td></tr>
</table>
</body></html>`;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.RESEND_API_KEY) {
    return json({ ok: false, error: 'Email is not configured yet.' }, 500);
  }

  let body;
  try { body = await request.json(); }
  catch (e) { return json({ ok: false, error: 'Invalid request.' }, 400); }

  const email = clean(body.email, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ ok: false, error: 'Enter a valid customer email address.' }, 400);
  }

  // Only ever mail links to our own pay page — this is not a general mailer.
  const link = clean(body.link, 250);
  if (!/^https:\/\/(www\.)?pctires\.ca\/pay(\?|$)/.test(link)) {
    return json({ ok: false, error: 'Invalid payment link.' }, 400);
  }

  const amountNum = Math.round(parseFloat(body.amount) * 100) / 100;
  if (isNaN(amountNum) || amountNum < 0.5 || amountNum > 5000) {
    return json({ ok: false, error: 'Invalid amount.' }, 400);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rl = await rateLimit(env, ip);
  if (!rl.allowed) return json({ ok: false, error: rl.error }, 429);

  const name    = clean(body.name, 80);
  const desc    = clean(body.desc, 120);
  const invoice = clean(body.invoice, 40);
  const amount  = amountNum.toFixed(2);

  const subject = 'PC Tires invoice' + (invoice ? ' ' + invoice : '') + ' — $' + amount;
  const html = buildHtml({ name, amount, desc, invoice, link });

  let res, data;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        bcc: SHOP_EMAIL,
        reply_to: REPLY_TO,
        subject,
        html,
      }),
    });
    data = await res.json();
  } catch (e) {
    return json({ ok: false, error: 'Could not reach the email provider. Try again.' }, 502);
  }

  if (res.ok && data && data.id) {
    return json({ ok: true });
  }
  return json({ ok: false, error: (data && data.message) ? data.message : 'Email provider error.' }, 502);
}
