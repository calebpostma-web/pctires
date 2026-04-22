// tech-vehicle-type.js
// Classifies a vehicle as car / truck_suv / van / unknown based on make + model.
// Used by the torque lookup cascade to hint Halderman which catchall tier to prefer.
//
// ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
// Halderman's 1995-2021 chart groups entries under a make, then splits into
// "All Other Car Models" (car catchall) and "All Other Light Truck, SUV & Van
// Models" (truck catchall). For makes like Cadillac or Lincoln, a truck-platform
// SUV (Escalade, Navigator) falls to the CAR catchall unless the matcher knows
// to prefer the TRUCK catchall. This file provides that hint.
//
// Policy: be CONSERVATIVE. Default to unknown when uncertain. The caller will
// still return a torque value either way — this just reorders catchall priority.
// False positives (calling a car a truck) are more dangerous than misses.
//
// Maintenance: add entries as new platforms come out. For makes whose entire
// catalogue is trucks/SUVs (Jeep, Ram, Hummer), use { all: 'truck_suv' }.

const RULES = {
  // ═══════════════════════════════════════════════════════════════════════════
  // DOMESTIC (GM, Ford, Stellantis)
  // ═══════════════════════════════════════════════════════════════════════════

  cadillac: {
    truck_suv: ['escalade', 'srx', 'xt4', 'xt5', 'xt6', 'xt7', 'lyriq'],
    // Cars: ATS, CTS, CT4, CT5, CT6, XTS, DTS, STS, Deville, Catera, Eldorado, Seville, Allante
  },

  chevrolet: {
    truck_suv: [
      'silverado', 'tahoe', 'suburban', 'colorado', 'blazer', 'traverse',
      'equinox', 'trailblazer', 'trax', 'avalanche', 'ssr', 's-10', 's10',
      's-15', 'k5', 'k10', 'k20', 'k1500', 'k2500', 'c/k', 'c1500', 'c2500',
      'astro', 'express', 'city express', 'montana', 'uplander', 'venture',
      'lumina apv', 'hhr', 'captiva', 'tracker', 'geo tracker',
    ],
    van: ['express', 'astro', 'city express', 'g10', 'g20', 'g30'],
  },

  chevy: {
    truck_suv: [
      'silverado', 'tahoe', 'suburban', 'colorado', 'blazer', 'traverse',
      'equinox', 'trailblazer', 'trax', 'avalanche', 's-10', 's10',
    ],
  },

  gmc: {
    // Every GMC is a truck/SUV/van. No cars.
    all: 'truck_suv',
  },

  buick: {
    truck_suv: ['enclave', 'encore', 'envision', 'envista', 'rendezvous', 'rainier', 'terraza'],
    // Cars: LeSabre, Century, Regal, LaCrosse, Lucerne, Cascada, Riviera, Verano
  },

  hummer: {
    all: 'truck_suv',
  },

  ford: {
    truck_suv: [
      'f-150', 'f150', 'f-250', 'f250', 'f-350', 'f350', 'f-450', 'f450',
      'f-550', 'f550', 'ranger', 'maverick', 'lightning',
      'explorer', 'expedition', 'escape', 'edge', 'bronco', 'bronco sport',
      'ecosport', 'flex', 'excursion', 'everest',
      'mustang mach-e', 'mach-e',
    ],
    van: ['transit', 'transit connect', 'e-150', 'e-250', 'e-350', 'e150', 'e250', 'e350', 'econoline', 'aerostar', 'windstar', 'freestar'],
  },

  lincoln: {
    truck_suv: ['navigator', 'aviator', 'corsair', 'nautilus', 'mkc', 'mkt', 'mkx', 'mark lt'],
    // Cars: Town Car, Continental, MKS, MKZ, Mark, LS, Zephyr
  },

  mercury: {
    truck_suv: ['mariner', 'mountaineer', 'villager'],
    van: ['villager', 'monterey'],
  },

  chrysler: {
    truck_suv: ['aspen', 'pacifica'],
    van: ['pacifica', 'voyager', 'town & country', 'town and country', 'grand voyager'],
  },

  dodge: {
    truck_suv: ['durango', 'journey', 'nitro', 'ram', 'dakota', 'raider', 'd100', 'd150', 'd250', 'w150', 'w250', 'ramcharger'],
    van: ['caravan', 'grand caravan', 'b150', 'b250', 'b350', 'sprinter'],
  },

  jeep: {
    all: 'truck_suv',
  },

  ram: {
    all: 'truck_suv',
  },

  plymouth: {
    van: ['voyager', 'grand voyager'],
    // Note: most Plymouths are pre-1998 and outside our range
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIAN
  // ═══════════════════════════════════════════════════════════════════════════

  toyota: {
    truck_suv: [
      'tacoma', 'tundra', '4runner', 'sequoia', 'land cruiser', 'fj cruiser', 'fj',
      'rav4', 'highlander', 'venza', 'c-hr', 'chr', 'corolla cross', 'grand highlander',
      'pickup', 't100', 'bz4x', 'crown signia',
    ],
    van: ['sienna', 'previa', 'van'],
  },

  lexus: {
    truck_suv: ['gx', 'lx', 'rx', 'nx', 'ux', 'tx', 'rz'],
    // Cars: IS, ES, GS, LS, LC, RC, SC, CT, HS
  },

  scion: {
    truck_suv: ['xb'], // arguable, but tall hatch/wagon — keep as car
    // Actually leave xB as default (car)
  },

  honda: {
    truck_suv: ['ridgeline', 'pilot', 'passport', 'cr-v', 'crv', 'hr-v', 'hrv', 'element', 'prologue'],
    van: ['odyssey'],
  },

  acura: {
    truck_suv: ['mdx', 'rdx', 'zdx', 'slx'],
    // Cars: TL, TSX, TLX, RL, RLX, ILX, Integra, Legend, Vigor, CL, RSX, CSX
  },

  nissan: {
    truck_suv: [
      'titan', 'frontier', 'pathfinder', 'armada', 'murano', 'rogue', 'rogue sport',
      'xterra', 'x-terra', 'juke', 'kicks', 'ariya', 'd21', 'hardbody',
      'pickup', 'terrano', 'terra',
    ],
    van: ['quest', 'nv200', 'nv1500', 'nv2500', 'nv3500'],
  },

  infiniti: {
    truck_suv: ['qx4', 'qx30', 'qx50', 'qx55', 'qx56', 'qx60', 'qx70', 'qx80', 'fx', 'fx35', 'fx37', 'fx45', 'fx50', 'ex', 'ex35', 'ex37', 'jx', 'jx35'],
    // Cars: G, Q, M, I, J30
  },

  mazda: {
    truck_suv: ['cx-3', 'cx3', 'cx-30', 'cx30', 'cx-5', 'cx5', 'cx-7', 'cx7', 'cx-9', 'cx9', 'cx-50', 'cx50', 'cx-70', 'cx70', 'cx-90', 'cx90', 'tribute', 'navajo', 'mpv', 'b-series', 'b2300', 'b2500', 'b3000', 'b4000'],
    van: ['mpv'], // Mazda5 existed as a small MPV 2006-2017 but shares Mazda3 car platform; leave as default 'car'
  },

  mitsubishi: {
    truck_suv: ['outlander', 'outlander sport', 'outlander phev', 'eclipse cross', 'rvr', 'asx', 'montero', 'montero sport', 'raider', 'pajero', 'endeavor'],
    van: ['expo', 'van'],
  },

  subaru: {
    truck_suv: ['forester', 'outback', 'ascent', 'tribeca', 'crosstrek', 'xv crosstrek', 'solterra', 'baja'],
    // Cars: Impreza, Legacy, WRX, BRZ
  },

  hyundai: {
    truck_suv: ['santa fe', 'santa cruz', 'tucson', 'palisade', 'kona', 'venue', 'nexo', 'santa fe sport', 'veracruz', 'entourage'],
    van: ['entourage'],
  },

  kia: {
    truck_suv: ['sorento', 'sportage', 'telluride', 'seltos', 'soul', 'niro', 'ev6', 'ev9', 'carnival', 'borrego'],
    van: ['sedona', 'carnival'],
  },

  genesis: {
    truck_suv: ['gv60', 'gv70', 'gv80'],
    // Cars: G70, G80, G90
  },

  suzuki: {
    truck_suv: ['grand vitara', 'vitara', 'sidekick', 'samurai', 'xl7', 'xl-7', 'equator', 'sx4'],
  },

  isuzu: {
    all: 'truck_suv',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EUROPEAN
  // ═══════════════════════════════════════════════════════════════════════════

  bmw: {
    truck_suv: ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'ix', 'ix3', 'xm'],
    // Cars: 2,3,4,5,6,7,8 series, Z3, Z4, i3, i4, i5, i7, i8, M2-M8
  },

  'mercedes-benz': {
    truck_suv: ['gla', 'glb', 'glc', 'gle', 'gls', 'g-class', 'g-wagon', 'g550', 'g55', 'g63', 'g65', 'm-class', 'ml', 'gl', 'gle coupe', 'glc coupe', 'eqb', 'eqc', 'eqe suv', 'eqs suv', 'eqg'],
    van: ['sprinter', 'metris', 'r-class'], // R-class was a crossover MPV
  },

  mercedes: {
    truck_suv: ['gla', 'glb', 'glc', 'gle', 'gls', 'g-class', 'g-wagon', 'm-class', 'ml', 'gl', 'eqb', 'eqc'],
    van: ['sprinter', 'metris'],
  },

  audi: {
    truck_suv: ['q3', 'q4', 'q5', 'q7', 'q8', 'sq5', 'sq7', 'sq8', 'rs q3', 'rs q8', 'e-tron', 'q4 e-tron', 'q8 e-tron'],
    // Cars: A3-A8, S3-S8, RS3-RS7, TT, R8, e-tron GT
  },

  volkswagen: {
    truck_suv: ['atlas', 'atlas cross sport', 'tiguan', 'touareg', 'taos', 'id.4', 'id4', 'id.5', 'id.7', 'id buzz'],
    van: ['routan', 'eurovan', 'id buzz', 'vanagon', 'transporter'],
  },

  vw: {
    truck_suv: ['atlas', 'tiguan', 'touareg', 'taos', 'id.4', 'id4'],
    van: ['routan', 'eurovan'],
  },

  volvo: {
    truck_suv: ['xc40', 'xc60', 'xc70', 'xc90', 'c40', 'ex30', 'ex90'],
    // Cars: S40-S90, V40-V90 (wagons but car-platform)
  },

  porsche: {
    truck_suv: ['cayenne', 'macan'],
    // Cars: 911, Boxster, Cayman, Panamera, Taycan
  },

  'land rover': {
    all: 'truck_suv',
  },

  'range rover': {
    all: 'truck_suv',
  },

  landrover: {
    all: 'truck_suv',
  },

  jaguar: {
    truck_suv: ['f-pace', 'fpace', 'e-pace', 'epace', 'i-pace', 'ipace'],
    // Cars: XE, XF, XJ, F-Type, XK, S-Type, X-Type
  },

  mini: {
    truck_suv: ['countryman', 'paceman'],
    // Cars: Cooper, Clubman (technically a wagon, kept as car)
  },

  fiat: {
    truck_suv: ['500x'],
    // Most Fiats in NA were cars
  },

  alfa: {
    truck_suv: ['stelvio', 'tonale'],
  },

  'alfa romeo': {
    truck_suv: ['stelvio', 'tonale'],
  },

  maserati: {
    truck_suv: ['levante', 'grecale'],
    // Cars: Ghibli, Quattroporte, GranTurismo, GranCabrio
  },

  bentley: {
    truck_suv: ['bentayga'],
  },

  'rolls-royce': {
    truck_suv: ['cullinan'],
  },

  lamborghini: {
    truck_suv: ['urus', 'lm002'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EV / NEW ENTRANTS
  // ═══════════════════════════════════════════════════════════════════════════

  tesla: {
    truck_suv: ['model x', 'model y', 'cybertruck', 'roadster'],
    // Note: Model S and Model 3 are cars
  },

  rivian: {
    all: 'truck_suv',
  },

  lucid: {
    truck_suv: ['gravity'],
    // Cars: Air
  },

  polestar: {
    truck_suv: ['polestar 3', 'polestar 4', '3', '4'],
    // Cars: Polestar 1, 2
  },

  lotus: {
    truck_suv: ['eletre', 'emeya'],
  },

  fisker: {
    truck_suv: ['ocean', 'pear'],
  },

  vinfast: {
    truck_suv: ['vf6', 'vf7', 'vf8', 'vf9'],
  },
};

// ────────────────────────────────────────────────────────────────────────────

function normalize(s) {
  if (s == null) return '';
  return String(s).toLowerCase()
    .replace(/[^a-z0-9/\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Classify a vehicle by make + model.
 * @param {Object} args
 * @param {string} args.make
 * @param {string} args.model
 * @returns {'car'|'truck_suv'|'van'|'unknown'}
 *
 * Matching rules:
 *   - If the make has { all: 'truck_suv' } → every model under it is truck_suv
 *   - Otherwise, check the model against van list first, then truck_suv list
 *   - A list entry matches if the normalized model STARTS WITH the entry, OR
 *     equals it, OR contains it as a whole-word token. This catches trim
 *     suffixes ("F-150 SuperCrew", "Escalade ESV", "CX-5 Signature").
 *   - Unknown make → 'unknown' (don't guess)
 *   - Listed make but model not matched → 'car' (explicit car is safer than
 *     'unknown' when we've already vetted the make)
 */
export function classifyVehicle({ make, model } = {}) {
  const m = normalize(make);
  const mo = normalize(model);
  if (!m || !mo) return 'unknown';

  const rule = RULES[m];
  if (!rule) return 'unknown';

  if (rule.all) return rule.all;

  const matches = (entry) => {
    const e = normalize(entry);
    if (!e) return false;
    if (mo === e) return true;
    if (mo.startsWith(e + ' ')) return true;
    if (mo.startsWith(e + '-')) return true;
    // whole-word token match (model contains entry as its own word)
    const tokens = mo.split(/[\s\-]+/);
    if (tokens.includes(e)) return true;
    return false;
  };

  if (rule.van && rule.van.some(matches)) return 'van';
  if (rule.truck_suv && rule.truck_suv.some(matches)) return 'truck_suv';

  return 'car';
}

// Expose the rules for admin/inspection UIs. Do not mutate externally.
export const VEHICLE_TYPE_RULES = RULES;
