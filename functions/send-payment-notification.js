/**
 * Cloudflare Pages Function: /functions/send-payment-notification.js
 *
 * Called after a successful invoice payment on /pay.
 * Sends two emails:
 *   1. Internal notification to PC Tires (calebpostma + postmacontracting)
 *   2. Branded receipt to the customer (if customerEmail provided)
 *
 * Environment variable required (already set in Cloudflare):
 *   RESEND_API_KEY - re_...
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

// --- Internal notification email (to Caleb) -------------------------------
// Ontario First Nations point-of-sale exemption: the five fields the province
// requires on the record, plus the tax breakdown, rendered only when the
// payment came through /statuspay. Ordinary /pay notifications are untouched.
function statusBlocks(p) {
  if (p.statusExempt !== true) return { rows: '', audit: '' };
  const m = n => '$' + Number(n || 0).toFixed(2);
  const dateStr = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const rows = `
      <tr><td>Order #</td><td>${esc(p.orderNumber) || '&mdash;'}</td></tr>
      <tr><td>Subtotal before tax</td><td>${m(p.pretax)}</td></tr>
      <tr><td>HST (13%)</td><td>${m(p.hst)}</td></tr>
      <tr><td>Less Ontario First Nations relief (8%)</td><td>&minus;${m(p.relief)}</td></tr>
      <tr><td>GST payable (5%)</td><td>${m(p.gst)}</td></tr>
      <tr><td>Order total</td><td><strong>${m(p.newTotal)}</strong></td></tr>
      ${Number(p.depositPaid) > 0 ? `<tr><td>Less deposit already paid</td><td>${m(p.depositPaid)}</td></tr>` : ''}
      <tr><td>Balance paid now</td><td><strong>${m(p.amount)}</strong></td></tr>`;
  const audit = `
    <div style="border:2px solid #111;border-radius:4px;padding:16px 18px;margin-top:22px">
      <div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#555;border-bottom:1px solid #e5e5e5;padding-bottom:6px;margin-bottom:10px">First Nations Exemption &mdash; Audit Record</div>
      <table>
        <tr><td>Purchase date</td><td>${esc(dateStr)}</td></tr>
        <tr><td>Customer name</td><td>${esc(p.statusName) || '&mdash;'}</td></tr>
        <tr><td>Status card #</td><td style="font-family:monospace">${esc(p.statusCard) || '&mdash;'}</td></tr>
        <tr><td>Band registry #</td><td style="font-family:monospace">${esc(p.statusBand) || '&mdash;'}</td></tr>
        <tr><td>Goods / services</td><td>${esc(p.goods) || esc(p.description) || 'Tires and installation'}</td></tr>
      </table>
      <div style="font-size:11.5px;color:#555;margin-top:11px;line-height:1.5">
        Report the full HST of <strong>${m(p.hst)}</strong> on line 105 of the HST return
        and claim the <strong>${m(p.relief)}</strong> credited here back on line 111.
        Keep this sheet for audit.
      </div>
    </div>`;
  return { rows, audit };
}

function buildInternalEmail(p) {
  const amt = Number(p.amount).toFixed(2);
  const sb = statusBlocks(p);
  return `<!DOCTYPE html>
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
  @media print {
    body{background:#fff;padding:0}
    .card{box-shadow:none;border:1px solid #ccc;max-width:none}
    td:first-child{color:#555}
    div[style*="border:2px solid"]{break-inside:avoid;page-break-inside:avoid}
  }
</style></head>
<body>
<div class="card">
  <div class="header">
    <div class="logo">PC TIRES</div>
    <div class="header-sub">Payment Received</div>
  </div>
  <div class="body">
    <div class="alert">&#x1F4B0; ${esc(p.customerName) || 'A customer'} paid $${esc(amt)}${p.statusExempt === true ? ' via /statuspay &mdash; STATUS CARD, 5% GST.' : ' via /pay.'}</div>
    <table>
      <tr><td>Amount</td><td><span class="amount">$${esc(amt)} ${esc(p.currency || 'CAD')}</span></td></tr>
      ${p.invoiceNumber ? `<tr><td>Invoice #</td><td>${esc(p.invoiceNumber)}</td></tr>` : ''}
      <tr><td>Description</td><td>${esc(p.description) || '&mdash;'}</td></tr>
      <tr><td>Customer</td><td>${esc(p.customerName) || '&mdash;'}</td></tr>
      <tr><td>Email</td><td>${p.customerEmail ? `<a href="mailto:${esc(p.customerEmail)}">${esc(p.customerEmail)}</a>` : '&mdash;'}</td></tr>
      <tr><td>Phone</td><td>${p.customerPhone ? `<a href="tel:${esc(p.customerPhone)}">${esc(p.customerPhone)}</a>` : '&mdash;'}</td></tr>
      <tr><td>Stripe Payment</td><td style="font-family:monospace;font-size:12px">${esc(p.paymentIntentId) || '&mdash;'}</td></tr>
      ${p.notes ? `<tr><td>Notes</td><td>${esc(p.notes)}</td></tr>` : ''}
      ${sb.rows}
    </table>
    ${sb.audit}
  </div>
  <div class="footer">PC Tires &middot; 7144 Grande River Line, Pain Court, ON &middot; 519-397-4686</div>
</div>
</body>
</html>`;
}

// --- Customer receipt email (to customer) ---------------------------------
function buildCustomerReceipt(p) {
  const amt = Number(p.amount).toFixed(2);
  const firstName = (p.customerName || '').split(' ')[0] || 'there';
  const dateStr = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0e0e0e;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#e0e0e0">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">

    <!-- Header -->
    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:4px;padding:28px 32px;margin-bottom:16px;text-align:center">
      <div style="font-size:28px;font-weight:900;letter-spacing:2px;color:#f5c518">PC TIRES</div>
      <div style="font-size:12px;color:#888;letter-spacing:1px;margin-top:4px">CHATHAM-KENT &middot; 519-397-4686</div>
    </div>

    <!-- Confirmation banner -->
    <div style="background:#1a2a1a;border:1px solid #2a4a2a;border-radius:4px;padding:20px 32px;margin-bottom:16px;text-align:center">
      <div style="font-size:32px;margin-bottom:8px">&#x2705;</div>
      <div style="font-size:20px;font-weight:700;color:#4ade80">Payment Received</div>
      <div style="font-size:14px;color:#888;margin-top:6px">Thanks, ${esc(firstName)} &mdash; your payment has been processed.</div>
    </div>

    <!-- Amount -->
    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:4px;padding:24px 32px;margin-bottom:16px;text-align:center">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin-bottom:8px;font-weight:700">Amount Paid</div>
      <div style="font-size:42px;font-weight:900;color:#f5c518;line-height:1">$${esc(amt)} <span style="font-size:18px;color:#888;font-weight:600">${esc(p.currency || 'CAD')}</span></div>
    </div>

    <!-- Details -->
    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:4px;padding:20px 32px;margin-bottom:16px">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a">Date</td>
          <td style="padding:8px 0;text-align:right;color:#e0e0e0;border-bottom:1px solid #2a2a2a">${esc(dateStr)}</td>
        </tr>
        ${p.invoiceNumber ? `<tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a">Reference</td>
          <td style="padding:8px 0;text-align:right;color:#f5c518;font-family:monospace;font-weight:700;border-bottom:1px solid #2a2a2a">${esc(p.invoiceNumber)}</td>
        </tr>` : ''}
        ${p.description ? `<tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a">Description</td>
          <td style="padding:8px 0;text-align:right;color:#e0e0e0;border-bottom:1px solid #2a2a2a">${esc(p.description)}</td>
        </tr>` : ''}
        ${p.customerName ? `<tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a">Paid by</td>
          <td style="padding:8px 0;text-align:right;color:#e0e0e0;border-bottom:1px solid #2a2a2a">${esc(p.customerName)}</td>
        </tr>` : ''}
        ${p.statusExempt === true ? `<tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a">Subtotal before tax</td>
          <td style="padding:8px 0;text-align:right;color:#e0e0e0;border-bottom:1px solid #2a2a2a">$${Number(p.pretax || 0).toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a">HST (13%)</td>
          <td style="padding:8px 0;text-align:right;color:#e0e0e0;border-bottom:1px solid #2a2a2a">$${Number(p.hst || 0).toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a">Less Ontario First Nations relief (8%)</td>
          <td style="padding:8px 0;text-align:right;color:#4ade80;border-bottom:1px solid #2a2a2a">&minus;$${Number(p.relief || 0).toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a">GST payable (5%)</td>
          <td style="padding:8px 0;text-align:right;color:#e0e0e0;border-bottom:1px solid #2a2a2a">$${Number(p.gst || 0).toFixed(2)}</td>
        </tr>
        ${Number(p.depositPaid) > 0 ? `<tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a">Deposit already paid</td>
          <td style="padding:8px 0;text-align:right;color:#4ade80;border-bottom:1px solid #2a2a2a">$${Number(p.depositPaid).toFixed(2)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a">Status card</td>
          <td style="padding:8px 0;text-align:right;color:#e0e0e0;font-family:monospace;border-bottom:1px solid #2a2a2a">${esc(p.statusCard)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px">Payment ID</td>
          <td style="padding:8px 0;text-align:right;color:#888;font-family:monospace;font-size:11px">${esc(p.paymentIntentId) || '&mdash;'}</td>
        </tr>
      </table>
    </div>

    <!-- Thank you -->
    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:4px;padding:20px 32px;margin-bottom:24px;text-align:center">
      <div style="font-size:14px;color:#e0e0e0;line-height:1.6">Thanks for your business. Keep this email as your receipt.<br>Questions about the work or your invoice? Just reply or give us a call.</div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;font-size:12px;color:#555;line-height:1.8">
      <div>PC Tires &middot; 7144 Grande River Line, Pain Court, ON N0P 1Z0</div>
      <div>&#x1F4DE; 519-397-4686 &middot; payments@pctires.ca &middot; pctires.ca</div>
    </div>

  </div>
</body>
</html>`;
}

// --- Send via Resend -------------------------------------------------------
async function sendEmail(resendKey, { to, subject, html, replyTo }) {
  const body = { from: FROM_EMAIL, to, subject, html };
  if (replyTo) body.reply_to = replyTo;
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// --- Main handler ----------------------------------------------------------
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST')   return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });

  try {
    const req = await request.json();
    const { amount, customerName, customerEmail, invoiceNumber } = req;

    const resendKey = env.RESEND_API_KEY;
    if (!resendKey) {
      console.warn('RESEND_API_KEY not set');
      return new Response(JSON.stringify({ ok: true, warn: 'Email not sent - API key missing' }), { status: 200, headers: CORS });
    }

    const amtStr = Number(amount).toFixed(2);

    // 1) Internal notification (always)
    const internalSubject = req.statusExempt === true
      ? `[PC Tires] STATUS CARD Payment - $${amtStr} - ${customerName || 'Customer'}${req.orderNumber ? ' - ' + req.orderNumber : ''}`
      : `[PC Tires] Payment Received - $${amtStr} - ${customerName || 'Customer'}`;
    const internalHtml = buildInternalEmail(req);
    const sends = NOTIFY_EMAILS.map(to => sendEmail(resendKey, {
      to, subject: internalSubject, html: internalHtml,
      replyTo: customerEmail || undefined,
    }));

    // 2) Customer receipt (if valid email provided)
    let customerSent = false;
    if (customerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      const customerSubject = `Payment Received${invoiceNumber ? ' - ' + invoiceNumber : ''} - PC Tires`;
      const customerHtml = buildCustomerReceipt(req);
      sends.push(sendEmail(resendKey, {
        to: customerEmail, subject: customerSubject, html: customerHtml,
        replyTo: 'payments@pctires.ca',
      }));
      customerSent = true;
    }

    await Promise.all(sends);

    return new Response(JSON.stringify({ ok: true, customerReceiptSent: customerSent }), { status: 200, headers: CORS });

  } catch (err) {
    console.error('send-payment-notification error:', err.message);
    return new Response(JSON.stringify({ ok: true, warn: err.message }), { status: 200, headers: CORS });
  }
}