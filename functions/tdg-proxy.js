/**
 * Cloudflare Pages Function: /functions/tdg-proxy.js
 * Proxies READ-ONLY catalogue requests to the TDG Access API.
 *
 * Hardened 2026-11-18: this endpoint is public (the site's tire search uses it),
 * so it now exposes ONLY catalogue/stock lookups. Order creation, order status,
 * order quotes and the account lookups (shipping addresses, payment methods,
 * pickup locations) were removed - nothing on the site called them through this
 * proxy, and leaving them here let anyone on the internet place orders against
 * the TDG account. Real orders go through functions/order-core.js, which talks
 * to TDG directly, server-side, after payment.
 */

const TDG_API_BASE = 'https://www.tdgaccess.ca/api';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// Read-only actions ONLY. Do not add order/* or account/* here.
const ACTION_MAP = {
  search:    `${TDG_API_BASE}/product/search`,
  hardware:  `${TDG_API_BASE}/hardware/search`,
  inventory: `${TDG_API_BASE}/inventory/search`,
  all:       `${TDG_API_BASE}/product/all`,
};

const MAX_BODY_BYTES = 20000;

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });
  }

  const TDG_API_KEY = env.TDG_API_KEY;
  if (!TDG_API_KEY) {
    return new Response(JSON.stringify({ error: 'Server configuration error: TDG_API_KEY is not set' }), { status: 500, headers: CORS });
  }
  const HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': `ApiKey ${TDG_API_KEY}`,
  };

  try {
    let body = {};
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES) {
        return new Response(JSON.stringify({ error: 'Request too large' }), { status: 413, headers: CORS });
      }
      body = raw ? JSON.parse(raw) : {};
    } catch (e) { body = {}; }
    if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};

    const action  = typeof body.path === 'string' ? body.path : 'search';
    const payload = (body.payload && typeof body.payload === 'object') ? body.payload : {};

    const tdgUrl = Object.prototype.hasOwnProperty.call(ACTION_MAP, action) ? ACTION_MAP[action] : null;
    if (!tdgUrl) {
      return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: CORS });
    }

    const res = await fetch(tdgUrl, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    const respHeaders = { ...CORS };
    if (!res.ok) respHeaders['X-TDG-Status'] = String(res.status);
    return new Response(text, { status: res.status, headers: respHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy error' }), {
      status: 500, headers: CORS,
    });
  }
}
