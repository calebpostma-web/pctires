// functions/vin-decode.js
// Fallback VIN → year/make/model when NHTSA vPIC returns an incomplete decode.
//
// Why this exists: some Canadian-market VINs (confirmed: Toyota Canada 2021+ Sienna,
// 5TD?SKFC…) come back from NHTSA with Model Year + Manufacturer Name + Series but
// NO Make/Model. tech.html used to bail to "VIN decode incomplete".
//
// Order of precedence:
//   1. Local table of known Canadian-coded patterns (deterministic, no API call).
//   2. Make derived from NHTSA "Manufacturer Name" + model from Claude (source: 'ai').
//
// NOT safety-critical on its own, but a wrong model feeds the torque cascade, so
// tech.html always routes an AI/table result through the Manual Entry modal for a
// tap-to-confirm before specs load. Torque still gets its own badge as usual.

const KNOWN = [
  // WMI + positions 4-8 (regex on first 8 chars). Keep this small and certain.
  // Verified in the bay 2026-09-07: 5TDGSKFC3RS124540 = 2024 Sienna Hybrid AWD (AXLH45, 235/65R17).
  // US Siennas code as 5TD?RKEC and decode fine at NHTSA; Canadian ones code as 5TD?SKFC and don't.
  { re: /^5TD[A-Z]SKFC/, make: 'Toyota', model: 'Sienna', note: 'Canadian-market Sienna Hybrid (AXLH40/45)' },
  // Add more here ONLY after confirming against a real vehicle. Anything else goes to AI + tech confirm.
];

const BRANDS = [
  'TOYOTA','LEXUS','HONDA','ACURA','NISSAN','INFINITI','MAZDA','SUBARU','MITSUBISHI',
  'HYUNDAI','KIA','GENESIS','FORD','LINCOLN','CHEVROLET','GMC','BUICK','CADILLAC',
  'CHRYSLER','DODGE','JEEP','RAM','VOLKSWAGEN','AUDI','BMW','MERCEDES','VOLVO','TESLA',
  'PORSCHE','LAND ROVER','JAGUAR','MINI',
];

// Corporate names that don't contain the retail brand.
const CORPORATE = [
  { re: /GENERAL MOTORS|GM /, make: null },        // Chev/GMC/Buick/Cadillac — leave to AI
  { re: /FCA|STELLANTIS|CHRYSLER/, make: null },   // Chrysler/Dodge/Jeep/Ram — leave to AI
  { re: /HONDA/, make: 'Honda' },
  { re: /TOYOTA/, make: 'Toyota' },
];

function titleCase(s) {
  return String(s || '').toLowerCase().split(' ').map(w => w[0] ? w[0].toUpperCase() + w.slice(1) : '').join(' ');
}

function makeFromManufacturer(name) {
  const n = String(name || '').toUpperCase();
  for (const c of CORPORATE) if (c.re.test(n)) return c.make;
  for (const b of BRANDS) if (n.includes(b)) return titleCase(b);
  return null;
}

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

// Server-side NHTSA vPIC lookup. Returns null if unreachable / not JSON.
async function nhtsaFromServer(vin) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(vin)}?format=json`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const d = await r.json();
    const rows = d && Array.isArray(d.Results) ? d.Results : [];
    const get = (name) => { const row = rows.find(x => x.Variable === name); return row && row.Value ? String(row.Value) : ''; };
    const make = get('Make'), model = get('Model');
    const trimRaw = get('Trim') || get('Series');
    const trim = /^\d+\s*series$/i.test(trimRaw) ? '' : trimRaw;
    return {
      year: Number(get('Model Year')) || null,
      make: make ? titleCase(make) : null,
      model: model || null,
      trim,
      partial: {
        year: Number(get('Model Year')) || null,
        manufacturer: get('Manufacturer Name'),
        series: get('Series'),
        plant: get('Plant City'),
        vehicleType: get('Vehicle Type'),
        drive: get('Drive Type'),
        fuel: get('Fuel Type - Primary'),
        electrification: get('Electrification Level'),
      },
    };
  } catch {
    return null;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const body = await request.json();
    const vin = String(body.vin || '').toUpperCase().trim();
    if (!VIN_RE.test(vin)) return json({ ok: false, error: 'Invalid VIN' }, 400);

    // Whatever NHTSA did give us (all optional).
    let n = body.nhtsa || {};

    // 0. Phone couldn't reach NHTSA at all → try from here (Cloudflare's network, 6 s cap).
    //    A full answer short-circuits everything; a partial one feeds the steps below.
    if (!n.year && !n.manufacturer) {
      const fromServer = await nhtsaFromServer(vin);
      if (fromServer) {
        if (fromServer.make && fromServer.model) {
          return json({ ok: true, year: fromServer.year, make: fromServer.make, model: fromServer.model, trim: fromServer.trim, source: 'nhtsa', confidence: 'high' });
        }
        n = fromServer.partial;
      }
    }
    const year = Number(n.year) || null;
    const manufacturer = n.manufacturer || '';
    // NHTSA "Series" is sometimes a real trim ("XLE") and sometimes junk ("45 Series") — drop the junk.
    const rawSeries = String(n.series || '').trim();
    const series = /^\d+\s*series$/i.test(rawSeries) ? '' : rawSeries;
    const plant = n.plant || '';
    const vehicleType = n.vehicleType || '';
    const drive = n.drive || '';
    const electrification = n.electrification || '';
    const fuel = n.fuel || '';

    // 1. Deterministic table
    for (const k of KNOWN) {
      if (k.re.test(vin)) {
        return json({ ok: true, year, make: k.make, model: k.model, trim: series || '', source: 'table', confidence: 'high', note: k.note });
      }
    }

    // 2. Make from manufacturer name, model from Claude
    const make = makeFromManufacturer(manufacturer);

    if (!env.ANTHROPIC_API_KEY) {
      return json({ ok: !!make, year, make, model: null, trim: series || '', source: 'manufacturer', confidence: make ? 'medium' : 'none' });
    }

    const prompt = `You are decoding a North American VIN that the NHTSA vPIC database could not fully decode (this is common for Canadian-market vehicles, especially Toyota Canada).

VIN: ${vin}
What NHTSA did return:
- Model year: ${year || 'unknown'}
- Manufacturer: ${manufacturer || 'unknown'}
- Series: ${series || 'unknown'}
- Plant: ${plant || 'unknown'}
- Vehicle type: ${vehicleType || 'unknown'}
- Drive: ${drive || 'unknown'}
- Fuel / electrification: ${fuel || 'unknown'} / ${electrification || 'unknown'}

Use the WMI (positions 1-3), the VDS (positions 4-8), model year (position 10) and plant (position 11) to identify the retail make and model name as it appears on the vehicle (e.g. "Toyota" / "Sienna", not a model code). Only name a model you are confident about from the VIN structure; otherwise use null.

Respond with ONLY a JSON object, no other text:
{"make":"Toyota","model":"Sienna","trim":"LE AWD Hybrid or null","confidence":"high|medium|low"}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        // Same model vin-scan.js uses (known-good on this account). Override with a
        // VIN_DECODE_MODEL env var in Cloudflare when models rotate.
        model: env.VIN_DECODE_MODEL || 'claude-opus-4-5',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      // Surface the reason instead of silently returning nothing (vin-scan.js hides these).
      return json({ ok: !!make, year, make, model: null, trim: series || '', source: 'manufacturer', confidence: make ? 'medium' : 'none', aiError: data?.error?.message || `HTTP ${res.status}` });
    }

    const raw = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
    let ai = {};
    try { ai = JSON.parse(raw); } catch { ai = {}; }

    const aiMake = typeof ai.make === 'string' && ai.make.trim() ? titleCase(ai.make.trim()) : null;
    const aiModel = typeof ai.model === 'string' && ai.model.trim() && ai.model.trim().length <= 40 ? ai.model.trim() : null;
    const aiTrim = typeof ai.trim === 'string' && ai.trim.trim() && ai.trim.trim().toLowerCase() !== 'null' ? ai.trim.trim() : '';
    const confidence = ['high', 'medium', 'low'].includes(ai.confidence) ? ai.confidence : 'low';

    // Manufacturer-derived make wins over AI make when both exist (it's deterministic).
    const finalMake = make || aiMake;

    return json({
      ok: !!(finalMake || aiModel),
      year,
      make: finalMake,
      model: aiModel,
      trim: aiTrim || series || '',
      source: aiModel ? 'ai' : 'manufacturer',
      confidence: aiModel ? confidence : (finalMake ? 'medium' : 'none'),
    });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
