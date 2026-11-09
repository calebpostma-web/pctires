/**
 * Cloudflare Pages Function: /functions/terminal.js  (POST /terminal)
 *
 * Server-driven Stripe Terminal for the shop card reader (BBPOS WisePOS E).
 * The reader shows whatever amount this function sends it; the reader page
 * (/reader) is the screen staff use.
 *
 * Actions (POST JSON { action, ... }):
 *   config                         -> { mode }                       (no auth)
 *   order    { o, t }              -> order + balance owing          (order link)
 *   charge   { o, t }              -> sends the balance to the reader (order link)
 *   charge   { ownerToken, desc, preTax, name, email }   walk-in, adds 13% HST
 *   status   { pi, o,t | ownerToken } -> waiting | succeeded | failed | canceled | idle
 *   cancel   { pi, o,t | ownerToken }
 *   simulate { outcome: debit|credit|decline }   TEST MODE ONLY (fake card tap)
 *   recent   { ownerToken }        -> recent reader payments (for refunds)
 *   refund   { ownerToken, pi, amount? }  card: instant; debit: on the reader
 *   refund_status { ownerToken, pi }
 *   paid_other { ownerToken, method: etransfer|cash, rid, (o,t) | (desc, preTax, name, email) }
 *                                  balance / walk-in paid by e-transfer or cash (no reader)
 *
 * Invoice numbers (invoice-core.js, D1 INVOICE_DB): live mode only. Walk-ins get
 * the next number when paid; order payments go on the order's invoice. Test mode
 * never touches the invoice sequence (receipts show "TEST").
 *
 * Test vs live: TERMINAL_MODE=live uses STRIPE_SECRET (real money); anything
 * else uses STRIPE_SECRET_TEST and a simulated reader that is created on the
 * fly. Test payments are stored under rd:test:* so they never mark a real
 * order as paid, and test receipts go to the shop inbox only.
 *
 * Reader PaymentIntents carry metadata.source = 'pctires-reader', so the
 * online-order webhook (which only acts on 'pctires-web') ignores them.
 *
 * Env / bindings: STRIPE_SECRET, STRIPE_SECRET_TEST, TERMINAL_MODE,
 *   TERMINAL_READER_ID (optional), OWNER_PASSWORD, RESEND_API_KEY, ORDERS_KV.
 */

import { verifyOwnerToken } from './owner-token.js';
import {
  verifyOrderLink, buildReceiptEmail, methodLabel, isInterac, orderLines, r2, money,
} from './reader-core.js';
import { issueInvoice, findInvoice, recordPayment, setInvoiceEmail } from './invoice-core.js';

const SHOP_EMAIL = 'postmacontracting@gmail.com';
const FROM_EMAIL = 'PC Tires <orders@pctires.ca>';
const REPLY_TO = 'contact@pctires.ca';
const HST_RATE = 0.13;
const MAX_WALKIN = 20000;
const PAY_TTL = 365 * 24 * 3600;
const SHOP_ADDRESS = { line1: '7144 Grande River Line', city: 'Pain Court', state: 'ON', postal_code: 'N0P 1M0', country: 'CA' };

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);

function cfg(env) {
  const live = String(env.TERMINAL_MODE || '').toLowerCase() === 'live';
  return { live, mode: live ? 'live' : 'test', key: live ? env.STRIPE_SECRET : env.STRIPE_SECRET_TEST };
}

function flatten(obj, prefix, out) {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((x, i) => (x && typeof x === 'object') ? flatten(x, `${key}[${i}]`, out) : out.append(`${key}[]`, String(x)));
    } else if (typeof v === 'object') {
      flatten(v, key, out);
    } else {
      out.append(key, String(v));
    }
  }
}

async function stripe(c, method, path, params) {
  let url = 'https://api.stripe.com/v1/' + path;
  const opt = { method, headers: { Authorization: 'Bearer ' + c.key } };
  if (params) {
    const body = new URLSearchParams();
    flatten(params, '', body);
    if (method === 'GET') {
      const qs = body.toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    } else {
      opt.body = body.toString();
      opt.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }
  const res = await fetch(url, opt);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error((data && data.error && data.error.message) || ('Stripe error ' + res.status));
    e.code = data && data.error && data.error.code;
    e.httpStatus = res.status;
    throw e;
  }
  return data;
}

// ─── KV helpers ───────────────────────────────────────────────────────────────
async function kvGet(env, key) {
  if (!env.ORDERS_KV) return null;
  try { return await env.ORDERS_KV.get(key); } catch (e) { return null; }
}
async function kvPut(env, key, val, ttl) {
  if (!env.ORDERS_KV) return;
  try { await env.ORDERS_KV.put(key, val, ttl ? { expirationTtl: ttl } : undefined); } catch (e) { console.error('KV put', key, e); }
}
async function kvDel(env, key) {
  if (!env.ORDERS_KV) return;
  try { await env.ORDERS_KV.delete(key); } catch (e) {}
}

async function getPays(env, c, o) {
  try {
    const arr = JSON.parse((await kvGet(env, `rd:${c.mode}:pay:${o}`)) || '[]');
    const seen = new Map();
    for (const p of arr) if (p && p.id) seen.set(p.id, p);   // last write wins per id
    return [...seen.values()];
  } catch (e) { return []; }
}
// Insert or replace by id (refunds are stored cumulatively per PaymentIntent).
async function upsertPay(env, c, o, entry) {
  const arr = (await getPays(env, c, o)).filter((p) => p.id !== entry.id);
  arr.push(entry);
  await kvPut(env, `rd:${c.mode}:pay:${o}`, JSON.stringify(arr), PAY_TTL);
  return arr;
}

async function loadOrder(env, c, o) {
  const raw = await kvGet(env, 'rd:order:' + o);
  if (!raw) return null;
  let snap;
  try { snap = JSON.parse(raw); } catch (e) { return null; }
  const pays = await getPays(env, c, o);
  const paidHere = r2(pays.reduce((s, p) => s + Number(p.amount || 0), 0));
  return { snap, pays, paidHere, due: Math.max(0, r2(snap.due - paidHere)) };
}

// The order's invoice number. Orders placed before invoice numbering existed get
// one the first time a payment is taken on them, saved back onto the order.
async function ensureOrderInvoice(env, c, st) {
  if (!c.live) return 'TEST';
  const s = st.snap;
  if (s.invoiceNumber) return s.invoiceNumber;
  let inv = await findInvoice(env, 'order:' + s.orderNumber);
  if (!inv) {
    inv = await issueInvoice(env, {
      ref: 'order:' + s.orderNumber, kind: 'order', orderNumber: s.orderNumber,
      customer: s.customerName, email: s.customerEmail,
      description: (s.tires || []).map((t) => `${t.qty}x ${t.brand} ${t.name} ${t.size}`).join('; ') || 'Tires and installation',
      preTax: r2(s.subtotal + s.installTotal + s.addonTotal - s.discount), tax: s.tax, total: s.total,
    });
    if (inv) {
      // Record what was paid before the reader existed (deposit / earlier payment).
      if (s.priorPaid > 0) {
        await recordPayment(env, { id: 'order:' + s.orderNumber + ':initial', invoice: inv, method: s.priorVia || 'Card', amount: s.priorPaid, at: s.orderDate || s.savedAt });
      }
    }
  }
  if (inv) {
    s.invoiceNumber = inv;
    await kvPut(env, 'rd:order:' + s.orderNumber, JSON.stringify(s), 365 * 24 * 3600);
  }
  return inv || '';
}

// "Email receipt to" box on the order page. Blank = keep the order's email.
// A new address is saved onto the order so every later receipt uses it.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
async function applyReceiptEmail(env, c, st, raw) {
  const email = clean(raw, 200);
  if (!email) return null;
  if (!EMAIL_RE.test(email)) return 'That email address doesn\'t look right. Fix it or clear the box.';
  const s = st.snap;
  if (email.toLowerCase() !== String(s.customerEmail || '').toLowerCase()) {
    s.customerEmail = email;
    await kvPut(env, 'rd:order:' + s.orderNumber, JSON.stringify(s), 365 * 24 * 3600);
    if (c.live) await setInvoiceEmail(env, 'order:' + s.orderNumber, email);
  }
  return null;
}

// Put the invoice number on the Stripe payment too, so payouts trace back to invoices.
async function tagPi(c, piId, inv) {
  if (!c.live || !inv || !piId) return;
  await stripe(c, 'POST', 'payment_intents/' + piId, { metadata: { invoice: inv } }).catch(() => {});
}

function orderReceipt(st, extra) {
  const s = st.snap;
  const payments = [];
  if (s.priorPaid > 0) {
    payments.push({
      label: (s.priorState === 'DEPOSIT' ? 'Deposit' : 'Paid') + ' (' + (s.priorVia || 'Card') + ')',
      amount: s.priorPaid,
      date: shopDate(s.orderDate || s.savedAt),
    });
  }
  for (const p of st.pays) payments.push({ label: p.label, amount: p.amount, date: shopDate(p.at) });
  return {
    subject: `Receipt${extra.invoice && extra.invoice !== 'TEST' ? ' — Invoice #' + extra.invoice : ''} — ${s.orderNumber} · PC Tires`,
    title: st.due > 0 ? 'Payment received' : 'Paid invoice',
    invoice: extra.invoice,
    ref: 'Order ' + s.orderNumber,
    date: shopDate(extra.when || new Date()),
    customerName: s.customerName,
    vehicle: s.vehicle,
    email: s.customerEmail,
    lines: orderLines(s),
    subtotal: r2(s.subtotal + s.installTotal + s.addonTotal - s.discount),
    taxLabel: s.taxLabel,
    tax: s.tax,
    total: s.total,
    payments,
    balance: st.due,
  };
}

function walkinReceipt(f) {
  return {
    subject: `Receipt${f.invoice && f.invoice !== 'TEST' ? ' — Invoice #' + f.invoice : ''} · PC Tires`,
    title: 'Receipt',
    invoice: f.invoice,
    ref: '',
    date: shopDate(f.when || new Date()),
    customerName: f.name || '',
    vehicle: '',
    email: f.email || '',
    lines: [{ label: f.desc || 'Service', amount: f.preTax }],
    subtotal: f.preTax,
    taxLabel: 'HST (13%)',
    tax: f.hst,
    total: f.total,
    payments: [{ label: f.label, amount: f.total, date: shopDate(f.when || new Date()) }],
    balance: 0,
  };
}

// ─── Reader lookup ────────────────────────────────────────────────────────────
async function createSimulatedReader(c) {
  const locs = await stripe(c, 'GET', 'terminal/locations', { limit: 10 });
  let loc = (locs.data || [])[0];
  if (!loc) loc = await stripe(c, 'POST', 'terminal/locations', { display_name: 'PC Tires (test)', address: SHOP_ADDRESS });
  return stripe(c, 'POST', 'terminal/readers', { registration_code: 'simulated-wpe', location: loc.id, label: 'Simulated WisePOS E' });
}

async function getReaderId(env, c, fresh) {
  if (c.live && env.TERMINAL_READER_ID) return env.TERMINAL_READER_ID;
  const cacheKey = `rd:${c.mode}:reader`;
  if (!fresh) {
    const cached = await kvGet(env, cacheKey);
    if (cached) return cached;
  }
  const list = await stripe(c, 'GET', 'terminal/readers', { limit: 20 });
  const readers = list.data || [];
  let r = readers.find((x) => x.status === 'online') || readers[0];
  if (!r && !c.live) r = await createSimulatedReader(c);
  if (!r) throw new Error('No card reader is set up on the Stripe account yet. Plug the reader in, connect it to Wi-Fi and register it in the Stripe Dashboard.');
  await kvPut(env, cacheKey, r.id, 3600);
  return r.id;
}

// Runs fn(readerId); if the cached reader no longer exists, looks it up again once.
async function withReader(env, c, fn) {
  const id = await getReaderId(env, c, false);
  try {
    return await fn(id);
  } catch (e) {
    if (e.code === 'resource_missing') {
      await kvDel(env, `rd:${c.mode}:reader`);
      return fn(await getReaderId(env, c, true));
    }
    throw e;
  }
}

function friendlyStripeError(e) {
  const code = e && e.code;
  if (code === 'terminal_reader_busy') return 'The reader is busy with another payment. Finish or cancel that one first.';
  if (code === 'terminal_reader_offline') return 'The reader is offline. Check that it is on and connected to the shop Wi-Fi.';
  if (code === 'terminal_reader_timeout') return 'The reader did not respond. Check that it is on and connected to the shop Wi-Fi, then try again.';
  return (e && e.message) || 'Something went wrong talking to Stripe.';
}

// ─── Success handling: record the payment + email the receipt ────────────────
function shopDate(d) {
  try {
    return new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) { return ''; }
}

async function sendResend(env, payload) {
  if (!env.RESEND_API_KEY) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, reply_to: REPLY_TO, ...payload }),
  });
  if (!res.ok) console.error('Resend error', res.status, await res.text().catch(() => ''));
  return res.ok;
}

async function sendReceipt(env, c, pi, r) {
  const dedupKey = `rd:${c.mode}:receipt:${pi.id}`;
  if (await kvGet(env, dedupKey)) return { sent: false, to: null, already: true };
  await kvPut(env, dedupKey, '1', PAY_TTL);
  const customer = (r.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) ? r.email : '';
  // Test receipts only ever go to the shop.
  const to = (!c.live || !customer) ? SHOP_EMAIL : customer;
  const payload = {
    to: [to],
    subject: (c.live ? '' : '[TEST] ') + r.subject,
    html: buildReceiptEmail({ ...r, test: !c.live }),
  };
  if (to !== SHOP_EMAIL) payload.bcc = [SHOP_EMAIL];
  try {
    const ok = await sendResend(env, payload);
    if (!ok) await kvDel(env, dedupKey);
    return { sent: ok, to };
  } catch (e) {
    await kvDel(env, dedupKey);
    return { sent: false, to };
  }
}

async function finalizeSuccess(env, c, pi) {
  const charge = (pi.latest_charge && typeof pi.latest_charge === 'object') ? pi.latest_charge : null;
  const label = methodLabel(charge);
  const amount = r2((pi.amount_received || pi.amount || 0) / 100);
  const md = pi.metadata || {};
  const when = new Date((pi.created || Date.now() / 1000) * 1000);
  let receipt = { sent: false, to: null };
  let invoice = '';

  if (md.kind === 'order' && md.order) {
    const o = md.order;
    await upsertPay(env, c, o, { id: pi.id, amount, label, at: when.toISOString() });
    await kvDel(env, `rd:${c.mode}:pending:${o}`);
    const st = await loadOrder(env, c, o);
    if (st) {
      invoice = await ensureOrderInvoice(env, c, st);
      if (c.live && invoice) {
        await recordPayment(env, { id: pi.id, invoice, method: label, amount, stripePi: pi.id, at: when.toISOString() });
        await tagPi(c, pi.id, invoice);
      }
      receipt = await sendReceipt(env, c, pi, orderReceipt(st, { invoice, when }));
    }
  } else {
    await kvDel(env, `rd:${c.mode}:pending:walkin`);
    const preTax = r2(md.pre_tax);
    const hst = r2(md.hst);
    if (c.live) {
      invoice = await issueInvoice(env, {
        ref: 'walkin:' + pi.id, kind: 'walkin', customer: md.customer, email: md.email,
        description: md.desc, preTax, tax: hst, total: amount,
      }) || '';
      if (invoice) {
        await recordPayment(env, { id: pi.id, invoice, method: label, amount, stripePi: pi.id, at: when.toISOString() });
        await tagPi(c, pi.id, invoice);
      }
    } else {
      invoice = 'TEST';
    }
    receipt = await sendReceipt(env, c, pi, walkinReceipt({ invoice, when, name: md.customer, email: md.email, desc: md.desc, preTax, hst, total: amount, label }));
  }
  return { label, amount, receipt, invoice };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function authOf(body, env) {
  const owner = body.ownerToken ? await verifyOwnerToken(String(body.ownerToken), env) : false;
  const o = clean(body.o, 60);
  const link = (o && body.t) ? await verifyOrderLink(o, String(body.t), env) : false;
  return { owner, order: link ? o : null };
}

function piAllowed(pi, auth) {
  if (!pi || !pi.metadata || pi.metadata.source !== 'pctires-reader') return false;
  if (auth.owner) return true;
  return !!(auth.order && pi.metadata.order === auth.order);
}

// If a payment for this order was out on the reader when the page closed,
// settle it now so the balance shown is never stale.
async function reconcilePending(env, c, o) {
  const piId = await kvGet(env, `rd:${c.mode}:pending:${o}`);
  if (!piId) return null;
  try {
    const pi = await stripe(c, 'GET', 'payment_intents/' + piId, { expand: ['latest_charge'] });
    if (pi.status === 'succeeded') { await finalizeSuccess(env, c, pi); return null; }
    if (pi.status === 'canceled') { await kvDel(env, `rd:${c.mode}:pending:${o}`); return null; }
    return pi;
  } catch (e) { return null; }
}

// ─── Actions ──────────────────────────────────────────────────────────────────
async function actOrder(env, c, auth) {
  if (!auth.order) return json({ error: 'This payment link is not valid. Open it from the order email.' }, 403);
  await reconcilePending(env, c, auth.order);
  const st = await loadOrder(env, c, auth.order);
  if (!st) return json({ error: 'Order ' + auth.order + ' was not found. Only orders placed after the reader was set up have a payment button.' }, 404);
  const s = st.snap;
  return json({
    mode: c.mode,
    order: {
      number: s.orderNumber,
      invoice: s.invoiceNumber || '',
      customerName: s.customerName,
      customerEmail: s.customerEmail,
      vehicle: s.vehicle,
      lines: orderLines(s),
      taxLabel: s.taxLabel,
      tax: s.tax,
      total: s.total,
      priorPaid: s.priorPaid,
      priorVia: s.priorVia,
      priorState: s.priorState,
      pays: st.pays.map((p) => ({ label: p.label, amount: p.amount, at: p.at })),
      due: st.due,
      debitOnly: !!s.debitOnly,
    },
  });
}

async function startOnReader(env, c, piParams, pendingRef, reuse) {
  let pi = null;
  // Re-use the PaymentIntent already out for this order/walk-in if it is still
  // collectable and for the same amount (e.g. "Try again" after a decline).
  const prevId = await kvGet(env, `rd:${c.mode}:pending:${pendingRef}`);
  if (prevId) {
    try {
      const prev = await stripe(c, 'GET', 'payment_intents/' + prevId);
      if (prev.status === 'succeeded') return { alreadyPaid: true };
      const collectable = ['requires_payment_method', 'requires_confirmation'].includes(prev.status);
      if (reuse && collectable && prev.amount === piParams.amount) {
        pi = prev;
      } else if (prev.status !== 'canceled') {
        await stripe(c, 'POST', 'payment_intents/' + prevId + '/cancel').catch(() => {});
      }
    } catch (e) {}
  }
  if (!pi) pi = await stripe(c, 'POST', 'payment_intents', piParams);
  await kvPut(env, `rd:${c.mode}:pending:${pendingRef}`, pi.id, 86400);
  const readerId = await withReader(env, c, (id) =>
    stripe(c, 'POST', `terminal/readers/${id}/process_payment_intent`, { payment_intent: pi.id }).then(() => id));
  return { pi: pi.id, amount: r2(pi.amount / 100), reader: readerId };
}

async function actCharge(env, c, auth, body) {
  if (auth.order) {
    await reconcilePending(env, c, auth.order);
    const st = await loadOrder(env, c, auth.order);
    if (!st) return json({ error: 'Order not found.' }, 404);
    if (st.due <= 0) return json({ error: 'This order is already paid in full.' }, 409);
    const emailErr = await applyReceiptEmail(env, c, st, body.email);
    if (emailErr) return json({ error: emailErr }, 400);
    const s = st.snap;
    const out = await startOnReader(env, c, {
      amount: Math.round(st.due * 100),
      currency: 'cad',
      payment_method_types: s.debitOnly ? ['interac_present'] : ['card_present', 'interac_present'],
      capture_method: 'automatic',
      description: clean(`PC Tires ${s.orderNumber} balance — ${s.customerName}`, 300),
      metadata: {
        source: 'pctires-reader', kind: 'order', order: s.orderNumber, mode: c.mode,
        customer: clean(s.customerName, 100), email: clean(s.customerEmail, 200),
      },
    }, s.orderNumber, true);
    if (out.alreadyPaid) return json({ error: 'This order was just paid. Refresh the page.' }, 409);
    return json(out);
  }

  if (!auth.owner) return json({ error: 'Log in to take a walk-in payment.', needLogin: true }, 401);
  const desc = clean(body.desc, 200);
  const preTax = r2(body.preTax);
  if (!desc) return json({ error: 'Add a short description (what the payment is for).' }, 400);
  if (!(preTax >= 1) || preTax > MAX_WALKIN) return json({ error: 'Enter a price before HST between $1 and $' + MAX_WALKIN + '.' }, 400);
  const hst = r2(preTax * HST_RATE);
  const total = r2(preTax + hst);
  const name = clean(body.name, 100);
  const email = clean(body.email, 200);
  if (email && !EMAIL_RE.test(email)) return json({ error: 'That email address doesn\'t look right. Fix it or clear the box.' }, 400);
  const out = await startOnReader(env, c, {
    amount: Math.round(total * 100),
    currency: 'cad',
    payment_method_types: ['card_present', 'interac_present'],
    capture_method: 'automatic',
    description: clean(`PC Tires walk-in — ${desc}${name ? ' — ' + name : ''}`, 300),
    metadata: {
      source: 'pctires-reader', kind: 'walkin', mode: c.mode,
      desc, pre_tax: preTax.toFixed(2), hst: hst.toFixed(2), customer: name, email,
    },
  }, 'walkin', false);
  if (out.alreadyPaid) return json({ error: 'The last walk-in payment just went through. Start a new one.' }, 409);
  return json({ ...out, preTax, hst, total });
}

async function readerAction(env, c) {
  try {
    const id = await getReaderId(env, c, false);
    const reader = await stripe(c, 'GET', 'terminal/readers/' + id);
    return reader.action || null;
  } catch (e) { return null; }
}

async function actStatus(env, c, auth, body) {
  const piId = clean(body.pi, 80);
  if (!piId) return json({ error: 'Missing payment.' }, 400);
  const pi = await stripe(c, 'GET', 'payment_intents/' + piId, { expand: ['latest_charge'] });
  if (!piAllowed(pi, auth)) return json({ error: 'Not allowed.' }, 403);
  if (pi.status === 'succeeded') {
    const done = await finalizeSuccess(env, c, pi);
    return json({ state: 'succeeded', ...done });
  }
  if (pi.status === 'canceled') return json({ state: 'canceled' });
  const action = await readerAction(env, c);
  if (action && action.type === 'process_payment_intent' && action.process_payment_intent
      && action.process_payment_intent.payment_intent === pi.id) {
    if (action.status === 'failed') {
      return json({ state: 'failed', message: action.failure_message || 'The payment did not go through.', code: action.failure_code || '' });
    }
    return json({ state: 'waiting' });
  }
  if (pi.last_payment_error) return json({ state: 'failed', message: pi.last_payment_error.message || 'The payment did not go through.' });
  // Reader moved on (cancelled on the device, or another payment started).
  return json({ state: 'idle' });
}

async function actCancel(env, c, auth, body) {
  const piId = clean(body.pi, 80);
  if (!piId) return json({ error: 'Missing payment.' }, 400);
  const pi = await stripe(c, 'GET', 'payment_intents/' + piId);
  if (!piAllowed(pi, auth)) return json({ error: 'Not allowed.' }, 403);
  if (pi.status === 'succeeded') return json({ error: 'That payment already went through.' }, 409);
  await withReader(env, c, (id) => stripe(c, 'POST', `terminal/readers/${id}/cancel_action`)).catch(() => {});
  if (pi.status !== 'canceled') await stripe(c, 'POST', 'payment_intents/' + piId + '/cancel').catch(() => {});
  const ref = pi.metadata.kind === 'order' ? pi.metadata.order : 'walkin';
  await kvDel(env, `rd:${c.mode}:pending:${ref}`);
  return json({ state: 'canceled' });
}

async function actSimulate(env, c, body) {
  if (c.live) return json({ error: 'Simulated taps only work in test mode.' }, 400);
  const outcome = clean(body.outcome, 10);
  const params = outcome === 'credit' ? { type: 'card_present' }
    : outcome === 'decline' ? { type: 'card_present', card_present: { number: '4000000000000002' } }
    : { type: 'interac_present' };
  await withReader(env, c, (id) => stripe(c, 'POST', `test_helpers/terminal/readers/${id}/present_payment_method`, params));
  return json({ ok: true });
}

async function actRecent(env, c, auth) {
  if (!auth.owner) return json({ error: 'Log in first.', needLogin: true }, 401);
  const list = await stripe(c, 'GET', 'payment_intents', { limit: 40, expand: ['data.latest_charge'] });
  const rows = (list.data || [])
    .filter((pi) => pi.metadata && pi.metadata.source === 'pctires-reader' && pi.status === 'succeeded')
    .slice(0, 20)
    .map((pi) => {
      const ch = (pi.latest_charge && typeof pi.latest_charge === 'object') ? pi.latest_charge : {};
      return {
        pi: pi.id,
        amount: r2(pi.amount_received / 100),
        refunded: r2((ch.amount_refunded || 0) / 100),
        label: methodLabel(ch),
        interac: isInterac(ch),
        desc: pi.metadata.kind === 'order'
          ? `Order ${pi.metadata.order}${pi.metadata.customer ? ' — ' + pi.metadata.customer : ''}`
          : `${pi.metadata.desc || 'Walk-in'}${pi.metadata.customer ? ' — ' + pi.metadata.customer : ''}`,
        created: pi.created,
      };
    });
  return json({ mode: c.mode, rows });
}

// Store the cumulative refund for this PaymentIntent (idempotent on re-polls).
async function recordRefund(env, c, pi) {
  if (!pi.metadata || pi.metadata.kind !== 'order' || !pi.metadata.order) return;
  const chId = (pi.latest_charge && typeof pi.latest_charge === 'object') ? pi.latest_charge.id : pi.latest_charge;
  if (!chId) return;
  const ch = await stripe(c, 'GET', 'charges/' + chId);
  const refunded = r2((ch.amount_refunded || 0) / 100);
  if (refunded > 0) {
    await upsertPay(env, c, pi.metadata.order, {
      id: 'refund:' + pi.id, amount: -refunded, label: 'Refund — ' + methodLabel(ch), at: new Date().toISOString(),
    });
  }
}

// Refunds go in the invoice ledger as a negative payment on the same invoice.
async function ledgerRefund(env, c, pi) {
  if (!c.live) return;
  const md = pi.metadata || {};
  const chId = (pi.latest_charge && typeof pi.latest_charge === 'object') ? pi.latest_charge.id : pi.latest_charge;
  if (!chId) return;
  const ch = await stripe(c, 'GET', 'charges/' + chId);
  const refunded = r2((ch.amount_refunded || 0) / 100);
  if (!(refunded > 0)) return;
  const inv = md.kind === 'order' ? await findInvoice(env, 'order:' + md.order) : await findInvoice(env, 'walkin:' + pi.id);
  if (inv) await recordPayment(env, { id: 'refund:' + pi.id, invoice: inv, method: 'Refund — ' + methodLabel(ch), amount: -refunded, stripePi: pi.id });
}

async function actRefund(env, c, auth, body) {
  if (!auth.owner) return json({ error: 'Log in first.', needLogin: true }, 401);
  const piId = clean(body.pi, 80);
  if (!piId) return json({ error: 'Missing payment.' }, 400);
  const pi = await stripe(c, 'GET', 'payment_intents/' + piId, { expand: ['latest_charge'] });
  if (!piAllowed(pi, auth) || pi.status !== 'succeeded') return json({ error: 'That payment cannot be refunded here.' }, 400);
  const ch = pi.latest_charge || {};
  const left = (ch.amount || 0) - (ch.amount_refunded || 0);
  const cents = body.amount ? Math.round(Number(body.amount) * 100) : left;
  if (!(cents > 0) || cents > left) return json({ error: 'Refund amount must be between $0.01 and ' + money(left / 100) + '.' }, 400);

  if (isInterac(ch)) {
    // Canadian rules: an Interac refund needs the customer's debit card on the reader.
    await withReader(env, c, (id) => stripe(c, 'POST', `terminal/readers/${id}/refund_payment`, { payment_intent: pi.id, amount: cents }));
    return json({ state: 'reader', amount: r2(cents / 100) });
  }
  await stripe(c, 'POST', 'refunds', { payment_intent: pi.id, amount: cents });
  await recordRefund(env, c, pi);
  await ledgerRefund(env, c, pi);
  return json({ state: 'succeeded', amount: r2(cents / 100) });
}

async function actRefundStatus(env, c, auth, body) {
  if (!auth.owner) return json({ error: 'Log in first.', needLogin: true }, 401);
  const piId = clean(body.pi, 80);
  const pi = await stripe(c, 'GET', 'payment_intents/' + piId, { expand: ['latest_charge'] });
  if (!piAllowed(pi, auth)) return json({ error: 'Not allowed.' }, 403);
  const action = await readerAction(env, c);
  if (action && action.type === 'refund_payment' && action.refund_payment && action.refund_payment.payment_intent === pi.id) {
    if (action.status === 'succeeded') { await recordRefund(env, c, pi); await ledgerRefund(env, c, pi); return json({ state: 'succeeded' }); }
    if (action.status === 'failed') return json({ state: 'failed', message: action.failure_message || 'The refund did not go through.' });
    return json({ state: 'waiting' });
  }
  return json({ state: 'idle' });
}

// ─── Paid another way (e-transfer / cash) ─────────────────────────────────────
// No reader involved. Owner login required (it marks money as received).
// `rid` is a one-time id from the page, so a double tap records it once.
async function actPaidOther(env, c, auth, body) {
  if (!auth.owner) return json({ error: 'Log in on this device to record an e-transfer or cash payment.', needLogin: true }, 401);
  const method = body.method === 'cash' ? 'cash' : body.method === 'etransfer' ? 'etransfer' : '';
  if (!method) return json({ error: 'Choose e-transfer or cash.' }, 400);
  const rid = clean(body.rid, 40);
  if (!/^[A-Za-z0-9-]{8,40}$/.test(rid)) return json({ error: 'Invalid request. Refresh the page and try again.' }, 400);
  const label = method === 'cash' ? 'Cash' : 'E-transfer';
  const id = 'other:' + rid;
  const when = new Date();

  if (auth.order) {
    await reconcilePending(env, c, auth.order);
    const before = await loadOrder(env, c, auth.order);
    if (!before) return json({ error: 'Order not found.' }, 404);
    const emailErr = await applyReceiptEmail(env, c, before, body.email);
    if (emailErr) return json({ error: emailErr }, 400);
    const already = before.pays.find((p) => p.id === id);
    if (!already && before.due <= 0) return json({ error: 'This order is already paid in full.' }, 409);
    const amount = already ? already.amount : before.due;
    if (!already) await upsertPay(env, c, auth.order, { id, amount, label, at: when.toISOString() });
    const st = await loadOrder(env, c, auth.order);
    const invoice = await ensureOrderInvoice(env, c, st);
    if (c.live && invoice) await recordPayment(env, { id, invoice, method: label, amount, at: when.toISOString() });
    const receipt = await sendReceipt(env, c, { id }, orderReceipt(st, { invoice, when }));
    return json({ state: 'succeeded', label, amount, invoice, receipt });
  }

  const desc = clean(body.desc, 200);
  const preTax = r2(body.preTax);
  if (!desc) return json({ error: 'Add a short description (what the payment is for).' }, 400);
  if (!(preTax >= 1) || preTax > MAX_WALKIN) return json({ error: 'Enter a price before HST between $1 and $' + MAX_WALKIN + '.' }, 400);
  const hst = r2(preTax * HST_RATE);
  const total = r2(preTax + hst);
  const name = clean(body.name, 100);
  const email = clean(body.email, 200);
  if (email && !EMAIL_RE.test(email)) return json({ error: 'That email address doesn\'t look right. Fix it or clear the box.' }, 400);
  let invoice = 'TEST';
  if (c.live) {
    invoice = await issueInvoice(env, { ref: 'walkin:' + id, kind: 'walkin', customer: name, email, description: desc, preTax, tax: hst, total }) || '';
    if (invoice) await recordPayment(env, { id, invoice, method: label, amount: total, at: when.toISOString() });
  }
  const receipt = await sendReceipt(env, c, { id }, walkinReceipt({ invoice, when, name, email, desc, preTax, hst, total, label }));
  return json({ state: 'succeeded', label, amount: total, invoice, receipt, preTax, hst, total });
}

// ─── Entry ────────────────────────────────────────────────────────────────────
export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid request.' }, 400); }
  body = body || {};
  const c = cfg(env);
  const action = clean(body.action, 30);

  if (action === 'config') return json({ mode: c.mode, ready: !!c.key });
  if (!c.key) {
    return json({ error: c.live ? 'STRIPE_SECRET is not set in Cloudflare.' : 'STRIPE_SECRET_TEST is not set in Cloudflare (needed for test mode).' }, 500);
  }

  try {
    const auth = await authOf(body, env);
    switch (action) {
      case 'order': return await actOrder(env, c, auth);
      case 'charge': return await actCharge(env, c, auth, body);
      case 'status': return await actStatus(env, c, auth, body);
      case 'cancel': return await actCancel(env, c, auth, body);
      case 'simulate': return await actSimulate(env, c, body);
      case 'recent': return await actRecent(env, c, auth);
      case 'refund': return await actRefund(env, c, auth, body);
      case 'refund_status': return await actRefundStatus(env, c, auth, body);
      case 'paid_other': return await actPaidOther(env, c, auth, body);
      default: return json({ error: 'Unknown action.' }, 400);
    }
  } catch (e) {
    console.error('terminal error', action, e);
    return json({ error: friendlyStripeError(e) }, e.httpStatus && e.httpStatus < 500 ? 400 : 502);
  }
}

export function onRequestGet() {
  return json({ error: 'POST only.' }, 405);
}
