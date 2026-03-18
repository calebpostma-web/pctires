/**
 * Cloudflare Pages Function: /functions/tdg-proxy.js
 * Proxies requests to the TDG Access API
 * Reads action + payload from POST JSON body.
 */

const TDG_API_BASE = 'https://www.tdgaccess.ca/api';
const TDG_API_KEY  = 'rst715Wr18hFpHpbi346TGuMLBBQDZZbF5lHZQSi27hfpLGey3TH3YRHYWWPJRyi7rkx';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const AUTH = {
  'Content-Type': 'application/json',
  'Authorization': `ApiKey ${TDG_API_KEY}`,
};

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    let action = 'search';
    let payload = {};

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        action  = body.path    || body.action || 'search';
        payload = body.payload || {};
      } catch {
        // malformed body — fall through with defaults
      }
    } else {
      const url = new URL(request.url);
      const p   = Object.fromEntries(url.searchParams.entries());
      action = p.action || 'search';
      const toArray = v => v ? (Array.isArray(v) ? v : v.split(',').map(s => s.trim()).filter(Boolean)) : undefined;
      if (p.tireSizes)    payload.tireSizes    = toArray(p.tireSizes);
      if (p.brands)       payload.brands       = toArray(p.brands);
      if (p.tireSeason)   payload.tireSeason   = parseInt(p.tireSeason);
      if (p.serviceType)  payload.serviceType  = p.serviceType;
      if (p.itemnumbers)  payload.itemnumbers  = toArray(p.itemnumbers);
      if (p.partnumbers)  payload.partnumbers  = toArray(p.partnumbers);
      if (p.boltPatterns) payload.boltPatterns = toArray(p.boltPatterns);
      if (p.diameters)    payload.diameters    = toArray(p.diameters);
      if (p.widths)       payload.widths       = toArray(p.widths);
    }

    let tdgUrl;
    let method   = 'POST';
    let sendBody = true;

    switch (action) {
      case 'search':        tdgUrl = `${TDG_API_BASE}/product/search`;           break;
      case 'inventory':     tdgUrl = `${TDG_API_BASE}/inventory/search`;         break;
      case 'all':           tdgUrl = `${TDG_API_BASE}/product/all`;              break;
      case 'inventoryAll':  tdgUrl = `${TDG_API_BASE}/inventory/all`;  method = 'GET'; sendBody = false; break;
      case 'shippingAddresses': tdgUrl = `${TDG_API_BASE}/account/shippingAddresses`; method = 'GET'; sendBody = false; break;
      case 'shippingMethods':   tdgUrl = `${TDG_API_BASE}/account/shippingMethods`;   method = 'GET'; sendBody = false; break;
      case 'paymentMethods':    tdgUrl = `${TDG_API_BASE}/account/paymentMethods`;    method = 'GET'; sendBody = false; break;
      case 'pickupLocations':   tdgUrl = `${TDG_API_BASE}/account/pickuplocations`;   method = 'GET'; sendBody = false; break;
      case 'quote':         tdgUrl = `${TDG_API_BASE}/order/quote`;              break;
      case 'orderCreate':   tdgUrl = `${TDG_API_BASE}/order/create`;             break;
      case 'orderStatus':   tdgUrl = `${TDG_API_BASE}/order/status`;             break;
      default:
        return new Response(JSON.stringify({ error: 'Unknown action', action }), { status: 400, headers: CORS });
    }

    const res  = await fetch(tdgUrl, {
      method,
      headers: AUTH,
      ...(sendBody ? { body: JSON.stringify(payload) } : {}),
    });

    const text = await res.text();
    return new Response(text, { status: res.status, headers: CORS });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy error', message: err.message }), {
      status: 500, headers: CORS,
    });
  }
}
