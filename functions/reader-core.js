/**
 * Shared helpers for the in-shop card reader (Stripe Terminal, BBPOS WisePOS E).
 *
 * Imported by:
 *   - order-core.js  puts the "Take payment at reader" button in the internal
 *                    order email and saves a snapshot of the order for the page
 *   - terminal.js    the reader API (verifies links, builds receipts)
 *
 * KV keys (binding ORDERS_KV):
 *   rd:order:<orderNumber>         order snapshot for the reader page (365 days)
 *   rd:<mode>:pay:<orderNumber>    payments/refunds taken at the reader for it
 *   rd:<mode>:pending:<ref>        PaymentIntent currently out on the reader
 *   rd:<mode>:receipt:<pi>         receipt-email dedup
 *   rd:<mode>:reader               cached reader id
 * <mode> is "test" or "live" so test payments never mark a real order paid.
 *
 * Env: READER_LINK_SECRET (optional; falls back to OWNER_PASSWORD) signs the
 *      per-order links in the email. Changing it breaks links in old emails.
 */

export const SITE = 'https://pctires.ca';
const ORDER_TTL = 365 * 24 * 3600;

function enc(s) { return new TextEncoder().encode(String(s)); }

function b64url(buf) {
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(message, secret) {
  const key = await crypto.subtle.importKey('raw', enc(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc(message)));
}

export const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
export const money = (n) => '$' + Number(n || 0).toFixed(2);
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function linkSecret(env) { return (env && (env.READER_LINK_SECRET || env.OWNER_PASSWORD)) || ''; }

export async function orderLinkToken(orderNumber, env) {
  const s = linkSecret(env);
  if (!s || !orderNumber) return '';
  return (await hmac('reader:' + orderNumber, s)).slice(0, 24);
}

export async function verifyOrderLink(orderNumber, token, env) {
  try {
    if (!orderNumber || !token) return false;
    const expected = await orderLinkToken(orderNumber, env);
    const got = String(token);
    if (!expected || expected.length !== got.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
    return diff === 0;
  } catch (e) { return false; }
}

// What the reader page and the receipt need from an order — nothing else.
export function orderSnapshot(order, ps) {
  const exempt = order.statusExempt === true || order.statusExempt === 'true';
  return {
    orderNumber: String(order.orderNumber || ''),
    orderDate: order.orderDate || '',
    customerName: order.customerName || '',
    customerEmail: order.customerEmail || '',
    customerPhone: order.customerPhone || '',
    vehicle: order.vehicle || '',
    tires: (order.tires || []).map((t) => ({
      qty: Number(t.qty) || 0,
      brand: t.brand || '',
      name: t.name || '',
      size: t.size || (t.diameter ? t.diameter + '"' : ''),
      price: Number(t.price) || 0,
    })),
    subtotal: r2(order.subtotal),
    installTotal: r2(order.installTotal),
    addonTotal: r2(order.addonTotal),
    addons: order.addons || '',
    discount: r2(order.discount),
    discountCode: order.discountCode || '',
    tax: r2(order.tax),
    taxLabel: exempt ? 'GST (5%) - status exempt' : 'HST (' + (order.taxRatePct || '13') + '%)',
    total: r2(order.total),
    priorPaid: r2(ps.paid),
    priorVia: ps.via || '',
    priorState: ps.state,
    due: r2(ps.due),
    // Postma H&C discount-code orders: card fees wipe out the margin, so the
    // balance is debit only (the reader refuses credit cards for these).
    debitOnly: order.balanceBy === 'e-transfer',
    savedAt: new Date().toISOString(),
  };
}

// Called from order-core.processOrder. Never throws — a failure here must not
// stop the order email going out.
export async function prepareReaderLink(order, env, ps) {
  try {
    if (!ps || ps.state === 'PAID' || !(Number(ps.due) > 0)) return null;
    if (!env || !env.ORDERS_KV || !order || !order.orderNumber) return null;
    const snap = orderSnapshot(order, ps);
    await env.ORDERS_KV.put('rd:order:' + snap.orderNumber, JSON.stringify(snap), { expirationTtl: ORDER_TTL });
    const t = await orderLinkToken(snap.orderNumber, env);
    if (!t) return null;
    const url = SITE + '/reader?o=' + encodeURIComponent(snap.orderNumber) + '&t=' + t;
    return { url, html: readerButtonHtml(url, ps.due, snap.debitOnly) };
  } catch (e) {
    console.error('Reader link error:', e);
    return null;
  }
}

export function readerButtonHtml(url, due, debitOnly) {
  return `
  <!-- Take payment at the shop card reader -->
  <div style="margin:0 0 12px;text-align:center">
    <a href="${esc(url)}" style="display:block;background:#111111;color:#f5c518;text-decoration:none;font-weight:800;font-size:16px;padding:14px 18px;border-radius:4px">Take payment at reader &mdash; ${money(due)} owing</a>
    <div style="font-size:11px;color:#555555;margin-top:6px">Opens this order and sends the balance to the shop card reader${debitOnly ? ' &middot; <b>debit only</b> (discount pricing)' : ''}.</div>
  </div>`;
}

// "Debit (Interac) .... 1234" / "Visa .... 4242" from a Stripe charge.
export function methodLabel(charge) {
  const d = (charge && charge.payment_method_details) || {};
  const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
  if (d.type === 'interac_present') {
    const l4 = d.interac_present && d.interac_present.last4;
    return 'Debit (Interac)' + (l4 ? ' •••• ' + l4 : '');
  }
  if (d.type === 'card_present') {
    const c = d.card_present || {};
    const brand = c.brand === 'amex' ? 'Amex' : c.brand === 'mastercard' ? 'Mastercard' : cap(c.brand || 'Card');
    return brand + (c.funding === 'debit' ? ' Debit' : '') + (c.last4 ? ' •••• ' + c.last4 : '');
  }
  return d.type ? cap(d.type) : 'Card';
}

export function isInterac(charge) {
  return !!(charge && charge.payment_method_details && charge.payment_method_details.type === 'interac_present');
}

// Invoice lines for an order: tires and installation always on separate lines
// (manufacturers need proof install was paid for rebate claims).
export function orderLines(snap) {
  const lines = [];
  const tires = snap.tires || [];
  const perLineSum = r2(tires.reduce((s, t) => s + t.qty * t.price, 0));
  if (tires.length && Math.abs(perLineSum - snap.subtotal) < 0.02) {
    for (const t of tires) {
      lines.push({ label: `${t.qty} × ${t.brand} ${t.name}${t.size ? ' (' + t.size + ')' : ''}`, amount: r2(t.qty * t.price) });
    }
  } else {
    const desc = tires.map((t) => `${t.qty} × ${t.brand} ${t.name}${t.size ? ' (' + t.size + ')' : ''}`).join(', ');
    lines.push({ label: 'Tires' + (desc ? ' — ' + desc : ''), amount: snap.subtotal });
  }
  lines.push({ label: 'Installation', amount: snap.installTotal });
  if (snap.addonTotal > 0) lines.push({ label: 'Add-ons' + (snap.addons ? ' — ' + snap.addons : ''), amount: snap.addonTotal });
  if (snap.discount > 0) lines.push({ label: 'Discount' + (snap.discountCode ? ' (' + snap.discountCode + ')' : ''), amount: -snap.discount });
  return lines;
}

// Customer receipt / paid invoice. All values are escaped here.
export function buildReceiptEmail(r) {
  const row = (l, v, style) => `<tr><td style="padding:5px 0;color:#333;font-size:14px;${style || ''}">${esc(l)}</td><td style="padding:5px 0;text-align:right;color:#111;font-size:14px;font-weight:600;white-space:nowrap;${style || ''}">${esc(v)}</td></tr>`;
  const lines = (r.lines || []).map((x) => row(x.label, (x.amount < 0 ? '-' : '') + money(Math.abs(x.amount)))).join('');
  const pays = (r.payments || []).map((p) => row(p.label + (p.date ? ' — ' + p.date : ''), (p.amount < 0 ? '-' : '') + money(Math.abs(p.amount)), 'color:#15803d')).join('');
  const balance = r2(r.balance);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#ffffff;color:#111;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto">
  ${r.test ? '<div style="background:#fef3c7;border:1px solid #f59e0b;padding:8px 12px;margin-bottom:12px;font-size:13px;font-weight:700">TEST MODE &mdash; no real money moved. This copy went to the shop only.</div>' : ''}
  <div style="border-bottom:3px solid #111;padding-bottom:10px;margin-bottom:14px">
    <div style="font-size:22px;font-weight:900;letter-spacing:1px">PC TIRES</div>
    <div style="font-size:13px;color:#555">7144 Grande River Line, Pain Court, ON &middot; 519-397-4686 &middot; pctires.ca</div>
  </div>
  <h2 style="margin:0 0 4px;font-size:20px">${esc(r.title)}</h2>
  <div style="font-size:13px;color:#555;margin-bottom:14px">${esc(r.ref || '')}${r.date ? ' &middot; ' + esc(r.date) : ''}${r.customerName ? ' &middot; ' + esc(r.customerName) : ''}${r.vehicle ? ' &middot; ' + esc(r.vehicle) : ''}</div>
  <table style="border-collapse:collapse;width:100%">
    ${lines}
    <tr style="border-top:1px solid #ccc"><td style="padding:8px 0 5px;font-weight:700;font-size:14px">Subtotal before tax</td><td style="padding:8px 0 5px;text-align:right;font-weight:700;font-size:14px">${money(r.subtotal)}</td></tr>
    ${row(r.taxLabel || 'HST (13%)', money(r.tax))}
    <tr style="border-top:2px solid #111"><td style="padding:9px 0 4px;font-weight:800;font-size:15px">Total</td><td style="padding:9px 0 4px;text-align:right;font-weight:900;font-size:17px">${money(r.total)}</td></tr>
    ${pays ? '<tr><td colspan="2" style="padding:12px 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;font-weight:700">Payments</td></tr>' + pays : ''}
    <tr style="border-top:1px solid #ccc"><td style="padding:9px 0 0;font-weight:800;font-size:15px;color:${balance > 0 ? '#b91c1c' : '#15803d'}">${balance > 0 ? 'Balance owing' : 'Paid in full'}</td><td style="padding:9px 0 0;text-align:right;font-weight:900;font-size:17px;color:${balance > 0 ? '#b91c1c' : '#15803d'}">${money(Math.max(0, balance))}</td></tr>
  </table>
  <div style="font-size:12px;color:#555;margin-top:18px;line-height:1.5">Thank you for choosing PC Tires. Keep this receipt &mdash; tire manufacturers ask for it on rebate claims. Questions? Reply to this email or call 519-397-4686.</div>
</div></body></html>`;
}
