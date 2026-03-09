/**
 * Cloudflare Pages Function: /functions/send-order-email.js
 *
 * Called by the frontend after the customer completes checkout.
 * Does three things in parallel:
 *   1. Places the order with TDG Access API
 *   2. Sends a confirmation email to the customer via Resend
 *   3. Sends an internal order notification to PC Tires
 *
 * Environment variables required (set in Cloudflare Dashboard):
 *   RESEND_API_KEY  — re_LwrkevNg_...
 *   STRIPE_SECRET   — sk_live_... (for future payment verification)
 *
 * Hardcoded TDG constants (unlikely to change):
 *   TDG_SHIPPING_METHOD — TDG Delivery
 *   TDG_PAYMENT_METHOD  — Amex on account
 */

const TDG_API_BASE       = 'https://www.tdgaccess.ca/api';
const TDG_API_KEY        = 'rst715Wr18hFpHpbi346TGuMLBBQDZZbF5lHZQSi27hfpLGey3TH3YRHYWWPJRyi7rkx';
const TDG_SHIPPING_METHOD = '5E47CBB0A4659509A3DF1D4BA96E2FFB|29667'; // TDG Delivery
const TDG_PAYMENT_METHOD  = '1A0DFD32C9C2AF74B0B3A8F872BF8244|METHOD_22640'; // Amex *2004

const FROM_EMAIL   = 'orders@pctires.ca';
const NOTIFY_EMAILS = ['calebpostma@gmail.com', 'postmacontracting@gmail.com'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// ─── TDG order placement ──────────────────────────────────────────────────────
async function placeTDGOrder(order) {
  // Build products array from cart items that have a real TDG id (integer)
  const products = (order.tires || [])
    .filter(t => t.tdgId && typeof t.tdgId === 'number')
    .map(t => ({ id: t.tdgId, quantity: t.qty || 1 }));

  if (!products.length) {
    return { skipped: true, reason: 'No TDG product IDs in order — mock/fallback items only' };
  }

  const payload = {
    shippingMethod: TDG_SHIPPING_METHOD,
    paymentMethod:  TDG_PAYMENT_METHOD,
    shipComplete:   false,
    poNumber:       order.orderNumber, // use our internal order number as PO ref
    deliveryInstructions: order.appointmentDate
      ? `Customer install booked: ${order.appointmentDate} at ${order.appointmentTime}`
      : 'PC Tires online order — contact shop for install details',
    products,
  };

  const res = await fetch(`${TDG_API_BASE}/order/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `ApiKey ${TDG_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    console.error('TDG order failed:', res.status, text);
    return { error: true, status: res.status, body: data };
  }

  return data; // { order: { orderNumber, reference, currency, subtotal, shipping, tax, total } }
}

// ─── Customer confirmation email ───────────────────────────────────────────────
function buildCustomerEmail(order, tdgOrder) {
  const tdgRef = tdgOrder?.order?.orderNumber || tdgOrder?.order?.reference || null;
  const itemsHtml = (order.tires || [])
    .map(t => `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a">${t.qty}× ${t.brand} ${t.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;text-align:right">${t.size || (t.diameter + '"')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;text-align:right">$${(t.price * t.qty).toFixed(2)}</td>
    </tr>`).join('');

  const installLine = order.appointmentDate
    ? `${order.serviceName || 'Installation'} · ${order.appointmentDate} at ${order.appointmentTime}`
    : 'Not booked — we\'ll contact you to arrange';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0e0e0e;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#e0e0e0">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">

    <!-- Header -->
    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:4px;padding:28px 32px;margin-bottom:16px;text-align:center">
      <div style="font-size:28px;font-weight:900;letter-spacing:2px;color:#f5c518">PC TIRES</div>
      <div style="font-size:12px;color:#888;letter-spacing:1px;margin-top:4px">CHATHAM-KENT · 519-380-5104</div>
    </div>

    <!-- Confirmation banner -->
    <div style="background:#1a2a1a;border:1px solid #2a4a2a;border-radius:4px;padding:20px 32px;margin-bottom:16px;text-align:center">
      <div style="font-size:32px;margin-bottom:8px">✅</div>
      <div style="font-size:20px;font-weight:700;color:#4ade80">Order Confirmed!</div>
      <div style="font-size:14px;color:#888;margin-top:6px">Hi ${order.customerName?.split(' ')[0] || 'there'}, your order has been received and is being processed.</div>
    </div>

    <!-- Order details -->
    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:4px;padding:24px 32px;margin-bottom:16px">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:6px 0;color:#888;font-size:13px">Order #</td>
          <td style="padding:6px 0;text-align:right;color:#f5c518;font-weight:700;font-family:monospace">${order.orderNumber}</td>
        </tr>
        ${tdgRef ? `<tr>
          <td style="padding:6px 0;color:#888;font-size:13px">TDG Reference</td>
          <td style="padding:6px 0;text-align:right;color:#e0e0e0;font-family:monospace;font-size:13px">${tdgRef}</td>
        </tr>` : ''}
        ${order.vehicle ? `<tr>
          <td style="padding:6px 0;color:#888;font-size:13px">Vehicle</td>
          <td style="padding:6px 0;text-align:right;color:#e0e0e0">${order.vehicle}</td>
        </tr>` : ''}
      </table>
    </div>

    <!-- Items -->
    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:4px;margin-bottom:16px;overflow:hidden">
      <div style="padding:14px 24px;border-bottom:1px solid #2a2a2a;font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#888">Items Ordered</div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#1d1d1d">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#888;font-weight:600">Product</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;font-weight:600">Size</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;font-weight:600">Price</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
    </div>

    <!-- Totals -->
    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:4px;padding:20px 32px;margin-bottom:16px">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:4px 0;color:#888;font-size:13px">Subtotal</td>
          <td style="padding:4px 0;text-align:right;color:#e0e0e0">$${order.subtotal?.toFixed(2)}</td>
        </tr>
        ${order.addonTotal > 0 ? `<tr>
          <td style="padding:4px 0;color:#888;font-size:13px">Add-ons</td>
          <td style="padding:4px 0;text-align:right;color:#e0e0e0">$${order.addonTotal?.toFixed(2)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:4px 0;color:#888;font-size:13px">HST (13%)</td>
          <td style="padding:4px 0;text-align:right;color:#e0e0e0">$${order.tax?.toFixed(2)}</td>
        </tr>
        <tr style="border-top:1px solid #2a2a2a">
          <td style="padding:10px 0 4px;font-weight:700;font-size:15px;color:#fff">Total Charged</td>
          <td style="padding:10px 0 4px;text-align:right;font-weight:900;font-size:18px;color:#f5c518">$${order.total?.toFixed(2)} CAD</td>
        </tr>
      </table>
    </div>

    <!-- Installation -->
    <div style="background:#1a1a2a;border:1px solid #2a2a4a;border-radius:4px;padding:20px 32px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;margin-bottom:10px">📅 Installation</div>
      <div style="font-size:15px;color:#e0e0e0">${installLine}</div>
      <div style="font-size:12px;color:#888;margin-top:8px">PC Tires · Chatham-Kent, ON · 519-380-5104</div>
    </div>

    <!-- What's next -->
    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:4px;padding:20px 32px;margin-bottom:24px">
      <div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;margin-bottom:12px">What Happens Next</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="font-size:13px;color:#e0e0e0">📦 <strong>Your tires are being ordered</strong> from our supplier and will arrive at our shop within 1–3 business days.</div>
        <div style="font-size:13px;color:#e0e0e0">📱 <strong>We'll call or text you</strong> at ${order.customerPhone || 'the number provided'} when your tires arrive to confirm your install appointment.</div>
        <div style="font-size:13px;color:#e0e0e0">🔧 <strong>Installation takes about 60 minutes.</strong> We mount, balance, reset TPMS, and dispose of your old tires.</div>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;font-size:12px;color:#555;line-height:1.8">
      <div>PC Tires · Chatham-Kent, Ontario</div>
      <div>📞 519-380-5104 · orders@pctires.ca · pctires.ca</div>
      <div style="margin-top:8px">Questions? Just reply to this email or give us a call.</div>
    </div>

  </div>
</body>
</html>`;
}

// ─── Internal notification email ───────────────────────────────────────────────
function buildInternalEmail(order, tdgOrder, tdgError) {
  const tdgRef = tdgOrder?.order?.orderNumber || tdgOrder?.order?.reference || 'NOT PLACED';
  const tdgStatus = tdgError
    ? `❌ TDG ORDER FAILED: ${JSON.stringify(tdgError)}`
    : tdgOrder?.skipped
    ? `⚠️ SKIPPED: ${tdgOrder.reason}`
    : `✅ TDG Order: ${tdgRef}`;

  return `<!DOCTYPE html>
<html>
<body style="font-family:monospace;background:#0e0e0e;color:#e0e0e0;padding:24px">
  <h2 style="color:#f5c518">🛞 New PC Tires Order — ${order.orderNumber}</h2>
  <p style="color:${tdgError ? '#ef4444' : tdgOrder?.skipped ? '#f5c518' : '#4ade80'}">${tdgStatus}</p>
  <hr style="border-color:#2a2a2a">
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:4px 12px 4px 0;color:#888">Customer</td><td>${order.customerName}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Email</td><td>${order.customerEmail}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Phone</td><td>${order.customerPhone || '—'}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Vehicle</td><td>${order.vehicle || '—'}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Items</td><td>${(order.tires||[]).map(t=>`${t.qty}× ${t.brand} ${t.name} (${t.size||t.diameter+'"'})`).join('<br>')}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Add-ons</td><td>${order.addons || 'None'}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Total</td><td style="color:#f5c518;font-weight:bold">$${order.total?.toFixed(2)} CAD</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Install</td><td>${order.appointmentDate ? `${order.appointmentDate} at ${order.appointmentTime} — ${order.serviceName}` : 'Not booked'}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Search Method</td><td>${order.searchMethod || '—'}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">CASL Opt-in</td><td>${order.caslOptIn ? 'Yes' : 'No'}</td></tr>
  </table>
  ${tdgOrder?.order ? `<hr style="border-color:#2a2a2a"><h3 style="color:#4ade80">TDG Order Details</h3>
  <pre style="color:#e0e0e0">${JSON.stringify(tdgOrder.order, null, 2)}</pre>` : ''}
</body>
</html>`;
}

// ─── Send email via Resend ─────────────────────────────────────────────────────
async function sendEmail(resendKey, { to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Resend error: ${JSON.stringify(data)}`);
  return data;
}

// ─── Main handler ──────────────────────────────────────────────────────────────
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });
  }

  let order;
  try {
    order = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: CORS });
  }

  const RESEND_API_KEY = env.RESEND_API_KEY || 're_LwrkevNg_H9uD76w3LhTQa2sJwxNXFE6n';

  // Build vehicle string
  order.vehicle = [order.vehicleYear, order.vehicleMake, order.vehicleModel, order.vehicleTrim]
    .filter(Boolean).join(' ') || order.vehicle || '';

  // 1. Place TDG order
  let tdgOrder = null, tdgError = null;
  try {
    tdgOrder = await placeTDGOrder(order);
    if (tdgOrder.error) { tdgError = tdgOrder; tdgOrder = null; }
  } catch (e) {
    tdgError = { message: e.message };
    console.error('TDG order error:', e);
  }

  // 2. Send customer confirmation email
  const customerEmailResult = { skipped: false, error: null };
  if (order.customerEmail) {
    try {
      await sendEmail(RESEND_API_KEY, {
        to: order.customerEmail,
        subject: `✅ Order Confirmed — ${order.orderNumber} · PC Tires`,
        html: buildCustomerEmail(order, tdgOrder),
      });
    } catch (e) {
      customerEmailResult.error = e.message;
      console.error('Customer email error:', e);
    }
  }

  // 3. Send internal notification
  try {
    await sendEmail(RESEND_API_KEY, {
      to: NOTIFY_EMAILS,
      subject: `🛞 New Order ${order.orderNumber}${tdgError ? ' ⚠️ TDG FAILED' : ''} — ${order.customerName}`,
      html: buildInternalEmail(order, tdgOrder, tdgError),
    });
  } catch (e) {
    console.error('Internal email error:', e);
  }

  // Return result
  return new Response(JSON.stringify({
    success: true,
    orderNumber: order.orderNumber,
    tdg: tdgOrder?.order || null,
    tdgError: tdgError || null,
    tdgSkipped: tdgOrder?.skipped || false,
  }), { status: 200, headers: CORS });
}
