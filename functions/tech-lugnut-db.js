// /functions/tech-lugnut-db.js
// Published OEM lug hardware specs - thread, hex (socket), seat, nut/bolt.
// Curated like the torque overlay: model-specific entries first, make
// defaults second, first match wins. Threads are only included where
// confident - anything uncertain is omitted and falls through to the
// AI fallback (/tech-specs) with the amber Verify badge.
//
// seat values: 'conical' (60 deg taper) | 'ball' (radius - VW/Audi/MB/Porsche,
//              Honda OEM alloys) | 'mag' (flat washer / shank style - Toyota
//              trucks, some Toyota/Lexus OEM alloys) | 'flat'
// type values: 'nut' | 'bolt'
// hexMm: factory socket size. OEM capped nuts swell - a 19 may need 20/21.
//        null = not confident, verify in the bay.
//
// STOCKED_LUGS mirrors the shop's Lug Hardware Bay Card (June 2026).
// Update this list when stock changes.

export const STOCKED_LUGS = [
  { kit: 'KIT902',  thread: 'M14x1.5',  seat: 'conical', type: 'nut'  },
  { kit: 'KIT903',  thread: 'M14x2.0',  seat: 'conical', type: 'nut'  },
  { kit: 'KIT900',  thread: 'M12x1.5',  seat: 'conical', type: 'nut'  },
  { kit: 'KIT905',  thread: 'M12x1.25', seat: 'conical', type: 'nut'  },
  { kit: 'TMS1215', thread: 'M12x1.5',  seat: 'mag',     type: 'nut'  },
  { kit: 'KIT115',  thread: 'M12x1.25', seat: 'conical', type: 'bolt' },
  { kit: 'JOBBER 1/2-20', thread: '1/2"-20', seat: 'conical', type: 'nut' },
];

// Returns the stocked kit name if the spec is covered by shop stock, else null.
export function matchStockKit(lug) {
  if (!lug || !lug.thread) return null;
  const seatEq = s => (s === 'shank' ? 'mag' : s);
  const hit = STOCKED_LUGS.find(k =>
    k.thread.toLowerCase() === String(lug.thread).toLowerCase() &&
    seatEq(k.seat) === seatEq(lug.seat) &&
    k.type === lug.type
  );
  return hit ? hit.kit : null;
}

// models: regex string tested against the normalized model name, or null
// for a make-level default. Order matters - first match wins, so model
// entries are listed before make defaults.
const LUG_DB = [

  // ── FORD / LINCOLN ────────────────────────────────────────────────
  { makes: ['ford', 'lincoln'], models: 'f-?150|expedition|navigator|mark lt', yearFrom: 2015, yearTo: 2026,
    thread: 'M14x1.5', hexMm: 21, seat: 'conical', type: 'nut', note: '' },
  { makes: ['ford', 'lincoln'], models: 'f-?150|expedition|navigator|mark lt', yearFrom: 2004, yearTo: 2014,
    thread: 'M14x2.0', hexMm: 21, seat: 'conical', type: 'nut', note: 'M14x2.0 - never run a 14x1.5 nut on these studs' },
  { makes: ['ford', 'lincoln'], models: 'f-?150|expedition|navigator', yearFrom: 1997, yearTo: 2003,
    thread: 'M12x1.75', hexMm: null, seat: 'conical', type: 'nut', note: 'Verify socket - capped nuts swell' },
  { makes: ['ford'], models: 'f-?(250|350|450|550)|super ?duty', yearFrom: 1999, yearTo: 2026,
    thread: 'M14x1.5', hexMm: null, seat: 'conical', type: 'nut', note: 'Verify socket size' },
  { makes: ['ford'], models: 'mustang', yearFrom: 2015, yearTo: 2026,
    thread: 'M14x1.5', hexMm: 21, seat: 'conical', type: 'nut', note: '' },
  { makes: ['ford'], models: 'ranger', yearFrom: 1998, yearTo: 2011,
    thread: 'M12x1.75', hexMm: null, seat: 'conical', type: 'nut', note: '' },
  { makes: ['ford', 'lincoln', 'mercury'], models: null, yearFrom: 1995, yearTo: 2026,
    thread: 'M12x1.5', hexMm: 19, seat: 'conical', type: 'nut', note: 'Capped OEM nuts swell - may need 20/21mm socket' },

  // ── GM TRUCKS / SUVS ──────────────────────────────────────────────
  { makes: ['chevrolet', 'gmc', 'cadillac'], models: 'silverado|sierra|tahoe|suburban|yukon|escalade|avalanche|express|savana|c[/ ]?k ?(15|25|35)00|hummer', yearFrom: 1995, yearTo: 2026,
    thread: 'M14x1.5', hexMm: 22, seat: 'conical', type: 'nut', note: '' },
  // GM cars / crossovers
  { makes: ['chevrolet', 'gmc', 'buick', 'cadillac', 'pontiac', 'saturn', 'oldsmobile'], models: null, yearFrom: 1995, yearTo: 2026,
    thread: 'M12x1.5', hexMm: null, seat: 'conical', type: 'nut', note: 'Most GM cars/CUVs - socket varies 19-22mm, verify' },

  // ── RAM / DODGE / CHRYSLER ────────────────────────────────────────
  { makes: ['ram', 'dodge'], models: '1500', yearFrom: 2012, yearTo: 2026,
    thread: 'M14x1.5', hexMm: 22, seat: 'conical', type: 'nut', note: '' },
  { makes: ['ram', 'dodge'], models: '1500', yearFrom: 2002, yearTo: 2011,
    thread: 'M14x2.0', hexMm: 22, seat: 'conical', type: 'nut', note: 'M14x2.0 - never run a 14x1.5 nut on these studs' },
  { makes: ['ram', 'dodge'], models: '2500|3500', yearFrom: 2014, yearTo: 2026,
    thread: 'M14x1.5', hexMm: 22, seat: 'conical', type: 'nut', note: '' },
  { makes: ['ram', 'dodge'], models: '2500|3500', yearFrom: 1994, yearTo: 2013,
    thread: '9/16"-18', hexMm: 22, seat: 'conical', type: 'nut', note: 'SAE thread 9/16"-18 - not metric' },
  { makes: ['dodge', 'chrysler'], models: 'charger|challenger|magnum|^300', yearFrom: 2005, yearTo: 2026,
    thread: 'M14x1.5', hexMm: null, seat: 'conical', type: 'nut', note: 'Verify socket' },
  { makes: ['dodge', 'chrysler'], models: 'caravan|town', yearFrom: 2008, yearTo: 2020,
    thread: 'M12x1.5', hexMm: null, seat: 'conical', type: 'nut', note: '' },
  { makes: ['chrysler'], models: '^200', yearFrom: 2015, yearTo: 2017,
    thread: 'M12x1.25', hexMm: 19, seat: 'conical', type: 'bolt', note: 'Lug BOLTS (Fiat platform) - threads in hub, match bolt length' },
  { makes: ['dodge'], models: 'dart', yearFrom: 2013, yearTo: 2016,
    thread: 'M12x1.25', hexMm: 19, seat: 'conical', type: 'bolt', note: 'Lug BOLTS (Fiat platform) - threads in hub, match bolt length' },

  // ── JEEP (model entries only - no make default, too varied) ───────
  { makes: ['jeep'], models: 'wrangler|gladiator', yearFrom: 2018, yearTo: 2026,
    thread: 'M14x1.5', hexMm: 22, seat: 'conical', type: 'nut', note: '2018 JK carryover = 1/2"-20 - check' },
  { makes: ['jeep'], models: 'wrangler', yearFrom: 1995, yearTo: 2017,
    thread: '1/2"-20', hexMm: 19, seat: 'conical', type: 'nut', note: 'SAE thread' },
  { makes: ['jeep'], models: 'grand cherokee', yearFrom: 2011, yearTo: 2026,
    thread: 'M14x1.5', hexMm: 22, seat: 'conical', type: 'nut', note: '' },
  { makes: ['jeep'], models: 'grand cherokee|^cherokee|liberty', yearFrom: 1995, yearTo: 2010,
    thread: '1/2"-20', hexMm: 19, seat: 'conical', type: 'nut', note: 'SAE thread' },
  { makes: ['jeep'], models: 'compass|patriot', yearFrom: 2007, yearTo: 2016,
    thread: 'M12x1.5', hexMm: null, seat: 'conical', type: 'nut', note: '' },
  { makes: ['jeep'], models: 'renegade', yearFrom: 2015, yearTo: 2023,
    thread: 'M12x1.25', hexMm: 19, seat: 'conical', type: 'bolt', note: 'Lug BOLTS (Fiat platform) - threads in hub, match bolt length' },

  // ── FIAT ──────────────────────────────────────────────────────────
  { makes: ['fiat'], models: null, yearFrom: 2012, yearTo: 2026,
    thread: 'M12x1.25', hexMm: 19, seat: 'conical', type: 'bolt', note: 'Lug BOLTS - verify length' },

  // ── TOYOTA / LEXUS / SCION ────────────────────────────────────────
  { makes: ['toyota'], models: 'tundra|sequoia', yearFrom: 2008, yearTo: 2026,
    thread: 'M14x1.5', hexMm: 22, seat: 'mag', type: 'nut', note: 'Mag/washer style - conical will not seat on factory wheels' },
  { makes: ['toyota'], models: 'tundra|sequoia', yearFrom: 2000, yearTo: 2007,
    thread: 'M12x1.5', hexMm: 21, seat: 'mag', type: 'nut', note: 'Factory wheels = mag/washer (TMS1215)' },
  { makes: ['toyota'], models: 'land cruiser', yearFrom: 1998, yearTo: 2026,
    thread: 'M14x1.5', hexMm: null, seat: 'mag', type: 'nut', note: 'Verify socket' },
  { makes: ['lexus'], models: '^lx', yearFrom: 1998, yearTo: 2026,
    thread: 'M14x1.5', hexMm: null, seat: 'mag', type: 'nut', note: 'Verify socket' },
  { makes: ['toyota'], models: 'tacoma|4runner|4-runner|fj cruiser', yearFrom: 1995, yearTo: 2026,
    thread: 'M12x1.5', hexMm: 21, seat: 'mag', type: 'nut', note: 'Factory wheels = mag/washer (TMS1215). Conical only on aftermarket.' },
  { makes: ['toyota'], models: 'supra', yearFrom: 2020, yearTo: 2026,
    thread: 'M14x1.25', hexMm: 17, seat: 'conical', type: 'bolt', note: 'BMW platform - lug BOLTS' },
  { makes: ['toyota', 'lexus', 'scion'], models: null, yearFrom: 1995, yearTo: 2026,
    thread: 'M12x1.5', hexMm: 21, seat: 'conical', type: 'nut', note: 'OEM alloys may use mag/washer-style nuts - verify seat' },

  // ── HONDA / ACURA ─────────────────────────────────────────────────
  { makes: ['honda', 'acura'], models: 'pilot|odyssey|ridgeline|passport|mdx', yearFrom: 2018, yearTo: 2026,
    thread: 'M14x1.5', hexMm: 19, seat: 'conical', type: 'nut', note: 'Larger Hondas moved to M14x1.5 mid-2010s - verify on early redesign years' },
  { makes: ['honda', 'acura'], models: null, yearFrom: 1995, yearTo: 2026,
    thread: 'M12x1.5', hexMm: 19, seat: 'conical', type: 'nut', note: 'OEM Honda alloys use BALL-seat nuts (not stocked) - conical OK on aftermarket/steel only' },

  // ── NISSAN / INFINITI ─────────────────────────────────────────────
  { makes: ['nissan'], models: 'titan', yearFrom: 2016, yearTo: 2026,
    thread: 'M14x1.5', hexMm: null, seat: 'conical', type: 'nut', note: 'Incl. Titan XD - verify socket' },
  { makes: ['nissan', 'infiniti'], models: null, yearFrom: 1995, yearTo: 2026,
    thread: 'M12x1.25', hexMm: 21, seat: 'conical', type: 'nut', note: '' },

  // ── OTHER ASIAN MAKES ─────────────────────────────────────────────
  { makes: ['subaru'], models: null, yearFrom: 1995, yearTo: 2026,
    thread: 'M12x1.25', hexMm: 19, seat: 'conical', type: 'nut', note: '' },
  { makes: ['mazda'], models: null, yearFrom: 1995, yearTo: 2026,
    thread: 'M12x1.5', hexMm: 21, seat: 'conical', type: 'nut', note: '' },
  { makes: ['mitsubishi'], models: null, yearFrom: 1995, yearTo: 2026,
    thread: 'M12x1.5', hexMm: 21, seat: 'conical', type: 'nut', note: '' },
  { makes: ['hyundai', 'kia', 'genesis'], models: null, yearFrom: 1995, yearTo: 2026,
    thread: 'M12x1.5', hexMm: 21, seat: 'conical', type: 'nut', note: '' },

  // ── TESLA ─────────────────────────────────────────────────────────
  { makes: ['tesla'], models: null, yearFrom: 2012, yearTo: 2026,
    thread: 'M14x1.5', hexMm: 21, seat: 'conical', type: 'nut', note: '' },

  // ── EUROPEAN (mostly lug BOLTS - none stocked, order per job) ─────
  { makes: ['volkswagen', 'vw'], models: null, yearFrom: 1998, yearTo: 2026,
    thread: 'M14x1.5', hexMm: 17, seat: 'ball', type: 'bolt', note: 'Lug BOLTS, ball seat - conical will damage wheel' },
  { makes: ['audi'], models: null, yearFrom: 1998, yearTo: 2026,
    thread: 'M14x1.5', hexMm: 17, seat: 'ball', type: 'bolt', note: 'Lug BOLTS, ball seat - conical will damage wheel' },
  { makes: ['mercedes-benz', 'mercedes benz', 'mercedes'], models: null, yearFrom: 1995, yearTo: 2026,
    thread: 'M14x1.5', hexMm: 17, seat: 'ball', type: 'bolt', note: 'Lug BOLTS, ball seat' },
  { makes: ['porsche'], models: null, yearFrom: 1995, yearTo: 2026,
    thread: 'M14x1.5', hexMm: 19, seat: 'ball', type: 'bolt', note: 'Lug BOLTS, ball seat' },
  { makes: ['bmw'], models: null, yearFrom: 2019, yearTo: 2026,
    thread: 'M14x1.25', hexMm: 17, seat: 'conical', type: 'bolt', note: 'Lug BOLTS. Carryover models may still be M12x1.5 - verify' },
  { makes: ['bmw'], models: null, yearFrom: 1995, yearTo: 2018,
    thread: 'M12x1.5', hexMm: 17, seat: 'conical', type: 'bolt', note: 'Lug BOLTS. G-chassis (2017+) moved to M14x1.25 - verify' },
  { makes: ['mini'], models: null, yearFrom: 2014, yearTo: 2026,
    thread: 'M14x1.25', hexMm: 17, seat: 'conical', type: 'bolt', note: 'Lug BOLTS - verify, early F-series varied' },
  { makes: ['mini'], models: null, yearFrom: 2002, yearTo: 2013,
    thread: 'M12x1.5', hexMm: 17, seat: 'conical', type: 'bolt', note: 'Lug BOLTS' },
  { makes: ['volvo'], models: null, yearFrom: 2015, yearTo: 2026,
    thread: 'M14x1.5', hexMm: null, seat: 'conical', type: 'bolt', note: 'Lug BOLTS - verify socket' },
  { makes: ['volvo'], models: null, yearFrom: 1995, yearTo: 2014,
    thread: 'M12x1.75', hexMm: null, seat: 'conical', type: 'bolt', note: 'Lug BOLTS - verify socket' },
  { makes: ['land rover'], models: null, yearFrom: 2005, yearTo: 2026,
    thread: 'M14x1.5', hexMm: 22, seat: 'conical', type: 'nut', note: 'Verify seat type' },
];

function norm(s) {
  return String(s || '').toLowerCase().trim();
}

// findLug({ year, make, model })
// Returns { thread, hexMm, seat, type, note, matchTier, kit } or null.
// kit = stocked kit name if the spec is covered by shop stock, else null.
// Requires a year - no year, no guess.
export function findLug({ year, make, model }) {
  const y = Number(year) || 0;
  const mk = norm(make);
  const mo = norm(model);
  if (!y || !mk) return null;

  let makeDefault = null;
  for (const e of LUG_DB) {
    if (y < e.yearFrom || y > e.yearTo) continue;
    if (!e.makes.includes(mk)) continue;
    if (e.models) {
      if (mo && new RegExp(e.models, 'i').test(mo)) {
        return result(e, 'model');
      }
    } else if (!makeDefault) {
      makeDefault = e;
    }
  }
  return makeDefault ? result(makeDefault, 'make') : null;

  function result(e, tier) {
    const lug = {
      thread: e.thread,
      hexMm: e.hexMm,
      seat: e.seat,
      type: e.type,
      note: e.note || '',
      matchTier: tier,
    };
    lug.kit = matchStockKit(lug);
    return lug;
  }
}
