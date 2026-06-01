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

// ─── Dedup cache ───────────────────────────────────────────────────────────────
// Keyed by paymentIntentId (or orderNumber as fallback). Entries expire after 10
// minutes. Prevents a duplicate TDG order if the frontend posts the same order
// twice — e.g. customer hits "Place order" twice, or a network retry happens
// after the server-side call already succeeded.
//
// Note: this runs per isolate, so a cold-started second invocation on a
// different isolate would still miss. Main guarantees come from:
//   1. Frontend in-flight lock (index.html)
//   2. Stripe Idempotency-Key on PaymentIntent creation (create-pi.js)
//   3. This cache catches the middle case where the browser retries a POST
const RECENT_ORDERS = new Map(); // key -> { at: timestamp, result: response }
const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function checkDedup(key) {
  if (!key) return null;
  const entry = RECENT_ORDERS.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > DEDUP_WINDOW_MS) {
    RECENT_ORDERS.delete(key);
    return null;
  }
  return entry.result;
}

function recordDedup(key, result) {
  if (!key) return;
  RECENT_ORDERS.set(key, { at: Date.now(), result });
  // Lazy cleanup: if cache grows past 100 entries, drop the oldest.
  if (RECENT_ORDERS.size > 100) {
    const oldest = [...RECENT_ORDERS.entries()].sort((a,b) => a[1].at - b[1].at)[0];
    if (oldest) RECENT_ORDERS.delete(oldest[0]);
  }
}

// ─── MD5 hash (pure JS, needed for orderHash — Web Crypto doesn't support MD5) ─
function md5(string) {
  function cmn(q,a,b,x,s,t){a=(((a+q)>>>0)+((x+t)>>>0))>>>0;return((((a<<s)|(a>>>(32-s)))>>>0)+b)>>>0;}
  function ff(a,b,c,d,x,s,t){return cmn((b&c)|((~b)&d),a,b,x,s,t);}
  function gg(a,b,c,d,x,s,t){return cmn((b&d)|(c&(~d)),a,b,x,s,t);}
  function hh(a,b,c,d,x,s,t){return cmn(b^c^d,a,b,x,s,t);}
  function ii(a,b,c,d,x,s,t){return cmn(c^(b|(~d)),a,b,x,s,t);}
  // Convert string to byte array (UTF-8)
  const bytes=[];
  for(let i=0;i<string.length;i++){
    const c=string.charCodeAt(i);
    if(c<128)bytes.push(c);
    else if(c<2048){bytes.push((c>>6)|192);bytes.push((c&63)|128);}
    else{bytes.push((c>>12)|224);bytes.push(((c>>6)&63)|128);bytes.push((c&63)|128);}
  }
  // Pad message
  const n=bytes.length;
  bytes.push(0x80);
  while(bytes.length%64!==56)bytes.push(0);
  const bits=n*8;
  bytes.push(bits&0xff,(bits>>>8)&0xff,(bits>>>16)&0xff,(bits>>>24)&0xff,0,0,0,0);
  // Process blocks
  let a=0x67452301,b=0xEFCDAB89,c=0x98BADCFE,d=0x10325476;
  for(let i=0;i<bytes.length;i+=64){
    const w=[];
    for(let j=0;j<16;j++){const o=i+j*4;w[j]=bytes[o]|(bytes[o+1]<<8)|(bytes[o+2]<<16)|(bytes[o+3]<<24);}
    const oa=a,ob=b,oc=c,od=d;
    a=ff(a,b,c,d,w[0],7,0xD76AA478);d=ff(d,a,b,c,w[1],12,0xE8C7B756);c=ff(c,d,a,b,w[2],17,0x242070DB);b=ff(b,c,d,a,w[3],22,0xC1BDCEEE);
    a=ff(a,b,c,d,w[4],7,0xF57C0FAF);d=ff(d,a,b,c,w[5],12,0x4787C62A);c=ff(c,d,a,b,w[6],17,0xA8304613);b=ff(b,c,d,a,w[7],22,0xFD469501);
    a=ff(a,b,c,d,w[8],7,0x698098D8);d=ff(d,a,b,c,w[9],12,0x8B44F7AF);c=ff(c,d,a,b,w[10],17,0xFFFF5BB1);b=ff(b,c,d,a,w[11],22,0x895CD7BE);
    a=ff(a,b,c,d,w[12],7,0x6B901122);d=ff(d,a,b,c,w[13],12,0xFD987193);c=ff(c,d,a,b,w[14],17,0xA679438E);b=ff(b,c,d,a,w[15],22,0x49B40821);
    a=gg(a,b,c,d,w[1],5,0xF61E2562);d=gg(d,a,b,c,w[6],9,0xC040B340);c=gg(c,d,a,b,w[11],14,0x265E5A51);b=gg(b,c,d,a,w[0],20,0xE9B6C7AA);
    a=gg(a,b,c,d,w[5],5,0xD62F105D);d=gg(d,a,b,c,w[10],9,0x02441453);c=gg(c,d,a,b,w[15],14,0xD8A1E681);b=gg(b,c,d,a,w[4],20,0xE7D3FBC8);
    a=gg(a,b,c,d,w[9],5,0x21E1CDE6);d=gg(d,a,b,c,w[14],9,0xC33707D6);c=gg(c,d,a,b,w[3],14,0xF4D50D87);b=gg(b,c,d,a,w[8],20,0x455A14ED);
    a=gg(a,b,c,d,w[13],5,0xA9E3E905);d=gg(d,a,b,c,w[2],9,0xFCEFA3F8);c=gg(c,d,a,b,w[7],14,0x676F02D9);b=gg(b,c,d,a,w[12],20,0x8D2A4C8A);
    a=hh(a,b,c,d,w[5],4,0xFFFA3942);d=hh(d,a,b,c,w[8],11,0x8771F681);c=hh(c,d,a,b,w[11],16,0x6D9D6122);b=hh(b,c,d,a,w[14],23,0xFDE5380C);
    a=hh(a,b,c,d,w[1],4,0xA4BEEA44);d=hh(d,a,b,c,w[4],11,0x4BDECFA9);c=hh(c,d,a,b,w[7],16,0xF6BB4B60);b=hh(b,c,d,a,w[10],23,0xBEBFBC70);
    a=hh(a,b,c,d,w[13],4,0x289B7EC6);d=hh(d,a,b,c,w[0],11,0xEAA127FA);c=hh(c,d,a,b,w[3],16,0xD4EF3085);b=hh(b,c,d,a,w[6],23,0x04881D05);
    a=hh(a,b,c,d,w[9],4,0xD9D4D039);d=hh(d,a,b,c,w[12],11,0xE6DB99E5);c=hh(c,d,a,b,w[15],16,0x1FA27CF8);b=hh(b,c,d,a,w[2],23,0xC4AC5665);
    a=ii(a,b,c,d,w[0],6,0xF4292244);d=ii(d,a,b,c,w[7],10,0x432AFF97);c=ii(c,d,a,b,w[14],15,0xAB9423A7);b=ii(b,c,d,a,w[5],21,0xFC93A039);
    a=ii(a,b,c,d,w[12],6,0x655B59C3);d=ii(d,a,b,c,w[3],10,0x8F0CCC92);c=ii(c,d,a,b,w[10],15,0xFFEFF47D);b=ii(b,c,d,a,w[1],21,0x85845DD1);
    a=ii(a,b,c,d,w[8],6,0x6FA87E4F);d=ii(d,a,b,c,w[15],10,0xFE2CE6E0);c=ii(c,d,a,b,w[6],15,0xA3014314);b=ii(b,c,d,a,w[13],21,0x4E0811A1);
    a=ii(a,b,c,d,w[4],6,0xF7537E82);d=ii(d,a,b,c,w[11],10,0xBD3AF235);c=ii(c,d,a,b,w[2],15,0x2AD7D2BB);b=ii(b,c,d,a,w[9],21,0xEB86D391);
    a=(a+oa)>>>0;b=(b+ob)>>>0;c=(c+oc)>>>0;d=(d+od)>>>0;
  }
  const hex=x=>{let s='';for(let i=0;i<4;i++)s+=('0'+((x>>>(i*8))&0xFF).toString(16)).slice(-2);return s;};
  return hex(a)+hex(b)+hex(c)+hex(d);
}

// ─── TDG order hash ─────────────────────────────────────────────────────────
function computeOrderHash(products) {
  // 1. Get unique product IDs, sort numerically smallest → largest
  const ids = [...new Set(products.map(p => p.id))].sort((a, b) => a - b);
  // 2. Prepend API key, join with pipes
  const input = TDG_API_KEY + '|' + ids.join('|');
  // 3. MD5 hash, lowercase
  return md5(input);
}

// ─── TDG order placement ────────────────────────────────────────────────────
async function placeTDGOrder(order) {
  const products = (order.tires || [])
    .filter(t => t.tdgId && typeof t.tdgId === 'number')
    .map(t => ({ id: t.tdgId, quantity: t.qty || 1 }));

  if (!products.length) {
    return { skipped: true, reason: 'No TDG product IDs in order — mock/fallback items only' };
  }

  const orderHash = computeOrderHash(products);

  const payload = {
    orderHash,
    shippingMethod: TDG_SHIPPING_METHOD,
    paymentMethod:  TDG_PAYMENT_METHOD,
    shipComplete:   true,
    poNumber:       order.orderNumber,
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

  return data;
}

// ─── Extract TDG order reference from response (handles multiple shapes) ──
// TDG's /order/create response shape isn't fully documented. Empirically we've
// seen the order go through successfully but the reference nested under
// different keys. This tries common paths in order of likelihood.
function extractTDGRef(tdgOrder) {
  if (!tdgOrder || tdgOrder.skipped || tdgOrder.error) return null;
  const candidates = [
    tdgOrder?.order?.orderNumber,      // original expected shape
    tdgOrder?.order?.reference,
    tdgOrder?.orderNumber,              // flat
    tdgOrder?.reference,
    tdgOrder?.orderId,
    tdgOrder?.salesOrder,
    tdgOrder?.salesOrderNumber,
    tdgOrder?.data?.orderNumber,        // wrapped in data
    tdgOrder?.data?.reference,
    tdgOrder?.result?.orderNumber,      // wrapped in result
    tdgOrder?.result?.reference,
    tdgOrder?.order?.id,
    tdgOrder?.id,
  ];
  for (const c of candidates) {
    if (c && typeof c !== 'object') return String(c);
  }
  return null;
}

// ─── Customer confirmation email ───────────────────────────────────────────────
function buildCustomerEmail(order, tdgOrder) {
  const tdgRef = extractTDGRef(tdgOrder);
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
      <div style="font-size:12px;color:#888;letter-spacing:1px;margin-top:4px">CHATHAM-KENT · 519-397-4686</div>
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
        ${order.discount && Number(order.discount) > 0 ? `<tr>
          <td style="padding:4px 0;color:#22c55e;font-size:13px">Discount${order.discountCode ? ` (${order.discountCode})` : ''}</td>
          <td style="padding:4px 0;text-align:right;color:#22c55e">-$${Number(order.discount).toFixed(2)}</td>
        </tr>` : ''}
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
      <div style="font-size:12px;color:#888;margin-top:8px">PC Tires · Chatham-Kent, ON · 519-397-4686</div>
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
      <div>📞 519-397-4686 · orders@pctires.ca · pctires.ca</div>
      <div style="margin-top:8px">Questions? Just reply to this email or give us a call.</div>
    </div>

  </div>
</body>
</html>`;
}

// ─── Internal notification email ───────────────────────────────────────────────
function buildInternalEmail(order, tdgOrder, tdgError) {
  const tdgRef = extractTDGRef(tdgOrder) || 'NOT FOUND';
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
    ${order.discount && Number(order.discount) > 0 ? `<tr><td style="padding:4px 12px 4px 0;color:#888">Discount</td><td style="color:#22c55e">-$${Number(order.discount).toFixed(2)}${order.discountCode ? ` (${order.discountCode})` : ''}</td></tr>` : ''}
    <tr><td style="padding:4px 12px 4px 0;color:#888">Total</td><td style="color:#f5c518;font-weight:bold">$${order.total?.toFixed(2)} CAD</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Install</td><td>${order.appointmentDate ? `${order.appointmentDate} at ${order.appointmentTime} — ${order.serviceName}` : 'Not booked'}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Search Method</td><td>${order.searchMethod || '—'}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">CASL Opt-in</td><td>${order.caslOptIn ? 'Yes' : 'No'}</td></tr>
  </table>
  ${tdgOrder && !tdgOrder.skipped && !tdgError ? `<hr style="border-color:#2a2a2a"><h3 style="color:#4ade80">Raw TDG Response</h3>
  <pre style="color:#e0e0e0;background:#1a1a1a;padding:12px;border-radius:4px;overflow:auto">${JSON.stringify(tdgOrder, null, 2)}</pre>` : ''}
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

  // ── Dedup check: if we've already processed this paymentIntentId (or orderNumber
  // as fallback) within the last 10 minutes, return the previous result instead of
  // placing another TDG order or sending another set of emails.
  const dedupKey = order.paymentIntentId || order.orderNumber || null;
  const existing = checkDedup(dedupKey);
  if (existing) {
    console.log('Duplicate order suppressed for key:', dedupKey);
    return new Response(JSON.stringify({ ...existing, duplicate: true }), {
      status: 200, headers: CORS,
    });
  }

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
  const result = {
    success: true,
    orderNumber: order.orderNumber,
    tdg: tdgOrder?.order || null,
    tdgError: tdgError || null,
    tdgSkipped: tdgOrder?.skipped || false,
  };
  // Cache the result so a repeat POST with the same paymentIntentId returns
  // the same response instead of re-placing the TDG order.
  recordDedup(dedupKey, result);
  return new Response(JSON.stringify(result), { status: 200, headers: CORS });
}
