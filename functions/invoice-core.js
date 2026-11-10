/**
 * Sequential invoice numbers for PC Tires (CRA wants invoices in order, no gaps).
 *
 * One running number for every PC Tires sale, whichever way it comes in:
 *   online / phone orders  (order-core.js)        ref  order:<orderNumber>
 *   reader walk-ins        (terminal.js)          ref  walkin:<paymentIntent>
 *   walk-ins paid e-transfer / cash               ref  walkin:other:<id>
 *   pay links + status-card links                 ref  pay:<paymentIntent>
 *
 * A number is only issued for a real sale (paid, or an order placed), never for
 * a cancelled or declined attempt, so the sequence has no gaps. Issuing is
 * idempotent on `ref`: the same sale asked twice gets the same number.
 *
 * Storage: Cloudflare D1 database "pctires-invoices", bound to Pages as INVOICE_DB.
 *   invoices(seq PK, ref UNIQUE, kind, created_at, order_number, customer, email,
 *            description, pre_tax, tax, total, status, note)
 *   payments(id PK, invoice_seq, at, method, amount, stripe_pi, note)
 * Numbers start at 5000 (kept clear of earlier invoice numbers). D1 runs one write at a time, so two sales in the same
 * second can never get the same number.
 *
 * If INVOICE_DB is not bound, every function returns null and callers carry on
 * (emails still go out, just without an invoice number). Never throws.
 */

export const HST_NUMBER = '743657553 RT0001';

const num = (v) => (v === null || v === undefined || v === '' || !isFinite(Number(v))) ? null : Math.round(Number(v) * 100) / 100;
const txt = (v, max) => (v === null || v === undefined || v === '') ? null : String(v).slice(0, max || 300);

export async function issueInvoice(env, f) {
  if (!env || !env.INVOICE_DB || !f || !f.ref) return null;
  try {
    const db = env.INVOICE_DB;
    await db.prepare(
      `INSERT OR IGNORE INTO invoices (seq, ref, kind, created_at, order_number, customer, email, description, pre_tax, tax, total)
       VALUES ((SELECT COALESCE(MAX(seq), 4999) + 1 FROM invoices), ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    ).bind(
      String(f.ref), String(f.kind || 'sale'), new Date().toISOString(),
      txt(f.orderNumber, 60), txt(f.customer, 120), txt(f.email, 200), txt(f.description, 500),
      num(f.preTax), num(f.tax), num(f.total)
    ).run();
    // Fill blanks if a second caller knows more (e.g. the webhook got there first).
    await db.prepare(
      `UPDATE invoices SET customer = COALESCE(customer, ?2), email = COALESCE(email, ?3),
         description = COALESCE(description, ?4), pre_tax = COALESCE(pre_tax, ?5), tax = COALESCE(tax, ?6), total = COALESCE(total, ?7)
       WHERE ref = ?1`
    ).bind(String(f.ref), txt(f.customer, 120), txt(f.email, 200), txt(f.description, 500), num(f.preTax), num(f.tax), num(f.total)).run();
    const row = await db.prepare('SELECT seq FROM invoices WHERE ref = ?1').bind(String(f.ref)).first();
    return row ? String(row.seq) : null;
  } catch (e) {
    console.error('issueInvoice failed', f && f.ref, e);
    return null;
  }
}

// Customer gave a (new) email at the counter: keep the invoice record current.
export async function setInvoiceEmail(env, ref, email) {
  if (!env || !env.INVOICE_DB || !ref || !email) return false;
  try {
    await env.INVOICE_DB.prepare('UPDATE invoices SET email = ?2 WHERE ref = ?1').bind(String(ref), String(email).slice(0, 200)).run();
    return true;
  } catch (e) { return false; }
}

export async function findInvoice(env, ref) {
  if (!env || !env.INVOICE_DB || !ref) return null;
  try {
    const row = await env.INVOICE_DB.prepare('SELECT seq FROM invoices WHERE ref = ?1').bind(String(ref)).first();
    return row ? String(row.seq) : null;
  } catch (e) { return null; }
}

// One row per payment (or cumulative refund). Re-recording the same id replaces it.
export async function recordPayment(env, p) {
  if (!env || !env.INVOICE_DB || !p || !p.id || !p.invoice) return false;
  try {
    await env.INVOICE_DB.prepare(
      `INSERT OR REPLACE INTO payments (id, invoice_seq, at, method, amount, stripe_pi, note) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    ).bind(String(p.id), Number(p.invoice), p.at || new Date().toISOString(), String(p.method || 'Card'), num(p.amount) || 0, txt(p.stripePi, 80), txt(p.note, 300)).run();
    return true;
  } catch (e) {
    console.error('recordPayment failed', p && p.id, e);
    return false;
  }
}

// Pay links (/pay) and status-card links (/statuspay). A status-card link pays the
// balance on an existing order, so it lands on that order's invoice; any other
// pay link is its own sale. Called by BOTH send-payment-notification.js and the
// Stripe webhook, so a customer who closes the page still gets numbered.
export async function invoiceForPayLink(env, pi, extra) {
  if (!env || !env.INVOICE_DB || !pi || !pi.id) return null;
  extra = extra || {};
  const md = pi.metadata || {};
  const amount = num((pi.amount_received || pi.amount || 0) / 100);
  const orderNo = extra.orderNumber || md.orderNumber || '';
  let inv = orderNo ? await findInvoice(env, 'order:' + orderNo) : null;
  if (!inv) {
    inv = await issueInvoice(env, {
      ref: 'pay:' + pi.id,
      kind: extra.statusExempt ? 'statuspay' : 'paylink',
      orderNumber: orderNo || null,
      customer: extra.customerName || null,
      email: extra.customerEmail || pi.receipt_email || null,
      description: extra.description || pi.description || null,
      preTax: extra.preTax, tax: extra.tax,
      total: amount,
    });
  }
  if (inv) await recordPayment(env, { id: 'pay:' + pi.id, invoice: inv, method: 'Card (pay link)', amount, stripePi: pi.id });
  return inv;
}
