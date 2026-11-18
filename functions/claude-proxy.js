// /functions/claude-proxy.js
// Cloudflare Pages Function - proxies Anthropic API calls for Postma Contracting bookkeeping tools
// Deploy to: calebpostma-web/pctires/functions/claude-proxy.js
//
// Hardened 2026-11-18: this was an open door to the Anthropic key (any site or
// script could run up charges). It now:
//   - only answers requests coming from our own sites (Origin check)
//   - only allows the model the bookkeeping tools use, with a max_tokens ceiling
//   - is rate limited per IP and per day (TECH_KV)
// An Origin header can be faked by a script, so the rate limit + caps are what
// actually bound the cost; the Origin check keeps other websites and casual bots out.

const ALLOWED_ORIGINS = new Set([
  'https://pctires.ca',
  'https://www.pctires.ca',
  'https://aibookkeeper.ca',
  'https://www.aibookkeeper.ca',
]);

const ALLOWED_MODELS = new Set(['claude-sonnet-4-20250514']);
const DEFAULT_MODEL  = 'claude-sonnet-4-20250514';
const MAX_TOKENS_CAP = 8192;
const ALLOWED_BETAS  = new Set(['pdfs-2024-09-25']);

const PER_IP_PER_HOUR = 120;
const GLOBAL_PER_DAY  = 1500;

function originAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return /^https:\/\/([a-z0-9-]+\.)?pctires\.pages\.dev$/.test(origin);
}

function fromOurSite(request) {
  const origin = request.headers.get('Origin') || '';
  if (origin) return originAllowed(origin);
  const ref = request.headers.get('Referer') || '';
  try { return ref ? originAllowed(new URL(ref).origin) : false; } catch (e) { return false; }
}

function corsFor(origin) {
  return {
    'Access-Control-Allow-Origin': originAllowed(origin) ? origin : 'https://pctires.ca',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
  };
}

async function rateLimit(env, ip) {
  if (!env.TECH_KV) return { allowed: true };
  try {
    const hourKey = `aiprl:ip:${ip}:${Math.floor(Date.now() / 3600000)}`;
    const dayKey  = `aiprl:global:${new Date().toISOString().slice(0, 10)}`;
    const [ipCount, dayCount] = await Promise.all([
      env.TECH_KV.get(hourKey),
      env.TECH_KV.get(dayKey),
    ]);
    if (parseInt(ipCount || '0', 10) >= PER_IP_PER_HOUR) return { allowed: false, error: 'Too many AI requests this hour. Try again shortly.' };
    if (parseInt(dayCount || '0', 10) >= GLOBAL_PER_DAY)  return { allowed: false, error: 'Daily AI request limit reached.' };
    await Promise.all([
      env.TECH_KV.put(hourKey, String(parseInt(ipCount || '0', 10) + 1), { expirationTtl: 3700 }),
      env.TECH_KV.put(dayKey,  String(parseInt(dayCount || '0', 10) + 1), { expirationTtl: 90000 }),
    ]);
  } catch (e) { /* KV problems never block */ }
  return { allowed: true };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '';
  const corsHeaders = corsFor(origin);
  const reply = (obj, status) => new Response(JSON.stringify(obj), { status, headers: corsHeaders });

  if (!fromOurSite(request)) {
    return reply({ error: 'Forbidden' }, 403);
  }

  try {
    const body = await request.json();
    const { model, max_tokens, messages, beta } = body || {};

    if (!messages || !Array.isArray(messages)) {
      return reply({ error: 'Invalid request - messages array required' }, 400);
    }

    const useModel = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;
    const reqTokens = Number(max_tokens);
    const useTokens = Number.isFinite(reqTokens) && reqTokens > 0
      ? Math.min(Math.floor(reqTokens), MAX_TOKENS_CAP)
      : 1000;

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rl = await rateLimit(env, ip);
    if (!rl.allowed) return reply({ error: rl.error }, 429);

    // Build headers for Anthropic
    const anthropicHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    };

    // Add beta header if requested (needed for PDF document support)
    if (typeof beta === 'string' && ALLOWED_BETAS.has(beta)) {
      anthropicHeaders['anthropic-beta'] = beta;
    }

    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: anthropicHeaders,
      body: JSON.stringify({
        model: useModel,
        max_tokens: useTokens,
        messages,
      }),
    });

    const data = await anthropicResp.json();

    if (!anthropicResp.ok) {
      return reply({ error: data.error?.message || 'Anthropic API error', detail: data }, anthropicResp.status);
    }

    return reply(data, 200);

  } catch (err) {
    return reply({ error: 'Proxy error: ' + err.message }, 500);
  }
}

// Handle preflight OPTIONS requests
export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin') || '';
  const h = corsFor(origin);
  delete h['Content-Type'];
  return new Response(null, { status: 204, headers: h });
}
