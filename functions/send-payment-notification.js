/**
 * Cloudflare Pages Function: /functions/send-payment-notification.js
 *
 * Called after a successful invoice payment on /pay.
 * Sends an internal notification email to PC Tires via Resend so
 * Caleb knows a payment came through and what it was for.
 *
 * Environment variable required (already set in Cloudflare):
 *   RESEND_API_KEY — re_...
 */

const FROM_EMAIL    = 'payments@pctires.ca';
const NOTIFY_EMAILS = ['calebpostma@gmail.com', 'postmacontracting@gmail.com'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST')   return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });

  try {
    const req = await request.json();
    const {
      invoiceNumber, description, amount, currency,
      customerName, customerEmail, customerPhone,
      paymentIntentId, notes,
    } = req;

    const resendKey = env.RESEND_API_KEY;
    if (!resendKey) {
      console.warn('RESEND_API_KEY not set');
      return new Response(JSON.stringify({ ok: true, warn: 'Email not sent — API key missing' }), { status: 200, headers: CORS });
    }

    const subject = `[PC Tires] Payment Received — $${Number(amount).toFixed(2)} — ${customerName || 'Customer'}`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}
  .card{background:#fff;border-radius:6px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
  .header{background:#111;padding:24px 28px}
  .logo{font-size:22px;font-weight:900;letter-spacing:2px;color:#f5c518}
  .header-sub{font-size:12px;color:#888;letter-spacing:1px;text-transform:uppercase;margin-top:2px}
  .body{padding:28px}
  .alert{background:#e7f6ec;border:1px solid #22c55e;border-radius:4px;padding:14px 16px;margin-bottom:22px;font-size:14px;font-weight:600;color:#111}
  table{width:100%;border-collapse:collapse;font-size:14px}
  td{padding:10px 0;border-bottom:1px solid #f0f0f0;vertical-align:top}
  td:first-child{color:#888;width:38%;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.5px}
  td:last-child{color:#111;font-weight:500}
  .amount{font-size:22px;font-weight:800;color:#f5c518;font-family:Arial,sans-serif}
  .footer{background:#f9f9f9;padding:16px 28px;font-size:12px;color:#aaa;border-top:1px solid #eee}
</style></head>
<body>
<div class="card">
  <div class="header">
    <div class="logo">PC TIRES</div>
    <div class="header-sub">Payment Received</div>
  </div>
  <div class="body">
    <div class="alert">&#x1F4B0; ${esc(customerName) || 'A customer'} paid $${esc(Number(amount).toFixed(2))} via /pay.</div>
    <table>
      <tr><td>Amount</td><td><span class="amount">$${esc(Number(amount).toFixed(2))} ${esc(currency || 'CAD')}</span></td></tr>
      ${invoiceNumber ? `<tr><td>Invoice #</td><td>${esc(invoiceNumber)}</td></tr>` : ''}
      <tr><td>Description</td><td>${esc(description) || '—'}</td></tr>
      <tr><td>Customer</td><td>${esc(customerName) || '—'}</td></tr>
      <tr><td>Email</td><td>${customerEmail ? `<a href="mailto:${esc(customerEmail)}">${esc(customerEmail)}</a>` : '—'}</td></tr>
      <tr><td>Phone</td><td>${customerPhone ? `<a href="tel:${esc(customerPhone)}">${esc(customerPhone)}</a>` : '—'}</td></tr>
      <tr><td>Stripe Payment</td><td style="font-family:monospace;font-size:12px">${esc(paymentIntentId) || '—'}</td></tr>
      ${notes ? `<tr><td>Notes</td><td>${esc(notes)}</td></tr>` : ''}
    </table>
  </div>
  <div class="footer">PC Tires &middot; 7144 Grande River Line, Pain Court, ON &middot; 519-397-4686</div>
</div>
</body>
</html>`;

    await Promise.all(NOTIFY_EMAILS.map(to =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
      })
    ));

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });

  } catch (err) {
    console.error('send-payment-notification error:', err.message);
    return new Response(JSON.stringify({ ok: true, warn: err.message }), { status: 200, headers: CORS });
  }
}
