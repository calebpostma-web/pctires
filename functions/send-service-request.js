/**
 * Cloudflare Pages Function: /functions/send-service-request.js
 *
 * Called when a customer submits a service booking request from the
 * "Book a Service" section (no purchase required).
 * Sends an internal notification email to PC Tires via Resend.
 *
 * Environment variable required (set in Cloudflare Dashboard):
 *   RESEND_API_KEY — re_...
 */

const FROM_EMAIL    = 'bookings@pctires.ca';
const NOTIFY_EMAILS = ['calebpostma@gmail.com', 'postmacontracting@gmail.com'];

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
    const req = await request.json();
    const {
      service, customerName, customerPhone, customerEmail,
      vehicle, notes, preferredDate, preferredTime, duration, price,
    } = req;

    const resendKey = env.RESEND_API_KEY;
    if (!resendKey) {
      // Still return success so UX isn't broken — just won't send email
      console.warn('RESEND_API_KEY not set');
      return new Response(JSON.stringify({ ok: true, warn: 'Email not sent — API key missing' }), { status: 200, headers: CORS });
    }

    const subject = `[PC Tires] Service Request — ${service} — ${customerName}`;

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
      <tr><td>Service</td><td><strong>${service}</strong></td></tr>
      <tr><td>Duration</td><td>${duration} minutes</td></tr>
      <tr><td>Price</td><td>${price}</td></tr>
      <tr><td>Preferred Date</td><td>${preferredDate || '—'}</td></tr>
      <tr><td>Preferred Time</td><td>${preferredTime || '—'}</td></tr>
      <tr><td>Customer</td><td>${customerName}</td></tr>
      <tr><td>Phone</td><td><a href="tel:${customerPhone}">${customerPhone}</a></td></tr>
      <tr><td>Email</td><td>${customerEmail || '—'}</td></tr>
      <tr><td>Vehicle</td><td>${vehicle || '—'}</td></tr>
      <tr><td>Notes</td><td>${notes || '—'}</td></tr>
    </table>
  </div>
  <div class="footer">PC Tires · 7144 Grande River Line, Pain Court, ON · 519-380-5104</div>
</div>
</body>
</html>`;

    // Send to both internal addresses
    await Promise.all(NOTIFY_EMAILS.map(to =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
      })
    ));

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });

  } catch (err) {
    // Always return 200 so the UI shows success even if email fails
    console.error('send-service-request error:', err.message);
    return new Response(JSON.stringify({ ok: true, warn: err.message }), { status: 200, headers: CORS });
  }
}
