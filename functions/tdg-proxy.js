/**
 * Cloudflare Pages Function: /functions/tdg-proxy.js
 * Proxies requests to the TDG Access API
 */

const TDG_API_BASE = 'https://www.tdgaccess.ca/api';
const TDG_API_KEY  = 'rst715Wr18hFpHpbi346TGuMLBBQDZZbF5lHZQSi27hfpLGey3TH3YRHYWWPJRyi7rkx';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `ApiKey ${TDG_API_KEY}`,
};

// Parse a param that might be a comma-separated string into an array
function toArray(val) {
  if (!val) return undefined;
  if (Array.isArray(val)) return val;
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const url    = new URL(request.url);
    const p      = Object.fromEntries(url.searchParams.entries());
    const action = p.action || 'search';

    let tdgUrl, payload = {};

    // Build shared search payload from query params
    if (p.tireSizes)    payload.tireSizes    = toArray(p.tireSizes);
    if (p.brands)       payload.brands       = toArray(p.brands);
    if (p.tireSeason)   payload.tireSeason   = parseInt(p.tireSeason);
    if (p.serviceType)  payload.serviceType  = p.serviceType;
    if (p.itemnumbers)  payload.itemnumbers  = toArray(p.itemnumbers);
    if (p.partnumbers)  payload.partnumbers  = toArray(p.partnumbers);
    if (p.boltPatterns) payload.boltPatterns = toArray(p.boltPatterns);
    if (p.diameters)    payload.diameters    = toArray(p.diameters);
    if (p.widths)       payload.widths       = toArray(p.widths);

    switch (action) {
      case 'search':
        tdgUrl = `${TDG_API_BASE}/product/search`;
        break;
      case 'inventory':
        tdgUrl = `${TDG_API_BASE}/inventory/search`;
        break;
      case 'all':
        tdgUrl = `${TDG_API_BASE}/product/all`;
        break;
      case 'shippingAddresses':
        tdgUrl = `${TDG_API_BASE}/account/shippingAddresses`;
        payload = null;
        break;
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: CORS });
    }

    const res  = await fetch(tdgUrl, {
      method: payload !== null ? 'POST' : 'GET',
      headers: HEADERS,
      ...(payload !== null ? { body: JSON.stringify(payload) } : {}),
    });

    const text = await res.text();
    return new Response(text, { status: res.status, headers: CORS });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy error', message: err.message }), {
      status: 500, headers: CORS,
    });
  }
}
