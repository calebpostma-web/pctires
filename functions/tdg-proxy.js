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

const ACTION_MAP = {
  search:           `${TDG_API_BASE}/product/search`,
  inventory:        `${TDG_API_BASE}/inventory/search`,
  all:              `${TDG_API_BASE}/product/all`,
  shippingAddresses:`${TDG_API_BASE}/account/shippingAddresses`,
  shippingMethods:  `${TDG_API_BASE}/account/shippingMethods`,
  paymentMethods:   `${TDG_API_BASE}/account/paymentMethods`,
  pickupLocations:  `${TDG_API_BASE}/account/pickuplocations`,
  orderCreate:      `${TDG_API_BASE}/order/create`,
  orderStatus:      `${TDG_API_BASE}/order/status`,
  quote:            `${TDG_API_BASE}/order/quote`,
};

const GET_ACTIONS = new Set(['shippingAddresses','shippingMethods','paymentMethods','pickupLocations']);

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    // Read POST body { path, payload }
    let body = {};
    try { body = await request.json(); } catch(e) {}

    const action  = body.path || 'search';
    const payload = body.payload || {};

    const tdgUrl = ACTION_MAP[action];
    if (!tdgUrl) {
      return new Response(JSON.stringify({ error: 'Unknown action: ' + action }), { status: 400, headers: CORS });
    }

    const isGet = GET_ACTIONS.has(action);
    const res = await fetch(tdgUrl, {
      method: isGet ? 'GET' : 'POST',
      headers: HEADERS,
      ...(isGet ? {} : { body: JSON.stringify(payload) }),
    });

    const text = await res.text();
    // Pass non-2xx through with debug header so client can log the actual TDG error
    const respHeaders = { ...CORS };
    if (!res.ok) respHeaders['X-TDG-Status'] = String(res.status);
    return new Response(text, { status: res.status, headers: respHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy error', message: err.message }), {
      status: 500, headers: CORS,
    });
  }
}
