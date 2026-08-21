/**
 * Shared order-processing core: /functions/order-core.js
 *
 * Single source of truth for placing a TDG order + sending Resend emails.
 * Imported by BOTH:
 *   - send-order-email.js   (client-side path: browser posts after inline card success)
 *   - stripe-webhook.js     (durable path: Stripe tells us payment_intent.succeeded)
 *
 * Dedup is now DURABLE via KV (binding: ORDERS_KV, namespace PC_TIRES_ORDERS),
 * keyed by paymentIntentId. Either path can run first; whichever wins records a
 * `done:<key>` marker so the other becomes a no-op. Falls back to an in-memory
 * Map if the KV binding isn't present (e.g. local dev).
 *
 * Environment variables / bindings used:
 *   RESEND_API_KEY  — Resend secret
 *   TDG_API_KEY     — TDG Access API key
 *   ORDERS_KV       — KV namespace binding (PC_TIRES_ORDERS)   [optional but recommended]
 *   SKIP_TDG        — '1' to skip live TDG placement (test mode)
 */

import { findLug } from './tech-lugnut-db.js';

const TDG_API_BASE        = 'https://www.tdgaccess.ca/api';
const TDG_SHIPPING_METHOD = '5E47CBB0A4659509A3DF1D4BA96E2FFB|29667'; // TDG Delivery
const TDG_PAYMENT_METHOD   = '1A0DFD32C9C2AF74B0B3A8F872BF8244|METHOD_22640'; // Amex *2004

const FROM_EMAIL    = 'orders@pctires.ca';
const NOTIFY_EMAILS = ['calebpostma@gmail.com', 'postmacontracting@gmail.com'];

// ─── Durable dedup (KV, with in-memory fallback) ───────────────────────────────
const INMEM_DONE = new Map();          // key -> { at, result }
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h — matches KV TTL

async function checkDone(env, key) {
  if (!key) return null;
  if (env && env.ORDERS_KV) {
    try {
      const v = await env.ORDERS_KV.get('done:' + key);
      if (v) return JSON.parse(v);
    } catch (e) { /* fall through to in-memory */ }
  }
  const entry = INMEM_DONE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > DEDUP_WINDOW_MS) { INMEM_DONE.delete(key); return null; }
  return entry.result;
}

async function recordDone(env, key, result) {
  if (!key) return;
  if (env && env.ORDERS_KV) {
    try { await env.ORDERS_KV.put('done:' + key, JSON.stringify(result), { expirationTtl: 86400 }); }
    catch (e) { /* keep in-memory copy at least */ }
  }
  INMEM_DONE.set(key, { at: Date.now(), result });
  if (INMEM_DONE.size > 100) {
    const oldest = [...INMEM_DONE.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) INMEM_DONE.delete(oldest[0]);
  }
}

// ─── MD5 hash (pure JS, needed for orderHash — Web Crypto doesn't support MD5) ─
function md5(string) {
  function cmn(q,a,b,x,s,t){a=(((a+q)>>>0)+((x+t)>>>0))>>>0;return((((a<<s)|(a>>>(32-s)))>>>0)+b)>>>0;}
  function ff(a,b,c,d,x,s,t){return cmn((b&c)|((~b)&d),a,b,x,s,t);}
  function gg(a,b,c,d,x,s,t){return cmn((b&d)|(c&(~d)),a,b,x,s,t);}
  function hh(a,b,c,d,x,s,t){return cmn(b^c^d,a,b,x,s,t);}
  function ii(a,b,c,d,x,s,t){return cmn(c^(b|(~d)),a,b,x,s,t);}
  const bytes=[];
  for(let i=0;i<string.length;i++){
    const c=string.charCodeAt(i);
    if(c<128)bytes.push(c);
    else if(c<2048){bytes.push((c>>6)|192);bytes.push((c&63)|128);}
    else{bytes.push((c>>12)|224);bytes.push(((c>>6)&63)|128);bytes.push((c&63)|128);}
  }
  const n=bytes.length;
  bytes.push(0x80);
  while(bytes.length%64!==56)bytes.push(0);
  const bits=n*8;
  bytes.push(bits&0xff,(bits>>>8)&0xff,(bits>>>16)&0xff,(bits>>>24)&0xff,0,0,0,0);
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
function computeOrderHash(products, tdgApiKey) {
  const ids = [...new Set(products.map(p => p.id))].sort((a, b) => a - b);
  const input = tdgApiKey + '|' + ids.join('|');
  return md5(input);
}

// ─── TDG order placement ────────────────────────────────────────────────────
async function placeTDGOrder(order, tdgApiKey) {
  const products = (order.tires || [])
    .filter(t => t.tdgId && typeof t.tdgId === 'number')
    .map(t => ({ id: t.tdgId, quantity: t.qty || 1 }));

  if (!products.length) {
    return { skipped: true, reason: 'No TDG product IDs in order — mock/fallback items only' };
  }

  const orderHash = computeOrderHash(products, tdgApiKey);

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
      'Authorization': `ApiKey ${tdgApiKey}`,
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
function extractTDGRef(tdgOrder) {
  if (!tdgOrder || tdgOrder.skipped || tdgOrder.error) return null;
  const candidates = [
    tdgOrder?.order?.orderNumber,
    tdgOrder?.order?.reference,
    tdgOrder?.orderNumber,
    tdgOrder?.reference,
    tdgOrder?.orderId,
    tdgOrder?.salesOrder,
    tdgOrder?.salesOrderNumber,
    tdgOrder?.data?.orderNumber,
    tdgOrder?.data?.reference,
    tdgOrder?.result?.orderNumber,
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
          <td style="padding:10px 0 4px;font-weight:700;font-size:15px;color:#fff">${order.depositPaid > 0 ? 'Order Total' : 'Total Charged'}</td>
          <td style="padding:10px 0 4px;text-align:right;font-weight:900;font-size:18px;color:#f5c518">$${order.total?.toFixed(2)} CAD</td>
        </tr>
        ${order.depositPaid > 0 ? `<tr>
          <td style="padding:6px 0 0;font-weight:700;font-size:14px;color:#22c55e">Deposit Paid Today</td>
          <td style="padding:6px 0 0;text-align:right;font-weight:800;font-size:15px;color:#22c55e">$${Number(order.depositPaid).toFixed(2)} CAD</td>
        </tr>
        <tr>
          <td style="padding:4px 0 0;font-weight:700;font-size:14px;color:#fff">Balance Due at Installation</td>
          <td style="padding:4px 0 0;text-align:right;font-weight:800;font-size:15px;color:#f5c518">$${Number(order.balanceDue).toFixed(2)} CAD</td>
        </tr>
        <tr><td colspan="2" style="padding:6px 0 0;font-size:12px;color:#888">Pay the balance by e-transfer, card, or cash when your tires are installed.</td></tr>` : ''}
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
    ? `FAILED &mdash; TDG order did not go through: ${JSON.stringify(tdgError)}`
    : tdgOrder?.skipped
    ? `SKIPPED &mdash; ${tdgOrder.reason}`
    : `TDG Order placed: ${tdgRef}`;
  const tdgColor = tdgError ? '#b91c1c' : tdgOrder?.skipped ? '#a16207' : '#15803d';

  const t = (!tdgError && tdgOrder && !tdgOrder.skipped) ? tdgOrder : null;
  const cost = t ? {
    subtotal: Number(t.subtotal || 0),
    shipping: Number(t.shipping || 0),
    fees:     Number(t.fees || 0),
    tax:      Number(t.tax || 0),
    total:    Number(t.total || 0),
    currency: t.currency || 'CAD',
    orderNum: t.orderNumber || '-',
    ref:      t.reference || '-',
  } : null;

  const margin = (cost && order.total) ? (Number(order.total) - cost.total) : null;
  const marginPct = (margin !== null && order.total) ? Math.round((margin / Number(order.total)) * 100) : null;

  const money = n => `$${Number(n).toFixed(2)}`;

  // ── Order date ──────────────────────────────────────────────────────────
  // Prefer the date the browser stamped on the order; fall back to now, in
  // Eastern time so it always matches shop time rather than UTC.
  let orderDateStr = '';
  let orderDateShort = '';
  try {
    const d = order.orderDate ? new Date(order.orderDate) : new Date();
    const valid = !isNaN(d.getTime()) ? d : new Date();
    orderDateStr = valid.toLocaleString('en-CA', {
      timeZone: 'America/Toronto',
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
    orderDateShort = valid.toLocaleDateString('en-CA', {
      timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
    });
  } catch (e) {
    orderDateStr = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    orderDateShort = new Date().toISOString().slice(0, 10);
  }

  const itemsHtml = (order.tires || [])
    .map(t => `${t.qty}&times; ${t.brand} ${t.name} <span style="color:#555">(${t.size || (t.diameter + '\"')})</span>`)
    .join('<br>');

  // Plain-text goods description — one of the five fields Ontario requires on
  // the record for a First Nations point-of-sale exemption.
  const goodsDesc = (order.tires || [])
    .map(t => `${t.qty}x ${t.brand} ${t.name} ${t.size || (t.diameter + '"')}`)
    .join('; ') || 'Tires';

  const phoneDigits = String(order.customerPhone || '').replace(/\D/g, '');

  // ── Print-friendly palette ──────────────────────────────────────────────
  const cardStyle = 'background:#ffffff;border:1px solid #cccccc;border-radius:4px;padding:14px 18px;margin-bottom:12px';
  const hdrStyle  = 'font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555555;margin-bottom:9px;font-weight:700;border-bottom:1px solid #e5e5e5;padding-bottom:5px';
  const rowLbl    = 'padding:5px 0;color:#555555;width:52%;font-size:13px';
  const rowVal    = 'padding:5px 0;text-align:right;color:#111111;font-size:13px;font-weight:600';

  const lugSpec = (order.vehicleYear && order.vehicleMake && order.vehicleModel)
    ? findLug({ year: order.vehicleYear, make: order.vehicleMake, model: order.vehicleModel })
    : null;
  let lugRowHtml = '';
  if (order.vehicle) {
    if (lugSpec) {
      const specTxt = [lugSpec.thread, lugSpec.hexMm ? lugSpec.hexMm + 'mm hex' : null, lugSpec.seat, lugSpec.type].filter(Boolean).join(' &middot; ');
      const badge = lugSpec.kit
        ? '<span style="color:#15803d;font-size:11px;font-weight:700;margin-left:6px">IN STOCK &middot; ' + lugSpec.kit + '</span>'
        : '<span style="border:1px solid #b91c1c;color:#b91c1c;font-size:11px;font-weight:700;padding:1px 5px;border-radius:3px;margin-left:6px">NOT IN LUG STOCK</span>';
      lugRowHtml = '<tr><td style="' + rowLbl + '">Lug Spec</td><td style="' + rowVal + '">' + specTxt + badge + '</td></tr>'
        + (lugSpec.note ? '<tr><td></td><td style="padding:0 0 5px;text-align:right;color:#555;font-size:11px;font-weight:400">' + lugSpec.note + '</td></tr>' : '');
    } else {
      lugRowHtml = '<tr><td style="' + rowLbl + '">Lug Spec</td><td style="' + rowVal + ';color:#555;font-weight:400">Unknown &mdash; check at write-up</td></tr>';
    }
  }

  // Everything the customer is charged before tax: tires + install + add-ons,
  // less any promo discount. This is the line the HST is calculated on.
  const preTaxSubtotal = Number(order.subtotal || 0)
                       + Number(order.installTotal || 0)
                       + Number(order.addonTotal || 0)
                       - Number(order.discount || 0);

  // ── Tax line: 13% HST normally, 5% GST on a verified status exemption ────
  const isStatusExempt = order.statusExempt === true || order.statusExempt === 'true';
  const taxRatePct = isStatusExempt ? '5' : (order.taxRatePct || '13');
  const taxLabel = isStatusExempt ? `GST (${taxRatePct}%) &mdash; status exempt` : `HST (${taxRatePct}%)`;

  const statusBlock = isStatusExempt ? `
  <!-- Ontario First Nations point-of-sale exemption record -->
  <div style="background:#ffffff;border:2px solid #111111;border-radius:4px;padding:14px 18px;margin-bottom:12px">
    <div style="${hdrStyle}">First Nations Exemption &mdash; Audit Record</div>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="${rowLbl}">Purchase date</td><td style="${rowVal}">${orderDateShort}</td></tr>
      <tr><td style="${rowLbl}">Customer name</td><td style="${rowVal}">${order.statusName || order.customerName || '-'}</td></tr>
      <tr><td style="${rowLbl}">Status card #</td><td style="${rowVal};font-family:monospace">${order.statusCard || '-'}</td></tr>
      <tr><td style="${rowLbl}">Band registry #</td><td style="${rowVal};font-family:monospace">${order.statusBand || '-'}</td></tr>
      <tr><td style="${rowLbl}">Goods / services</td><td style="${rowVal};font-weight:400">${goodsDesc}</td></tr>
    </table>
    <div style="font-size:11px;color:#555;margin-top:9px;line-height:1.45">
      8% provincial portion relieved at point of sale. Report the full 13% on line 105 of the HST return and claim
      ${money(preTaxSubtotal * 0.08)}
      back on line 111. Keep this sheet for audit.
    </div>
  </div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @media print {
    body { padding:0 !important; }
    .no-print { display:none !important; }
    div[style*="border"] { break-inside: avoid; page-break-inside: avoid; }
  }
</style>
</head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#ffffff;color:#111111;padding:20px;margin:0">
<div style="max-width:640px;margin:0 auto">

  <div style="border-bottom:3px solid #111111;padding-bottom:10px;margin-bottom:14px">
    <h2 style="color:#111111;margin:0 0 4px;font-size:21px;font-weight:800">New Order &mdash; ${order.orderNumber}</h2>
    <div style="font-size:13px;color:#333333;font-weight:600">${orderDateStr}</div>
    <div style="margin-top:5px;color:${tdgColor};font-size:13px;font-weight:600">${tdgStatus}</div>
  </div>

  <!-- Customer -->
  <div style="${cardStyle}">
    <div style="${hdrStyle}">Customer</div>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="${rowLbl}">Order date</td><td style="${rowVal}">${orderDateStr}</td></tr>
      <tr><td style="${rowLbl}">Name</td><td style="${rowVal}">${order.customerName || '-'}</td></tr>
      <tr><td style="${rowLbl}">Email</td><td style="${rowVal}">${order.customerEmail ? `<a href="mailto:${order.customerEmail}" style="color:#111111;text-decoration:none">${order.customerEmail}</a>` : '-'}</td></tr>
      <tr><td style="${rowLbl}">Phone</td><td style="${rowVal}">${order.customerPhone ? `<a href="tel:${phoneDigits}" style="color:#111111;text-decoration:none">${order.customerPhone}</a>` : '-'}</td></tr>
      <tr><td style="${rowLbl}">Vehicle</td><td style="${rowVal}">${order.vehicle || '-'}</td></tr>
      ${lugRowHtml}
    </table>
  </div>

  <!-- Items -->
  <div style="${cardStyle}">
    <div style="${hdrStyle}">Items</div>
    <div style="font-size:14px;line-height:1.7;color:#111111">${itemsHtml || '-'}</div>
    <div style="margin-top:9px;font-size:13px;color:#555555">Add-ons: <span style="color:#111111;font-weight:600">${order.addons || 'None'}</span></div>
  </div>

  ${statusBlock}

  <!-- Customer charge breakdown -->
  <div style="${cardStyle}">
    <div style="${hdrStyle}">Customer Charged</div>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="${rowLbl}">Subtotal (tires)</td><td style="${rowVal}">${money(order.subtotal || 0)}</td></tr>
      <tr><td style="${rowLbl}">Installation</td><td style="${rowVal}">${money(order.installTotal || 0)}</td></tr>
      ${order.discount && Number(order.discount) > 0 ? `<tr><td style="padding:5px 0;color:#15803d;font-size:13px">Discount${order.discountCode ? ` (${order.discountCode})` : ''}</td><td style="padding:5px 0;text-align:right;color:#15803d;font-size:13px;font-weight:600">-${money(order.discount)}</td></tr>` : ''}
      ${order.addonTotal > 0 ? `<tr><td style="${rowLbl}">Add-ons</td><td style="${rowVal}">${money(order.addonTotal)}</td></tr>` : ''}
      <tr style="border-top:1px solid #cccccc">
        <td style="padding:8px 0 5px;color:#111111;font-size:13px;font-weight:700">Subtotal before tax</td>
        <td style="padding:8px 0 5px;text-align:right;color:#111111;font-size:13px;font-weight:700">${money(preTaxSubtotal)}</td>
      </tr>
      <tr><td style="${rowLbl}">${taxLabel}</td><td style="${rowVal}">${money(order.tax || 0)}</td></tr>
      <tr style="border-top:2px solid #111111">
        <td style="padding:9px 0 0;color:#111111;font-weight:700;font-size:14px">${order.depositPaid > 0 ? 'Order Total' : 'Total Charged'}</td>
        <td style="padding:9px 0 0;text-align:right;color:#111111;font-weight:800;font-size:17px">${money(order.total || 0)} ${order.currency || 'CAD'}</td>
      </tr>
      ${order.depositPaid > 0 ? `<tr>
        <td style="padding:5px 0 0;color:#15803d;font-weight:700;font-size:13px">Deposit Paid (Stripe)</td>
        <td style="padding:5px 0 0;text-align:right;color:#15803d;font-weight:800;font-size:15px">${money(order.depositPaid)}</td>
      </tr>
      <tr>
        <td style="padding:5px 0 0;color:#b91c1c;font-weight:800;font-size:14px">BALANCE OWING AT INSTALL</td>
        <td style="padding:5px 0 0;text-align:right;color:#b91c1c;font-weight:900;font-size:17px">${money(order.balanceDue)}</td>
      </tr>` : ''}
    </table>
  </div>

  ${cost ? `
  <!-- PC Tires cost (TDG) -->
  <div style="${cardStyle}">
    <div style="${hdrStyle}">PC Tires Cost (TDG)</div>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="${rowLbl}">TDG Order #</td><td style="${rowVal};font-family:monospace;font-size:12px">${cost.orderNum}</td></tr>
      <tr><td style="${rowLbl}">Reference</td><td style="${rowVal};font-family:monospace;font-size:12px">${cost.ref}</td></tr>
      <tr><td style="${rowLbl}">Subtotal</td><td style="${rowVal}">${money(cost.subtotal)}</td></tr>
      ${cost.shipping > 0 ? `<tr><td style="${rowLbl}">Shipping</td><td style="${rowVal}">${money(cost.shipping)}</td></tr>` : ''}
      ${cost.fees > 0 ? `<tr><td style="${rowLbl}">Fees</td><td style="${rowVal}">${money(cost.fees)}</td></tr>` : ''}
      <tr><td style="${rowLbl}">HST (TDG paid)</td><td style="${rowVal}">${money(cost.tax)}</td></tr>
      <tr style="border-top:1px solid #cccccc">
        <td style="padding:9px 0 0;color:#111111;font-weight:700;font-size:14px">Total Cost</td>
        <td style="padding:9px 0 0;text-align:right;color:#111111;font-weight:800;font-size:15px">${money(cost.total)} ${cost.currency}</td>
      </tr>
      ${margin !== null ? `<tr>
        <td style="padding:5px 0 0;color:#15803d;font-weight:700;font-size:14px">Gross Margin</td>
        <td style="padding:5px 0 0;text-align:right;color:#15803d;font-weight:800;font-size:17px">${money(margin)}${marginPct !== null ? ` <span style="color:#555;font-weight:500;font-size:12px">(${marginPct}%)</span>` : ''}</td>
      </tr>` : ''}
    </table>
    <div style="font-size:11px;color:#555555;margin-top:8px;line-height:1.4">Margin = Customer Total &minus; TDG Total. Both include tax and fees. Net margin after tax reconciliation will differ.</div>
  </div>` : ''}

  <!-- Install + source -->
  <div style="${cardStyle}">
    <div style="${hdrStyle}">Install &amp; Source</div>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="${rowLbl}">Install</td><td style="${rowVal}">${order.appointmentDate ? `${order.appointmentDate} at ${order.appointmentTime} &mdash; ${order.serviceName}` : 'Not booked'}</td></tr>
      <tr><td style="${rowLbl}">Payment</td><td style="${rowVal}">${order.paymentMethod || 'Card'}</td></tr>
      <tr><td style="${rowLbl}">Search Method</td><td style="${rowVal}">${order.searchMethod || '-'}</td></tr>
      <tr><td style="${rowLbl}">CASL Opt-in</td><td style="${rowVal}">${order.caslOptIn ? 'Yes' : 'No'}</td></tr>
    </table>
  </div>

  <div style="border-top:1px solid #cccccc;margin-top:14px;padding-top:9px;font-size:11px;color:#555555;text-align:center">
    PC Tires &middot; 7144 Grande River Line, Pain Court, ON &middot; 519-397-4686
  </div>

</div>
</body>
</html>`;
}

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

// ─── High-level: place TDG order + send both emails, with durable dedup ────────
// Called by send-order-email.js (client path) AND stripe-webhook.js (durable path).
// Whichever runs first records a `done:<key>` marker; the other returns { duplicate:true }.
export async function processOrder(order, env) {
  // Normalise vehicle string
  order.vehicle = [order.vehicleYear, order.vehicleMake, order.vehicleModel, order.vehicleTrim]
    .filter(Boolean).join(' ') || order.vehicle || '';

  const key = order.paymentIntentId || order.orderNumber || null;

  const existing = await checkDone(env, key);
  if (existing) {
    console.log('Duplicate order suppressed for key:', key);
    return { ...existing, duplicate: true };
  }

  // Reserve the key IMMEDIATELY — before placing the TDG order or sending any email —
  // so the two paths that call processOrder (the browser via send-order-email.js AND
  // the Stripe webhook, which fire near-simultaneously on a card order) can't both
  // slip past the check above and place the order twice / send duplicate emails.
  // Whichever path writes this marker first wins; the other sees it and returns
  // { duplicate: true }. The marker is overwritten with the final result at the end.
  if (key) {
    await recordDone(env, key, { success: true, orderNumber: order.orderNumber, pending: true });
  }

  const skipTdg = env && (env.SKIP_TDG === '1' || env.SKIP_TDG === true);

  // 1. Place TDG order (unless test flag)
  let tdgOrder = null, tdgError = null;
  if (skipTdg) {
    tdgOrder = { skipped: true, reason: 'SKIP_TDG flag set (test mode) — no live TDG order placed' };
  } else {
    try {
      tdgOrder = await placeTDGOrder(order, env.TDG_API_KEY);
      if (tdgOrder.error) { tdgError = tdgOrder; tdgOrder = null; }
    } catch (e) {
      tdgError = { message: e.message };
      console.error('TDG order error:', e);
    }
  }

  const RESEND_API_KEY = env.RESEND_API_KEY;

  // 2. Customer confirmation email
  if (order.customerEmail) {
    try {
      await sendEmail(RESEND_API_KEY, {
        to: order.customerEmail,
        subject: `✅ Order Confirmed — ${order.orderNumber} · PC Tires`,
        html: buildCustomerEmail(order, tdgOrder),
      });
    } catch (e) { console.error('Customer email error:', e); }
  }

  // 3. Internal notification
  try {
    await sendEmail(RESEND_API_KEY, {
      to: NOTIFY_EMAILS,
      subject: `🛞 New Order ${order.orderNumber}${order.depositPaid > 0 ? ' [DEPOSIT - BALANCE OWING]' : ''}${tdgError ? ' ⚠️ TDG FAILED' : ''} — ${order.customerName}`,
      html: buildInternalEmail(order, tdgOrder, tdgError),
    });
  } catch (e) { console.error('Internal email error:', e); }

  const result = {
    success: true,
    orderNumber: order.orderNumber,
    tdg: tdgOrder?.order || null,
    tdgError: tdgError || null,
    tdgSkipped: tdgOrder?.skipped || false,
  };

  await recordDone(env, key, result);
  return result;
}

export { md5, computeOrderHash, placeTDGOrder, extractTDGRef, buildCustomerEmail, buildInternalEmail, sendEmail };
