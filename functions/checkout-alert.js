/**
 * Cloudflare Pages Function: /functions/checkout-alert.js
 *
 * Fired by the frontend when a checkout payment attempt FAILS.
 * Sends an internal alert email via Resend so failed checkouts are
 * visible to the shop instead of dying silently.
 *
 * Environment variable required (already set): RESEND_API_KEY
 */

const FROM_EMAIL    = 'alerts@pctires.ca';
const NOTIFY_EMAILS = ['calebpostma@gmail.com', 'postmacontracting@gmail.com'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function esc(s) {
  return String(s == null ? '' : s).slice(0, 600).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });
  }

  try {
    const b = await request.json();
    const resendKey = env.RESEND_API_KEY;
    if (!resendKey) {
      return new Response(JSON.stringify({ ok: true, warn: 'RESEND_API_KEY missing' }), { status: 200, headers: CORS });
    }

    const who = b.name || b.email || b.phone || 'unknown customer';
    const subject = '[PC Tires] FAILED CHECKOUT - ' + who;

    const phoneLink = b.phone
      ? '<a href="tel:' + esc(b.phone) + '">' + esc(b.phone) + '</a>'
      : '-';

    const html =
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
      'body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}' +
      '.card{background:#fff;border-radius:6px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}' +
      '.header{background:#111;padding:24px 28px}' +
      '.logo{font-size:22px;font-weight:900;letter-spacing:2px;color:#f5c518}' +
      '.header-sub{font-size:12px;color:#888;letter-spacing:1px;text-transform:uppercase;margin-top:2px}' +
      '.body{padding:28px}' +
      '.alert{background:#fdecea;border:1px solid #ef4444;border-radius:4px;padding:14px 16px;margin-bottom:22px;font-size:14px;font-weight:600;color:#111}' +
      'table{width:100%;border-collapse:collapse;font-size:14px}' +
      'td{padding:10px 0;border-bottom:1px solid #f0f0f0;vertical-align:top}' +
      'td:first-child{color:#888;width:32%;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.5px}' +
      'td:last-child{color:#111;font-weight:500}' +
      '.err{font-family:monospace;background:#f9f9f9;padding:8px;border-radius:3px;display:block;word-break:break-word}' +
      '.footer{background:#f9f9f9;padding:16px 28px;font-size:12px;color:#aaa;border-top:1px solid #eee}' +
      '</style></head><body><div class="card">' +
      '<div class="header"><div class="logo">PC TIRES</div>' +
      '<div class="header-sub">Failed Checkout Alert</div></div>' +
      '<div class="body">' +
      '<div class="alert">A customer just hit a payment error. Call them back - the sale is probably still alive.</div>' +
      '<table>' +
      '<tr><td>Error</td><td><span class="err">' + esc(b.error || 'unknown') + '</span></td></tr>' +
      '<tr><td>Customer</td><td>' + esc(b.name || '-') + '</td></tr>' +
      '<tr><td>Phone</td><td>' + phoneLink + '</td></tr>' +
      '<tr><td>Email</td><td>' + esc(b.email || '-') + '</td></tr>' +
      '<tr><td>Cart</td><td>' + esc(b.cart || '-') + '</td></tr>' +
      '<tr><td>Total</td><td>$' + esc(b.total || '?') + '</td></tr>' +
      '<tr><td>Order ID</td><td>' + esc(b.orderId || '-') + '</td></tr>' +
      '<tr><td>Browser</td><td>' + esc(b.userAgent || '-') + '</td></tr>' +
      '<tr><td>Time</td><td>' + new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' }) + ' (shop time)</td></tr>' +
      '</table></div>' +
      '<div class="footer">PC Tires checkout monitor - fired from processPayment catch block</div>' +
      '</div></body></html>';

    await Promise.all(NOTIFY_EMAILS.map(function (to) {
      return fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_EMAIL, to: to, subject: subject, html: html }),
      });
    }));

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });

  } catch (err) {
    // Never break anything downstream -- this is a passive alert.
    return new Response(JSON.stringify({ ok: true, warn: err.message }), { status: 200, headers: CORS });
  }
}