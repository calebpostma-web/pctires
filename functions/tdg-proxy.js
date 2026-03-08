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

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const url    = new URL(request.url);
    const action = url.searchParams.get('action') || 'search';

    let tdgUrl, body = null;

    switch (action) {

      // Search products by tire size, brand, season, etc.
      case 'search': {
        tdgUrl = `${TDG_API_BASE}/product/search`;
        const p = Object.fromEntries(url.searchParams.entries());
        const payload = {};
        if (p.tireSizes)   payload.tireSizes   = p.tireSizes.split(',');
        if (p.brands)      payload.brands      = p.brands.split(',');
        if (p.tireSeason)  payload.tireSeason  = parseInt(p.tireSeason);
        if (p.serviceType) payload.serviceType = p.serviceType;
        if (p.itemnumbers) payload.itemnumbers = p.itemnumbers.split(',');
        if (p.partnumbers) payload.partnumbers = p.partnumbers.split(',');
        if (p.boltPatterns)payload.boltPatterns= p.boltPatterns.split(',');
        if (p.diameters)   payload.diameters   = p.diameters.split(',');
        if (p.widths)      payload.widths      = p.widths.split(',');
        body = JSON.stringify(payload);
        break;
      }

      // Get inventory + pricing for specific items
      case 'inventory': {
        tdgUrl = `${TDG_API_BASE}/inventory/search`;
        const p = Object.fromEntries(url.searchParams.entries());
        const payload = {};
        if (p.tireSizes)    payload.tireSizes    = p.tireSizes.split(',');
        if (p.brands)       payload.brands       = p.brands.split(',');
        if (p.tireSeason)   payload.tireSeason   = parseInt(p.tireSeason);
        if (p.serviceType)  payload.serviceType  = p.serviceType;
        if (p.itemnumbers)  payload.itemnumbers  = p.itemnumbers.split(',');
        if (p.partnumbers)  payload.partnumbers  = p.partnumbers.split(',');
        if (p.boltPatterns) payload.boltPatterns = p.boltPatterns.split(',');
        if (p.diameters)    payload.diameters    = p.diameters.split(',');
        if (p.widths)       payload.widths       = p.widths.split(',');
        body = JSON.stringify(payload);
        break;
      }

      // Get all products (large payload)
      case 'all':
        tdgUrl = `${TDG_API_BASE}/product/all`;
        body = JSON.stringify({});
        break;

      // Get shipping addresses
      case 'shippingAddresses':
        tdgUrl = `${TDG_API_BASE}/account/shippingAddresses`;
        body = null;
        break;

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: CORS });
    }

    const res  = await fetch(tdgUrl, {
      method: body !== null ? 'POST' : 'GET',
      headers: HEADERS,
      ...(body !== null ? { body } : {}),
    });

    const text = await res.text();
    return new Response(text, { status: res.status, headers: CORS });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy error', message: err.message }), {
      status: 500, headers: CORS,
    });
  }
}
