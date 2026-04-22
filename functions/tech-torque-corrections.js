// tech-torque-corrections.js
// HALDERMAN CORRECTIONS — fixes for known platform-swap errors in the
// 1995-2021 Halderman chart. Halderman groups vehicles by make-then-"car" vs
// "truck/SUV/van", but the Halderman matcher has no way to know whether any
// given model is a car or a truck — so truck-platform SUVs lumped into a
// Cadillac-branded make fall to the "car" catchall (100 ft-lb) instead of
// the correct truck catchall (140 ft-lb).
//
// This file explicitly lists the known problem vehicles so they hit before
// the catchall. Sources cited per entry.
//
// Priority in tech-sync.js:
//   1. KV verified (shop-confirmed)
//   2. 2022-2026 Overlay (current-year manufacturer data)
//   3. THIS FILE — corrections for older platforms
//   4. Halderman 1995-2021 base DB
//   5. Null → AI fallback

// Row format: [make, model, yearFrom, yearTo, ftlb, note, sourceTag]

export const CORRECTIONS = [
  // ─── GM TRUCK-PLATFORM SUVs (GMT800/900/K2XX) ───────────────────
  // These ride on full-size truck chassis with M14x1.5 studs.
  // Halderman puts them under "All Other Car Models" at 100 ft-lb, which is WRONG.
  // Source: GM Techlink Wheel Nut Torque Bulletin, April 2010 (cited on acadiaforum.net)
  // Corroborated by owner's manuals and multiple dealer service writers.

  ["Cadillac", "Escalade", 1999, 2021, 140, "M14x1.5, GM truck platform", "GM Service Bulletin 2010"],
  ["Cadillac", "Escalade ESV", 2003, 2021, 140, "M14x1.5", "GM Service Bulletin 2010"],
  ["Cadillac", "Escalade EXT", 2002, 2013, 140, "M14x1.5, pickup variant", "GM Service Bulletin 2010"],
  ["Cadillac", "DTS", 2006, 2011, 100, "Car, smaller studs", "GM Service Bulletin 2010"],
  ["Cadillac", "STS", 2005, 2011, 100, "Car", "GM Service Bulletin 2010"],
  ["Cadillac", "SRX", 2004, 2009, 100, "Car", "GM Service Bulletin 2010"],
  ["Cadillac", "SRX", 2010, 2016, 110, "Car, larger studs", "GM Service Bulletin 2010"],
  ["Cadillac", "XT5", 2017, 2021, 110, "Crossover", "GM Owner Manual"],
  ["Cadillac", "XT6", 2020, 2021, 140, "M14x1.5", "GM Owner Manual"],
  ["Cadillac", "XT4", 2019, 2021, 110, "Crossover", "GM Owner Manual"],

  // GM SUVs across all badges — same platform family
  ["Buick", "Enclave", 2008, 2021, 140, "M14x1.5 truck platform", "GM Service Bulletin 2010"],
  ["Buick", "Rendezvous", 2002, 2007, 100, "Car-platform SUV", "GM Service Manual"],
  ["Buick", "Rainier", 2004, 2007, 100, "GMT360 platform", "GM Service Manual"],

  ["GMC", "Acadia", 2007, 2021, 140, "M14x1.5", "GM Service Bulletin 2010"],
  ["GMC", "Envoy", 2002, 2009, 100, "GMT360 platform, M12", "GM Service Manual"],
  ["GMC", "Yukon", 1995, 2021, 140, "M14x1.5 truck platform", "GM Service Bulletin 2010"],
  ["GMC", "Yukon XL", 2000, 2021, 140, "M14x1.5", "GM Service Bulletin 2010"],
  ["GMC", "Yukon Denali", 1999, 2021, 140, "M14x1.5", "GM Service Bulletin 2010"],
  ["GMC", "Terrain", 2010, 2021, 140, "", "GM Owner Manual"],
  ["GMC", "Savana", 1996, 2021, 140, "Full-size van", "GM Service Bulletin 2010"],

  ["Chevrolet", "Tahoe", 1995, 2021, 140, "M14x1.5 truck platform", "GM Service Bulletin 2010"],
  ["Chevrolet", "Suburban", 1995, 2021, 140, "M14x1.5", "GM Service Bulletin 2010"],
  ["Chevrolet", "Avalanche", 2002, 2013, 140, "M14x1.5", "GM Service Bulletin 2010"],
  ["Chevrolet", "Traverse", 2009, 2021, 140, "", "GM Service Bulletin 2010"],
  ["Chevrolet", "Equinox", 2010, 2021, 140, "Later gens with M14 studs; early gens 100", "GM Owner Manual"],
  ["Chevrolet", "Trailblazer", 2002, 2009, 100, "GMT360 platform, M12", "GM Service Manual"],
  ["Chevrolet", "Express", 1996, 2021, 140, "Full-size van", "GM Service Bulletin 2010"],

  // ─── FORD TRUCK-PLATFORM SUVs ───────────────────────────────────
  // Halderman has Lincoln "All Other Car Models" at 95 — wrong for Navigator.
  // Halderman does have specific Navigator entries, but let's be explicit to
  // cover search variations.
  ["Lincoln", "Navigator", 2000, 2021, 150, "M14x1.5 (21mm hex), Expedition platform", "Ford Owner Manual"],
  ["Lincoln", "Mark LT", 2006, 2008, 150, "F-150 platform pickup", "Ford Owner Manual"],
  ["Lincoln", "Aviator", 2020, 2021, 150, "Explorer platform", "Ford Owner Manual"],
  ["Ford", "Excursion", 2000, 2005, 165, "Super Duty platform", "Ford Owner Manual"],
  ["Ford", "Expedition", 2003, 2021, 150, "M14x1.5", "Ford Owner Manual"],
  ["Ford", "Flex", 2009, 2019, 100, "", "Ford Owner Manual"],

  // ─── MOPAR TRUCK-PLATFORM SUVs ─────────────────────────────────
  ["Dodge", "Durango", 2004, 2009, 110, "Dakota-based", "Dodge Owner Manual"],
  ["Dodge", "Durango", 2011, 2021, 130, "WK2 platform, shared with Grand Cherokee", "Dodge Owner Manual"],
  ["Dodge", "Ram 1500", 2011, 2018, 130, "Rebranded to Ram after 2011; shop may search Dodge", "Ram Owner Manual"],
  ["Dodge", "Ram 2500", 2011, 2018, 145, "Rebranded to Ram after 2011", "Ram Owner Manual"],

  // ─── TOYOTA LARGER SUVs & TRUCKS ───────────────────────────────
  // Halderman has Toyota "All Other Light Truck/SUV" at 76 — correct for
  // small SUVs, but WRONG for Tundra/Sequoia/Land Cruiser (97) and the
  // body-on-frame 4Runner/FJ (83).
  ["Toyota", "Tundra", 2007, 2021, 97, "Alloy wheels; steel 154", "Toyota Owner Manual"],
  ["Toyota", "Sequoia", 2008, 2021, 97, "Alloy; steel 154", "Toyota Owner Manual"],
  ["Toyota", "Land Cruiser", 2008, 2021, 97, "Body-on-frame", "Toyota Owner Manual"],
  ["Toyota", "4Runner", 2010, 2021, 83, "5th gen body-on-frame", "Toyota Owner Manual"],
  ["Toyota", "FJ Cruiser", 2007, 2014, 83, "Body-on-frame", "Toyota Owner Manual"],
  ["Toyota", "Tacoma", 2005, 2015, 83, "2nd gen", "Toyota Owner Manual"],
  ["Toyota", "Tacoma", 2016, 2023, 83, "3rd gen", "Toyota Owner Manual"],

  // ─── LEXUS LARGER SUVs ─────────────────────────────────────────
  ["Lexus", "LX470", 1998, 2007, 97, "Land Cruiser platform", "Lexus Owner Manual"],
  ["Lexus", "LX570", 2008, 2021, 97, "Land Cruiser platform", "Lexus Owner Manual"],
  ["Lexus", "GX460", 2010, 2021, 83, "Body-on-frame, 4Runner platform", "Lexus Owner Manual"],
  ["Lexus", "GX470", 2003, 2009, 83, "Body-on-frame", "Lexus Owner Manual"],

  // ─── NISSAN TRUCKS / BIG SUVs ───────────────────────────────────
  // Halderman has Nissan "All Other SUV's & Vans" at 80 — correct for Rogue,
  // Murano, etc. But Pathfinder body-on-frame, Armada, and Titan need higher.
  ["Nissan", "Pathfinder", 2005, 2012, 98, "R51 body-on-frame; R52 2013+ unibody is 83", "Nissan Owner Manual"],
  ["Nissan", "Armada", 2004, 2021, 98, "Patrol-based body-on-frame", "Nissan Owner Manual"],
  ["Nissan", "Titan", 2004, 2021, 98, "Full-size truck", "Nissan Owner Manual"],
  ["Nissan", "Titan XD", 2016, 2021, 131, "HD variant", "Nissan Owner Manual"],
  ["Nissan", "Frontier", 2005, 2021, 98, "Body-on-frame mid-size truck", "Nissan Owner Manual"],
  ["Nissan", "Xterra", 2005, 2015, 98, "Body-on-frame", "Nissan Owner Manual"],
  ["Nissan", "NV1500", 2012, 2021, 138, "Full-size cargo van", "Nissan Owner Manual"],
  ["Nissan", "NV2500", 2012, 2021, 138, "Full-size cargo van", "Nissan Owner Manual"],
  ["Nissan", "NV3500", 2012, 2021, 138, "Full-size cargo van", "Nissan Owner Manual"],
  ["Infiniti", "QX56", 2004, 2013, 98, "Armada platform", "Infiniti Owner Manual"],
  ["Infiniti", "QX80", 2014, 2021, 98, "Armada platform", "Infiniti Owner Manual"],

  // ─── HONDA / ACURA FLAGSHIP SUVs ────────────────────────────────
  // Halderman has Honda at 80 across the board — correct, but Pilot/Odyssey/
  // Ridgeline actually call for 94 in recent owner's manuals.
  ["Honda", "Pilot", 2003, 2021, 94, "", "Honda Owner Manual"],
  ["Honda", "Odyssey", 2005, 2021, 94, "", "Honda Owner Manual"],
  ["Honda", "Ridgeline", 2006, 2021, 94, "", "Honda Owner Manual"],
  ["Honda", "Passport", 2019, 2021, 94, "Pilot platform", "Honda Owner Manual"],
  ["Acura", "MDX", 2001, 2021, 94, "Pilot platform", "Acura Owner Manual"],

  // ─── KOREAN FLAGSHIP SUVs ──────────────────────────────────────
  ["Hyundai", "Palisade", 2020, 2021, 110, "Larger studs than Santa Fe", "Hyundai Owner Manual"],
  ["Kia", "Telluride", 2020, 2021, 110, "Larger studs than Sorento", "Kia Owner Manual"],

  // ─── FORD F-SERIES PRECISION (Halderman has gaps) ──────────────
  ["Ford", "F-250 Super Duty", 2005, 2010, 150, "M14x1.5", "Ford Owner Manual"],
  ["Ford", "F-250 Super Duty", 2011, 2021, 165, "M14x1.5, bumped up", "Ford Owner Manual"],
  ["Ford", "F-350 Super Duty", 2005, 2010, 150, "M14x1.5", "Ford Owner Manual"],
  ["Ford", "F-350 Super Duty", 2011, 2021, 165, "M14x1.5, bumped up", "Ford Owner Manual"],
  ["Ford", "F-450 Super Duty", 2008, 2021, 165, "DRW", "Ford Owner Manual"],
  ["Ford", "F-550 Super Duty", 2008, 2021, 165, "DRW", "Ford Owner Manual"],
];

// ─── Matching logic (mirrors overlay and Halderman) ────────────

function normalize(s) {
  if (s == null) return '';
  return String(s).toLowerCase()
    .replace(/[^a-z0-9/\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandAlternatives(model) {
  const n = normalize(model);
  if (n.includes('/')) {
    return n.split('/').map(s => s.trim()).filter(Boolean);
  }
  return [n];
}

/**
 * Find a corrections entry for {year, make, model}.
 * Returns null if no match, otherwise { ftlb, note, sourceTag, matchTier, entry }.
 */
export function findCorrection({ year, make, model }) {
  if (!year || !make || !model) return null;
  const y = Number(year);

  const normMake = normalize(make);
  const q = normalize(model);

  const candidates = CORRECTIONS.filter(row => {
    return normalize(row[0]) === normMake && y >= row[2] && y <= row[3];
  });
  if (!candidates.length) return null;

  const toResult = (row, tier) => ({
    ftlb: row[4],
    note: row[5] || null,
    sourceTag: row[6] || 'Owner Manual',
    matchTier: tier,
    entry: {
      make: row[0], model: row[1],
      yearFrom: row[2], yearTo: row[3],
    },
  });

  // Tier 1: exact match
  for (const row of candidates) {
    const alts = expandAlternatives(row[1]);
    if (alts.includes(q)) return toResult(row, 'exact');
  }

  // Tier 2: query starts with entry + ' '
  for (const row of candidates) {
    const alts = expandAlternatives(row[1]);
    if (alts.some(em => em && q.startsWith(em + ' '))) return toResult(row, 'base');
  }

  // Tier 3: entry starts with query + ' ' (query more generic — e.g. "Escalade"
  // matches "Escalade ESV"). Only apply if the entry has additional words.
  for (const row of candidates) {
    const alts = expandAlternatives(row[1]);
    if (alts.some(em => em && em.startsWith(q + ' '))) return toResult(row, 'partial');
  }

  return null;
}
