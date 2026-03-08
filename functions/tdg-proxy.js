/**
 * Cloudflare Pages Function: /functions/tdg-proxy.js
 * Proxies requests to the TDG (The Dealers Group) API
 * Replaces the old Netlify function at glittery-banoffee-1b1d80.netlify.app
 */

const TDG_API_BASE = 'https://www.tdgaccess.ca/api';
const TDG_API_KEY  = 'rst715Wr18hFpHpbi346TGuMLBBQDZZbF5lHZQSi27hfpLGey3TH3YRHYWWPJRyi7rkx';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export async function onRequest(context) {
  const { request } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const url    = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());

    // Determine which TDG endpoint to call based on "action" param
    const action = params.action || 'search';
    delete params.action;

    let tdgUrl;
    let tdgBody = null;
    let method  = 'GET';

    switch (action) {
      case 'years':
        tdgUrl = `${TDG_API_BASE}/vehicles/years`;
        break;
      case 'makes':
        tdgUrl = `${TDG_API_BASE}/vehicles/makes?year=${params.year || ''}`;
        break;
      case 'models':
        tdgUrl = `${TDG_API_BASE}/vehicles/models?year=${params.year || ''}&make=${params.make || ''}`;
        break;
      case 'trims':
        tdgUrl = `${TDG_API_BASE}/vehicles/trims?year=${params.year || ''}&make=${params.make || ''}&model=${params.model || ''}`;
        break;
      case 'search':
      default: {
        // POST search to TDG
        method  = 'POST';
        tdgUrl  = `${TDG_API_BASE}/products/search`;

        const body = {
          apiKey: TDG_API_KEY,
          productType: params.productType || 'Tire',
          pageSize: parseInt(params.pageSize) || 24,
          page: parseInt(params.page) || 1,
        };

        // Tire-specific filters
        if (params.width)    body.width    = params.width;
        if (params.ratio)    body.ratio    = params.ratio;
        if (params.diameter) body.diameter = params.diameter;
        if (params.season)   body.season   = params.season;
        if (params.brand)    body.brand    = params.brand;

        // Vehicle-based lookup
        if (params.year)  body.year  = params.year;
        if (params.make)  body.make  = params.make;
        if (params.model) body.model = params.model;
        if (params.trim)  body.trim  = params.trim;

        // Wheel-specific filters
        if (params.boltPattern)  body.boltPattern  = params.boltPattern;
        if (params.boltPatterns) body.boltPatterns = params.boltPatterns;
        if (params.diameters)    body.diameters    = params.diameters;
        if (params.widths)       body.widths       = params.widths;
        if (params.finish)       body.finish       = params.finish;

        tdgBody = JSON.stringify(body);
        break;
      }
    }

    // Build fetch options
    const fetchOpts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TDG_API_KEY}`,
        'x-api-key': TDG_API_KEY,
      },
    };
    if (tdgBody) fetchOpts.body = tdgBody;

    const tdgRes  = await fetch(tdgUrl, fetchOpts);
    const tdgData = await tdgRes.json();

    return new Response(JSON.stringify(tdgData), {
      status: tdgRes.status,
      headers: CORS_HEADERS,
    });

  } catch (err) {
    console.error('TDG proxy error:', err);
    return new Response(JSON.stringify({ error: 'Proxy error', message: err.message }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}
