// /functions/send-sms.js
// Owner-only free-form SMS to a customer, sent via the voip.ms REST API (sendSMS)
// from the shop DID. This is the "Text a Customer" panel behind owner login —
// e.g. "Your tires are in. Confirmed for 3:30. -PC Tires".
//
// Unlike send-quote-sms.js (which only ever texts pctires.ca quote links and is
// open), this endpoint sends ARBITRARY text, so it MUST be gated: every request
// has to carry a valid signed owner token. Without that gate it would be an open
// SMS gateway anyone could abuse to send texts on your dime from your number.
//
// Required Cloudflare Pages environment variables (Production) — same ones the
// quote texter already uses:
//   VOIPMS_API_USERNAME  - your voip.ms account email
//   VOIPMS_API_PASSWORD  - the API password set in voip.ms (NOT the portal password)
//   VOIPMS_DID           - the sending number, digits only, e.g. 5193974686
//   OWNER_PASSWORD       - already set; used to verify the owner session token
//
// Optional binding: TECH_KV (already bound) - used for a light daily send cap.
//
// Request:  POST JSON { phone: "519-555-1234", message: "…", ownerToken: "…" }
// Response: { ok: true } or { ok: false, error: "…" }

import { verifyOwnerToken } from './owner-token.js';

const CORS = {
  'Access-Control-Allow-Origin': 'https://pctires.ca',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// One SMS segment is 160 GSM-7 chars. We keep every text to a single segment so
// nothing ever gets truncated mid-word by the carrier and cost stays predictable.
const MAX_LEN = 160;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// Normalize to a 10-digit North American number, or return null.
function normalizePhone(raw) {
  if (typeof raw !== 'string') return null;
  let d = raw.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  if (d.length !== 10) return null;
  if (d[0] === '0' || d[0] === '1') return null; // invalid NA area code
  return d;
}

// Strip to GSM-7-safe ASCII. Unicode (em dashes, emoji, smart quotes) forces
// 70-char Unicode segments and higher cost, so we drop anything outside the
// printable ASCII range and normalize whitespace.
function cleanMessage(raw) {
  return String(raw || '')
    .replace(/[‘’]/g, "'")   // smart single quotes -> '
    .replace(/[“”]/g, '"')   // smart double quotes -> "
    .replace(/[–—]/g, '-')   // en/em dash -> -
    .replace(/[^\x20-\x7E\n]/g, '')    // drop remaining non-ASCII (emoji etc.)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Light global daily cap so a mistake can't run up a bill. No per-IP cap here —
// the endpoint is already owner-token gated, so the sender is always trusted.
async function underDailyCap(env) {
  if (!env.TECH_KV) return true;
  try {
    const dayKey = `ownersms:global:${new Date().toISOString().slice(0, 10)}`;
    const count = parseInt((await env.TECH_KV.get(dayKey)) || '0', 10);
    if (count >= 300) return false;
    await env.TECH_KV.put(dayKey, String(count + 1), { expirationTtl: 90000 });
  } catch (e) {
    // KV hiccups must never block a legitimate send
  }
  return true;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.VOIPMS_API_USERNAME || !env.VOIPMS_API_PASSWORD || !env.VOIPMS_DID) {
    return json({ ok: false, error: 'SMS is not configured yet.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }

  // ── OWNER GATE ─────────────────────────────────────────────────────────────
  // Arbitrary outbound text — only a signed-in owner may send.
  const ownerOk = await verifyOwnerToken(body.ownerToken, env);
  if (!ownerOk) {
    return json({ ok: false, error: 'Sign in as owner to send texts.' }, 401);
  }
  // ───────────────────────────────────────────────────────────────────────────

  const phone = normalizePhone(body.phone);
  if (!phone) {
    return json({ ok: false, error: 'Enter a valid 10-digit Canadian/US phone number.' }, 400);
  }

  const message = cleanMessage(body.message);
  if (!message) {
    return json({ ok: false, error: 'Type a message to send.' }, 400);
  }
  if (message.length > MAX_LEN) {
    return json({ ok: false, error: `Message is too long (${message.length}/${MAX_LEN}). Shorten it and try again.` }, 400);
  }

  if (!(await underDailyCap(env))) {
    return json({ ok: false, error: 'Daily text limit reached. Try again tomorrow or use the VoIP.ms app.' }, 429);
  }

  const params = new URLSearchParams({
    api_username: env.VOIPMS_API_USERNAME,
    api_password: env.VOIPMS_API_PASSWORD,
    method: 'sendSMS',
    did: String(env.VOIPMS_DID).replace(/\D/g, ''),
    dst: phone,
    message,
  });

  let result;
  try {
    const resp = await fetch(`https://voip.ms/api/v1/rest.php?${params.toString()}`, {
      method: 'GET',
      headers: { 'User-Agent': 'pctires-owner-sms/1.0' },
    });
    result = await resp.json();
  } catch (e) {
    return json({ ok: false, error: 'Could not reach the SMS provider. Try again.' }, 502);
  }

  if (result && result.status === 'success') {
    return json({ ok: true });
  }

  // Common voip.ms error statuses: invalid_credentials, ip_not_enabled,
  // sms_toolong, invalid_dst, did_not_sms_capable
  return json(
    { ok: false, error: `SMS provider error: ${result && result.status ? result.status : 'unknown'}` },
    502
  );
}
