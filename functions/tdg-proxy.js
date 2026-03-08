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
  return val.split(',').map(s => decodeURIComponent(s.trim())).filter(Boolean);
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

    let tdgUrl, payload = {}, method = 'POST';

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

      // ── Product endpoints ──────────────────────────
      case 'search':
        tdgUrl = `${TDG_API_BASE}/product/search`;
        break;

      case 'all':
        tdgUrl  = `${TDG_API_BASE}/product/all`;
        break;

      // ── Inventory endpoints ────────────────────────
      case 'inventory':
        tdgUrl = `${TDG_API_BASE}/inventory/search`;
        break;

      case 'inventoryAll':
        tdgUrl  = `${TDG_API_BASE}/inventory/all`;
        payload = null;
        method  = 'GET';
        break;

      // ── Account endpoints (all GET, no body) ───────
      case 'shippingAddresses':
        tdgUrl  = `${TDG_API_BASE}/account/shippingAddresses`;
        payload = null;
        method  = 'GET';
        break;

      case 'shippingMethods':
        tdgUrl  = `${TDG_API_BASE}/account/shippingMethods`;
        payload = null;
        method  = 'GET';
        break;

      case 'pickupLocations':
        tdgUrl  = `${TDG_API_BASE}/account/pickupLocations`;
        payload = null;
        method  = 'GET';
        break;

      case 'paymentMethods':
        tdgUrl  = `${TDG_API_BASE}/account/paymentMethods`;
        payload = null;
        method  = 'GET';
        break;

      // ── Order endpoints (POST with JSON body) ──────
      case 'orderQuote': {
        tdgUrl  = `${TDG_API_BASE}/order/quote`;
        // Expect full order payload posted as JSON body
        const body = await request.json().catch(() => ({}));
        payload = body;
        break;
      }

      case 'orderCreate': {
        tdgUrl  = `${TDG_API_BASE}/order/create`;
        const body = await request.json().catch(() => ({}));
        payload = body;
        break;
      }

      case 'orderStatus': {
        tdgUrl  = `${TDG_API_BASE}/order/status`;
        const body = await request.json().catch(() => ({}));
        payload = body;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: CORS });
    }

    const res = await fetch(tdgUrl, {
      method,
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
