// /functions/send-quote-sms.js
// Sends a quote link to a customer's phone via the voip.ms REST API (sendSMS).
// Replaces the sms: link in the Share Quote modal so texts go out server-side
// from the shop DID instead of opening the sender's messaging app.
//
// Required Cloudflare Pages environment variables (Production):
//   VOIPMS_API_USERNAME  - your voip.ms account email
//   VOIPMS_API_PASSWORD  - the API password set in voip.ms (NOT your portal password)
//   VOIPMS_DID           - the sending number, digits only, e.g. 5193974686
//                          (SMS must be enabled on this DID in voip.ms)
//
// Optional binding: TECH_KV (already bound on this project) - used for rate limiting.
//
// voip.ms setup (one time):
//   Main Menu -> SOAP and REST/JSON API -> Enable API, set API password,
//   and set enabled IP addresses to 0.0.0.0 (Cloudflare egress IPs rotate).
//
// Request:  POST JSON { phone: "519-555-1234", link: "https://pctires.ca/...", name?: "John" }
// Response: { ok: true } or { ok: false, error: "..." }

const CORS = {
  'Access-Control-Allow-Origin': 'https://pctires.ca',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

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

// Build a GSM-7-safe message under 160 chars. Plain ASCII only -
// unicode (em dashes, emoji) forces 70-char segments and higher cost.
function buildMessage(name, link) {
  const clean = (s) =>
    String(s || '')
      .replace(/[^\x20-\x7E]/g, '')
      .trim()
      .slice(0, 40);
  const who = clean(name);
  const full = who
    ? `PC Tires quote for ${who}: ${link} Questions? Call 519-397-4686`
    : `Your PC Tires quote: ${link} Questions? Call 519-397-4686`;
  if (full.length <= 160) return full;
  const short = `PC Tires quote: ${link}`;
  return short.length <= 160 ? short : short.slice(0, 160);
}

async function rateLimit(env, ip) {
  if (!env.TECH_KV) return { allowed: true };
  try {
    const hourKey = `smsrl:ip:${ip}:${Math.floor(Date.now() / 3600000)}`;
    const dayKey = `smsrl:global:${new Date().toISOString().slice(0, 10)}`;
    const [ipCount, dayCount] = await Promise.all([
      env.TECH_KV.get(hourKey),
      env.TECH_KV.get(dayKey),
    ]);
    if (parseInt(ipCount || '0', 10) >= 5) {
      return { allowed: false, error: 'Too many texts from this device. Try again in an hour.' };
    }
    if (parseInt(dayCount || '0', 10) >= 200) {
      return { allowed: false, error: 'Daily SMS limit reached.' };
    }
    await Promise.all([
      env.TECH_KV.put(hourKey, String(parseInt(ipCount || '0', 10) + 1), { expirationTtl: 3700 }),
      env.TECH_KV.put(dayKey, String(parseInt(dayCount || '0', 10) + 1), { expirationTtl: 90000 }),
    ]);
  } catch (e) {
    // KV problems should never block a legitimate send
  }
  return { allowed: true };
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

  const phone = normalizePhone(body.phone);
  if (!phone) {
    return json({ ok: false, error: 'Enter a valid 10-digit Canadian/US phone number.' }, 400);
  }

  // Only ever text links to our own site - this endpoint is not a general SMS gateway.
  const link = String(body.link || '').trim();
  if (!/^https:\/\/(www\.)?pctires\.ca(\/|\?|#|$)/.test(link) || link.length > 120) {
    return json({ ok: false, error: 'Invalid quote link.' }, 400);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rl = await rateLimit(env, ip);
  if (!rl.allowed) return json({ ok: false, error: rl.error }, 429);

  const message = buildMessage(body.name, link);

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
      headers: { 'User-Agent': 'pctires-quote-sms/1.0' },
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
