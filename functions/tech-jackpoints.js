// /functions/tech-jackpoints.js
// Cloudflare Pages Function — rule-based jack point guidance.
//
// Returns construction type (unibody / body-on-frame), generic jacking guidance
// for that construction, and any model-specific safety warnings (EV battery,
// BMW plastic plugs, aluminum-body Ford, air suspension, etc.).
//
// POST /tech-jackpoints with { year, make, model, trim }
// → { ok, construction, guidance: {jack, stands, pad}, warnings: [{level,title,detail}] }
//
// Policy: be CONSERVATIVE. Default to unibody for unknown passenger vehicles
// (correct for 90%+ of modern cars/SUVs). Body-on-frame is an explicit list.
// Warnings err on the side of firing extra rather than missing — false positives
// just give the tech more to read, false negatives can damage a vehicle.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS });
}

function norm(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9\s\-.]/g, '').replace(/\s+/g, ' ').trim();
}

// ─── BODY-ON-FRAME RULES ────────────────────────────────────────────────────
// Match make + model against these. Anything not on the list defaults to unibody.
// Notable exceptions intentionally NOT on this list (they're unibody):
//   Honda Ridgeline, Ford Maverick, Hyundai Santa Cruz (unibody pickups)
//   Ford Transit, Dodge ProMaster (unibody-monocoque commercial vans)
//   2011+ Ford Explorer, 2013+ Nissan Pathfinder (became unibody)
const BOF = [
  // ── Pickups ──
  { make: /^ford$/,                  model: /^f-?(150|250|350|450|550|600|650|750)\b|^ranger\b|^super\s*duty\b/ },
  { make: /^(chevrolet|chevy)$/,     model: /^silverado\b|^colorado\b|^avalanche\b|^s-?10\b/ },
  { make: /^gmc$/,                   model: /^sierra\b|^canyon\b/ },
  { make: /^ram$/,                   model: /./ },
  { make: /^dodge$/,                 model: /^ram\b|^dakota\b/ },
  { make: /^toyota$/,                model: /^tacoma\b|^tundra\b/ },
  { make: /^nissan$/,                model: /^frontier\b|^titan\b|^hardbody\b|^d21\b/ },
  { make: /^jeep$/,                  model: /^gladiator\b/ },

  // ── Traditional truck-based SUVs ──
  { make: /^toyota$/,                model: /^4runner\b|^sequoia\b|^land\s*cruiser\b|^fj\s*cruiser\b/ },
  { make: /^lexus$/,                 model: /^gx\b|^lx\b/ },
  { make: /^nissan$/,                model: /^armada\b|^xterra\b/ },
  { make: /^infiniti$/,              model: /^qx56\b|^qx80\b/ },
  { make: /^(chevrolet|chevy)$/,     model: /^tahoe\b|^suburban\b/ },
  { make: /^gmc$/,                   model: /^yukon\b/ },
  { make: /^cadillac$/,              model: /^escalade\b/ },
  { make: /^ford$/,                  model: /^expedition\b|^excursion\b|^bronco(?!\s*sport)\b/ },
  { make: /^lincoln$/,               model: /^navigator\b/ },
  { make: /^jeep$/,                  model: /^wrangler\b|^grand\s*wagoneer\b|^wagoneer\b/ },
  { make: /^mercedes(-benz)?$/,      model: /^g-?class\b|^g\s*\d{2,3}\b|^g-?wagon\b/ },
  { make: /^hummer$/,                model: /^h[123]\b/ },

  // ── Full-size frame-based vans ──
  { make: /^mercedes(-benz)?$/,      model: /^sprinter\b/ },
  { make: /^ford$/,                  model: /^e-?(150|250|350|450)\b|^econoline\b/ },
  { make: /^(chevrolet|chevy)$/,     model: /^express\b/ },
  { make: /^gmc$/,                   model: /^savana\b/ },
  { make: /^nissan$/,                model: /^nv(1500|2500|3500|200)\b/ },
];

// ─── WARNING RULES ──────────────────────────────────────────────────────────
// level: 'critical' (red) | 'warning' (amber) | 'info' (blue)
// test(make, model, year) → boolean
const WARNINGS = [
  // ── EVs with battery pack underneath ──
  {
    level: 'critical',
    title: 'EV battery pack underneath — use pads at marked points only',
    detail: 'Battery occupies the floor. Wrong spot can crush the pack housing. Look up puck/cushion locations in the owner\'s manual before lifting.',
    test: (m) => /^(tesla|rivian|lucid|polestar|fisker|vinfast)$/.test(m),
  },
  {
    level: 'critical',
    title: 'EV battery pack underneath — use pads at marked points only',
    detail: 'Floor IS the battery pack. Use designated lift points only — typically rubber pad locations near the rocker or subframe.',
    test: (m, mo) => /\blightning\b|\bmach-?e\b|^solterra\b|^bz4x\b|^ariya\b|^leaf\b|^bolt\b|^volt\b|^prologue\b|^lyriq\b|^equinox\s*ev\b|^blazer\s*ev\b|^silverado\s*ev\b|^hummer\s*ev\b|^ioniq\s*[56]\b|^ev6\b|^ev9\b|^kona\s*electric\b|^id\.?\s*[4567]\b|^id\s*buzz\b|^i[3-7]\b|^ix\b|^eqb\b|^eqc\b|^eqe\b|^eqs\b|^etron\b|^e-tron\b|^taycan\b/i.test(mo),
  },

  // ── Tesla-specific puck adapters ──
  {
    level: 'critical',
    title: 'Tesla — puck/cushion adapters required',
    detail: 'Tesla designates four puck locations behind the wheels. Without the rubber adapter, the jack cup will damage the pinch weld AND the battery pack edge.',
    test: (m) => /^tesla$/.test(m),
  },

  // ── BMW / Mini plastic pinch weld plugs ──
  {
    level: 'warning',
    title: 'BMW/Mini plastic pinch weld plugs',
    detail: 'Use a slotted or U-shaped jack pad adapter. A bare jack cup will crush the plastic plug and bend the pinch weld behind it.',
    test: (m) => /^(bmw|mini)$/.test(m),
  },

  // ── Aluminum-body Ford ──
  {
    level: 'warning',
    title: 'Aluminum body — use marked jack points only',
    detail: 'F-150 cab & bed are aluminum from 2015. Random body locations will dent or crack. Owner\'s manual diagrams the specific lift points.',
    test: (m, mo, y) => /^ford$/.test(m) && /^f-?150\b/.test(mo) && Number(y) >= 2015,
  },
  {
    level: 'warning',
    title: 'Aluminum cab — use marked jack points only',
    detail: 'Super Duty cab went aluminum in 2017. Use designated points only — bed may still be steel but cab dents easily.',
    test: (m, mo, y) => /^ford$/.test(m) && /^f-?(250|350|450|550)\b/.test(mo) && Number(y) >= 2017,
  },

  // ── Air suspension (likely on these models) ──
  // Range Rover is sometimes recorded as its own make ("Range Rover Sport") and
  // sometimes under Land Rover ("Range Rover Sport"). Catch both.
  {
    level: 'warning',
    title: 'Likely air suspension — engage jack/service mode first',
    detail: 'Put vehicle in jack mode (menu setting or button) BEFORE lifting. Otherwise the system tries to self-level and may damage struts.',
    test: (m, mo) => /^range\s*rover$/.test(m)
                  || /^range\s*rover\b|^discovery\b|^q7\b|^q8\b|^a8\b|^7\s*series\b|^x5\b|^x6\b|^x7\b|^touareg\b|^bentayga\b|^cullinan\b|^urus\b|^cayenne\b|^panamera\b|^s-?class\b|^gle\b|^gls\b|^maybach\b/i.test(mo),
  },
  {
    level: 'info',
    title: 'Check for air suspension on higher trims',
    detail: 'Top trims of this model often have air ride (e.g. Capstone, Platinum, Premium, Wagoneer Series III). If equipped, engage jack mode before lifting.',
    test: (m, mo, y) => /^tundra\b|^tahoe\b|^suburban\b|^yukon\b|^escalade\b|^expedition\b|^navigator\b|^qx80\b|^armada\b|^wagoneer\b|^grand\s*wagoneer\b|^ram\b|^1500\b/.test(mo) && Number(y) >= 2019,
  },

  // ── Very low cars (clearance) ──
  {
    level: 'info',
    title: 'Low clearance — may need ramps or low-profile jack',
    detail: 'Standard floor jack may not fit under the front lip. Use a low-profile jack or run vehicle onto ramps first.',
    test: (m, mo) => /^corvette\b|^viper\b|^gt-?r\b|^nsx\b|^mr2\b|^miata\b|^s2000\b|^mx-?5\b|^supra\b|^cayman\b|^boxster\b|^911\b|^huracan\b|^aventador\b|^f-?type\b|^vantage\b|^db\d/i.test(mo),
  },
];

// ─── CONSTRUCTION-BASED GUIDANCE ────────────────────────────────────────────
const GUIDANCE = {
  unibody: {
    jack: 'Front subframe / rear subframe or cross-member — the welded reinforced area, not the floor pan.',
    stands: 'Four pinch welds along the rocker panel, one behind each wheel. Look for an arrow, notch, or slot in the seam marking the exact pad spot.',
    pad: 'Always a rubber pad or wood block between the jack cup and the pinch weld. Bare metal will crush the seam.',
  },
  body_on_frame: {
    jack: 'Frame rails or axle housing. Avoid plastic skid plates, oil pan, transmission pan, and the differential cover (jack the axle tube itself if rear-lifting).',
    stands: 'Frame rails or axle housing. Never on the differential cover, fuel tank straps, or exhaust.',
    pad: 'Rubber/wood pad helps but isn\'t strictly required on steel frame. Required on aluminum-body trucks (newer F-150, Super Duty).',
  },
  unknown: {
    jack: 'Unrecognized vehicle — consult owner\'s manual. Most modern vehicles are unibody (use pinch welds / subframes).',
    stands: 'Owner\'s manual diagrams exact pad locations. Look for arrow or notch markings on the rocker panel.',
    pad: 'Always use a pad between jack cup and any sheet metal. Never bare jack on a pinch weld.',
  },
};

// ─── CLASSIFIER ─────────────────────────────────────────────────────────────
function getConstruction(make, model) {
  const m = norm(make), mo = norm(model);
  if (!m || !mo) return 'unknown';
  for (const rule of BOF) {
    if (rule.make.test(m) && rule.model.test(mo)) return 'body_on_frame';
  }
  return 'unibody';
}

function getWarnings(make, model, year) {
  const m = norm(make), mo = norm(model);
  if (!m || !mo) return [];
  const fired = [];
  for (const w of WARNINGS) {
    try {
      if (w.test(m, mo, year)) fired.push({ level: w.level, title: w.title, detail: w.detail });
    } catch (e) { /* skip rule on test error */ }
  }
  return fired;
}

export function getJackPoints({ year, make, model } = {}) {
  const construction = getConstruction(make, model);
  const guidance = GUIDANCE[construction] || GUIDANCE.unknown;
  const warnings = getWarnings(make, model, year);
  return { construction, guidance, warnings };
}

// ─── HTTP HANDLER ───────────────────────────────────────────────────────────
export async function onRequestPost(context) {
  let body = {};
  try { body = await context.request.json(); } catch (e) {}
  const { year, make, model } = body || {};
  if (!make || !model) return json({ ok: false, error: 'Missing make/model' }, 400);
  const result = getJackPoints({ year, make, model });
  return json({ ok: true, ...result });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
