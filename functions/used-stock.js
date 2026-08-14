// /functions/used-stock.js  →  serves /used-stock
// PC Tires — your own used & budget tire inventory (KV backed).
// Public GET: returns available tires for the page.
// Owner POST (password-gated): verify / list / add / update / sold / delete.
//
// ⚠ WHY THIS ISN'T CALLED used-tires.js ANY MORE
// A Pages Function shadows a static asset on the same route. While this
// lived at functions/used-tires.js, hitting pctires.ca/used-tires returned
// {"ok":true,"tires":[]} instead of the used-tires.html page — the customer
// page was unreachable. The API moved here; functions/used-tires.js is now
// a pass-through stub so /used-tires serves the HTML. Don't move it back.
//
// SETUP in Cloudflare (Pages -> Settings) — 1 and 2 are already done:
//   1. KV namespace  PC_USED_TIRES   (id 77e0961169d74222bded86e1dd93de66) ✓
//   2. Bound as variable name  USED_KV                                     ✓
//   3. Environment variable  USED_PASSWORD = <your owner password>
// Without 3, the page still lists fine but the owner login can't unlock.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const KEY = 'inventory';

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: CORS });
}

// Constant-time-ish password compare (same approach as tech-auth.js)
function passwordOk(input, correct) {
  if (!correct) return null; // not configured on server
  const a = new TextEncoder().encode(input || '');
  const b = new TextEncoder().encode(correct);
  let match = a.length === b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) match = false;
  }
  return match;
}

async function readInv(env) {
  const raw = await env.USED_KV.get(KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

async function writeInv(env, list) {
  await env.USED_KV.put(KEY, JSON.stringify(list));
}

function clampStr(v, max) {
  return (v == null ? '' : String(v)).slice(0, max || 120);
}

function toNum(v) {
  const n = parseFloat(v);
  return isFinite(n) ? n : null;
}

function sanitize(t) {
  t = t || {};
  return {
    type: t.type === 'new' ? 'new' : 'used',
    size: clampStr(t.size, 40),
    brand: clampStr(t.brand, 40),
    model: clampStr(t.model, 60),
    tread: clampStr(t.tread, 20),   // e.g. "8/32" for used
    season: clampStr(t.season, 20),
    qty: toNum(t.qty) || 1,
    price: toNum(t.price),          // cost / sell price per tire
    notes: clampStr(t.notes, 200),
  };
}

export async function onRequestGet(context) {
  const { env } = context;
  if (!env.USED_KV) return json({ ok: false, error: 'USED_KV namespace not bound yet.', tires: [] });
  const list = await readInv(env);
  const tires = list.filter(t => t.status !== 'sold');
  return json({ ok: true, tires });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.USED_KV) {
    return json({ ok: false, error: 'USED_KV namespace not bound. Bind PC_USED_TIRES as USED_KV in Pages -> Settings -> Bindings.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'Bad request.' }, 400);
  }

  const action = body.action;

  // Every write/admin action requires the password.
  const ok = passwordOk(body.password, env.USED_PASSWORD);
  if (ok === null) return json({ ok: false, error: 'USED_PASSWORD not configured on server.' }, 500);
  if (!ok) return json({ ok: false, error: 'Incorrect password.' }, 401);

  if (action === 'verify') return json({ ok: true });

  let list = await readInv(env);

  if (action === 'list') {
    // owner view includes sold items
    return json({ ok: true, tires: list });
  }

  if (action === 'add') {
    const t = sanitize(body.tire);
    t.id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    t.addedAt = Date.now();
    t.status = 'available';
    list.unshift(t);
    await writeInv(env, list);
    return json({ ok: true, id: t.id, tires: list });
  }

  if (action === 'update') {
    const id = body.id;
    const upd = sanitize(body.tire);
    let found = false;
    list = list.map(t => {
      if (t.id === id) { found = true; return Object.assign({}, t, upd, { id: t.id, addedAt: t.addedAt, status: t.status }); }
      return t;
    });
    if (!found) return json({ ok: false, error: 'Tire not found.' }, 404);
    await writeInv(env, list);
    return json({ ok: true, tires: list });
  }

  if (action === 'sold') {
    const id = body.id;
    list = list.map(t => t.id === id ? Object.assign({}, t, { status: 'sold' }) : t);
    await writeInv(env, list);
    return json({ ok: true, tires: list });
  }

  if (action === 'relist') {
    const id = body.id;
    list = list.map(t => t.id === id ? Object.assign({}, t, { status: 'available' }) : t);
    await writeInv(env, list);
    return json({ ok: true, tires: list });
  }

  if (action === 'delete') {
    const id = body.id;
    list = list.filter(t => t.id !== id);
    await writeInv(env, list);
    return json({ ok: true, tires: list });
  }

  return json({ ok: false, error: 'Unknown action.' }, 400);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
