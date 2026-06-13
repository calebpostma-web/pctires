// /functions/tech-relearn-db.js
// TPMS relearn PROCEDURE steps, keyed by make (+ optional model regex + year
// range where the method changed). Rides along on the getTorque response like
// the lug DB. The AI (/tech-specs) returns only the relearn TYPE word; this DB
// adds the actual step sequence a tech follows in the bay.
//
// SAFETY/WORKFLOW NOTE: procedures researched + cross-checked against ATEQ,
// Bartec, Modern Tire Dealer (Mitchell 1), and Babcox trade press (June 2026).
// Where a make spans both indirect (no sensors) and direct (sensors) systems
// across years (VW/Audi, BMW, some Toyota/Honda), the entry says so and tells
// the tech to confirm which system the VIN has. Anything uncertain is left to
// fall through to the AI type word + a "verify on tool" note — never guessed.
//
// type:  'stationary' | 'obd' | 'auto' | 'menu'   (matches/extends AI words)
// tool:  true = a TPMS tool is required for this procedure
// seq:   sensor activation order when applicable
// steps: ordered, shop-floor instructions
// drive: drive-cycle note when relearn finishes by driving
// note:  gotchas / verify flags
// src:   short source tag

const SEQ = 'LF → RF → RR → LR';

// ── GM shared stationary "horn-honk" relearn (Buick/Chevrolet/GMC/Cadillac) ──
const GM_STATIONARY = {
  type: 'stationary',
  tool: true, // official GM procedure uses an activation tool; deflate works but is unreliable
  seq: SEQ,
  steps: [
    'Set all tires to door-placard cold pressure. Park, parking brake on.',
    'Ignition to ON / RUN, engine OFF.',
    'Enter relearn mode: hold key-fob LOCK + UNLOCK together ~5 sec, OR use DIC: INFO/MENU to "Tire Learn" then SET/RESET, OR hold the trip-odometer stem until "Tire Learning Active". Horn double-chirps = mode active.',
    'Hold the TPMS activation tool on the LF tire sidewall at the rim near the valve; press Activate. One chirp = LF learned.',
    'Repeat in order RF → RR → LR. One chirp confirms each.',
    'After LR the horn double-chirps = complete. Turn ignition OFF.',
  ],
  note: 'No-tool fallback: change pressure ~8-10 psi (or deflate ~8 sec) at each wheel until the horn chirps. Timeouts: 2 min to learn the FIRST sensor, 5 min total. A double-chirp before all 4 are done = FAILED, start over. 2020+ / 433 MHz models increasingly need OBD relearn — verify on tool. GM ran 315 MHz to ~2018, 433 MHz from 2020 (2019 mixed); sensors are not interchangeable.',
  src: 'ATEQ / Brake & Front End',
  confidence: 'high',
};

// ── Per-make table ──────────────────────────────────────────────────────────
// Each make maps to an array of entries; first match (by year + model regex) wins.
// yearFrom/yearTo inclusive; null = open. model: regex string or null (any).
const DB = {
  BUICK:      [{ from: 2007, to: null, model: null, ...GM_STATIONARY }],
  CHEVROLET:  [{ from: 2007, to: null, model: null, ...GM_STATIONARY }],
  GMC:        [{ from: 2007, to: null, model: null, ...GM_STATIONARY }],
  CADILLAC:   [{ from: 2007, to: null, model: null, ...GM_STATIONARY }],

  FORD: [
    { from: 2020, to: null, model: '(f-?150|explorer|escape|bronco)', type: 'auto', tool: false, seq: SEQ,
      steps: [
        'Set all tires to placard pressure.',
        'Drive above 20 mph (32 km/h) for ~15-20 min; the module self-assigns wheel positions.',
        'If it fails (aftermarket / wrong-frequency sensors), use the Training-Mode procedure below.',
      ],
      note: 'Auto-relearn on 2020+/2021+ Ford. Falls back to Training Mode if it will not take.',
      src: 'OBDadvisor (Master Tech reviewed)', confidence: 'medium' },
    { from: 2002, to: null, model: null, type: 'stationary', tool: false, seq: SEQ + ' (+ spare if equipped)',
      steps: [
        'Inflate all tires to placard.',
        'Ignition OFF; press and release brake.',
        'Cycle ignition OFF → RUN three times, ending in RUN.',
        'Press and release brake; ignition OFF.',
        'Cycle OFF → RUN three more times, ending in RUN. Horn chirps once + TPMS light flashes = Training Mode ("TRAIN LF TIRE").',
        'At LF: change tire pressure (deflate/inflate) or hold a trigger tool at the valve until horn chirps once.',
        'Within 2 min repeat RF → RR → LR (then spare). "Training Complete" when done.',
      ],
      note: 'Push-button-start models: enter via toggling HAZARD flashers (commonly 3x within 10 sec; some Explorers 6x) — count varies, verify per vehicle. Two chirps at any point = that wheel FAILED, restart. 2002-2005 + 2008-09 F-150 REQUIRE a trigger tool. Many 2014+ also support OBD relearn with a tool.',
      src: "Tomorrow's Technician", confidence: 'medium' },
  ],
  LINCOLN: [ // same as Ford of the matching era — reuse Ford table at lookup time
    { from: 2002, to: null, model: null, alias: 'FORD' },
  ],

  TOYOTA: [
    { from: 2006, to: null, model: null, type: 'stationary', tool: false, seq: null,
      steps: [
        'FIRST identify the system: per-wheel pressures or wheel sensors = DIRECT; only a generic light + a RESET button = INDIRECT (no sensors).',
        'Rotation / pressure re-baseline (either system): inflate to placard, ignition ON engine off, hold the TPMS RESET button until the light blinks slowly 3x, release, then drive ~20-30 min above 30 mph.',
        'NEW sensor install (direct only): this needs an OBD TPMS tool — see note.',
      ],
      note: 'The RESET button only re-baselines existing sensors; it does NOT register new sensor IDs. New direct sensors = OBD relearn with a tool, and if SET was pressed you must run the tool’s UNLOCK ECU first or it fails. Watch the Main/2nd memory switch on SUVs/vans/Lexus.',
      src: 'ATEQ / Tire Review', confidence: 'medium' },
  ],
  LEXUS: [ { from: 2006, to: null, model: null, alias: 'TOYOTA' } ],

  HONDA: [
    { from: 2013, to: null, model: '(civic|accord|cr-?v|fit|hr-?v|insight|clarity)', type: 'menu', tool: false, seq: null,
      steps: [
        'Most 2013+ Civic/Accord/CR-V are INDIRECT (no wheel sensors) — you calibrate, not relearn.',
        'Stop in P/N, all tires same size, set placard pressure, ignition ON.',
        'Touchscreen: Settings → Vehicle → TPMS Calibration → Calibrate/Initialize. OR hold the dash TPMS button until the light blinks twice.',
        'Drive ~20 min at 30-60 mph to complete calibration.',
      ],
      note: 'If there are wheel sensors (DTC 32/34/36/38, or per-wheel data) it is DIRECT = OBD relearn with a tool, then drive ≥28 mph for 1 min. Direct-Honda codes are non-volatile — a battery disconnect will NOT clear them.',
      src: "Tomorrow's Technician / Tire Review", confidence: 'high' },
    { from: 2007, to: null, model: null, type: 'obd', tool: true, seq: SEQ,
      steps: [
        'Direct system: inflate to placard.',
        'Activate each sensor with the tool (LF → RF → RR → LR) to capture IDs.',
        'Write IDs to the TPMS module through the OBDII port.',
        'Drive ≥28 mph for at least 1 min to confirm; light clears.',
      ],
      note: 'Pilot is an auto-relearn exception (drive to relearn, no tool at relearn step).',
      src: "Tomorrow's Technician", confidence: 'high' },
  ],
  ACURA: [ { from: 2007, to: null, model: null, alias: 'HONDA' } ],

  NISSAN: [
    { from: 2007, to: null, model: null, type: 'stationary', tool: true, seq: SEQ,
      steps: [
        'Set all tires to placard. Connect scan/TPMS tool to the DLC, ignition ON.',
        'On the tool: BCM → Air Pressure Monitor → Work Support → ID Regist.',
        'Hold the activation tool at the LF valve ~5 sec. Register in order LF → RF → RR → LR.',
        'Each sensor: buzzer sounds + hazards flash twice + tool light goes red → green = registered.',
        'Press END to finish.',
      ],
      note: 'Order is mandatory — wrong order breaks the self-diagnostic. New sensors ship asleep (wake shows hazards flashing 4x). To merely clear a low-pressure light after inflating, just drive >16-25 mph ~3 min. Do NOT confuse the "Easy Fill" honk (fill assist) with the relearn.',
      src: 'Modern Tire Dealer (Mitchell 1)', confidence: 'high' },
  ],
  INFINITI: [ { from: 2007, to: null, model: null, alias: 'NISSAN' } ],

  SUBARU: [
    { from: 2000, to: null, model: null, type: 'obd', tool: true, seq: SEQ,
      steps: [
        'Set all tires to placard; ignition OFF.',
        'Activate/read each sensor with the TPMS tool (within ~3 in, parallel to the valve) to capture all four IDs.',
        'Connect the tool to the OBDII port.',
        'Follow tool prompts to write the IDs into the ECU.',
        'Verify all four register and the light clears.',
      ],
      note: 'Subaru has no manual or auto-relearn mode — an OBD-capable tool is mandatory for all years.',
      src: 'Tire Review / Bartec', confidence: 'high' },
  ],

  MAZDA: [
    { from: 2016, to: null, model: null, type: 'auto', tool: false, seq: null,
      steps: [
        'Set all tires to placard (shop programs new aftermarket sensors first if fitted).',
        'Turn ignition ON then OFF.',
        'Wait ~15 minutes.',
        'Drive ≥16 mph for ≥10 min; system auto-detects and the light clears.',
      ],
      note: 'New aftermarket sensors still need a programming tool to set the ID before the drive cycle.',
      src: 'MyTPMS / Bartec', confidence: 'high' },
    { from: 2013, to: 2015, model: null, type: 'stationary', tool: false, seq: null,
      steps: [
        'Inflate all tires to placard.',
        'Ignition ON/RUN, parking brake on.',
        'Hold the TPMS SET switch (left of wheel) until the TPMS symbol flashes twice.',
        'Drive above 16 mph (25 km/h) ~10 min to complete.',
      ],
      note: '', src: 'MyTPMS', confidence: 'high' },
  ],

  RAM:      [{ from: 2008, to: null, model: null, alias: 'STELLANTIS' }],
  DODGE:    [{ from: 2008, to: null, model: null, alias: 'STELLANTIS' }],
  JEEP:     [{ from: 2008, to: null, model: null, alias: 'STELLANTIS' }],
  CHRYSLER: [{ from: 2008, to: null, model: null, alias: 'STELLANTIS' }],
  STELLANTIS: [
    { from: 2008, to: null, model: null, type: 'auto', tool: false, seq: SEQ + ' (+ spare if equipped)',
      steps: [
        'Confirm sensors installed; set all tires to placard.',
        '(If sensors were replaced) wake each with an activation tool, order LF → RF → RR → LR.',
        'Drive above 15 mph for up to 20 min, or until the TPMS light goes out.',
      ],
      note: 'All Stellantis are direct systems. Jeep JL/Gladiator/Grand Cherokee often self-learn within 1-2 miles on a simple rotation. OBD relearn (saves the road test) available on many — verify on tool. Mid-2009+ RAM mixed 315/433 MHz; check sensor frequency before replacing.',
      src: 'ATEQ / Bartec', confidence: 'high' },
  ],

  HYUNDAI: [ { from: 2008, to: null, model: null, alias: 'KOREAN' } ],
  KIA:     [ { from: 2008, to: null, model: null, alias: 'KOREAN' } ],
  GENESIS: [ { from: 2008, to: null, model: null, alias: 'KOREAN' } ],
  KOREAN: [
    { from: 2008, to: null, model: null, type: 'auto', tool: false, seq: null,
      steps: [
        'Set all tires to placard.',
        'Drive normally: older systems up to 20 min above 12 mph; newer as little as 10 min at 15 mph. Light self-corrects.',
        'Sensor or module REPLACEMENT = OBD: read each sensor ID with the tool, then write IDs into the module via OBDII.',
      ],
      note: 'CRITICAL: do NOT relearn on a lift, alignment rack, or metal floor — metal reflects the RF and causes failed learns / false codes. Do it on the ground, away from other TPMS vehicles.',
      src: "Tomorrow's Technician / Tire Review", confidence: 'high' },
  ],

  VOLKSWAGEN: [ { from: 2006, to: null, model: null, alias: 'VAG' } ],
  AUDI:       [ { from: 2006, to: null, model: null, alias: 'VAG' } ],
  VAG: [
    { from: 2006, to: null, model: null, type: 'menu', tool: false, seq: null,
      steps: [
        'IDENTIFY THE SYSTEM FIRST: dash shows per-tire pressures = DIRECT (sensors); only a generic warning + a Set/Store menu = INDIRECT (no sensors).',
        'INDIRECT: inflate to placard, ignition ON, then Infotainment → Vehicle/Setup → Tyre Pressure → Set/Store (or hold the SET button near the shifter). Current pressures become the baseline; drive to confirm.',
        'DIRECT: set placard, activate each sensor with a TPMS tool, then complete the relearn via OBDII (tool writes IDs).',
      ],
      note: 'VW flips indirect/direct mid-generation — do not assume by model name (e.g. 2024+ Atlas reportedly went back to in-wheel sensors). Verify on the tool’s VIN/MMY lookup. MMI/menu wording varies by software version.',
      src: 'ATEQ / Tomorrow’s Technician', confidence: 'medium' },
  ],

  BMW: [
    { from: 2000, to: null, model: null, type: 'menu', tool: false, seq: null,
      steps: [
        'Inflate all tires to placard; engine running, vehicle stationary.',
        'iDrive: Menu → Vehicle/Settings → Tyres (RDC) → Reset / Confirm tyre pressures. (Older: scroll the turn-signal stalk to the TPMS symbol, press and hold the stalk button ~5 sec until a check appears.)',
        'Drive above ~15 mph (25 km/h) for ~10 min to complete.',
      ],
      note: 'Direct (RDC) models show per-wheel pressures and need a tool when sensors are REPLACED. iDrive menu path varies by generation (CIC/NBT/iD7/iD8) but the Car/Tyres → Reset flow holds.',
      src: "Tomorrow's Technician / Brake & Front End", confidence: 'high' },
  ],
  MINI: [ { from: 2007, to: null, model: null, alias: 'BMW' } ],

  'MERCEDES-BENZ': [
    { from: 2000, to: null, model: null, type: 'menu', tool: false, seq: null,
      steps: [
        'Ignition ON, engine off; set all tires to placard.',
        'Steering-wheel buttons: cluster → Service / Tire Pressure menu; press OK.',
        'Scroll to "use current pressures as reference / restart"; press OK to confirm.',
        'Drive ~10-20 min above ~20 mph (32 km/h) to finish.',
      ],
      note: 'Older S/SL: toggle to trip/odometer, hold cluster RESET until "Monitor current tire pressure?" then press "+". Sensor replacement may need a scan tool — verify.',
      src: 'MBWorld / Bartec', confidence: 'medium' },
  ],
  MERCEDES: [ { from: 2000, to: null, model: null, alias: 'MERCEDES-BENZ' } ],
};

function normMake(m) {
  if (!m) return '';
  let s = String(m).trim().toUpperCase();
  if (/^MERCEDES/.test(s) || s === 'MB') return 'MERCEDES-BENZ';
  if (s === 'VW') return 'VOLKSWAGEN';
  if (s === 'CHEVY') return 'CHEVROLET';
  return s;
}

export function findRelearn({ year, make, model } = {}) {
  const mk = normMake(make);
  if (!mk || !DB[mk]) return null;
  const yr = parseInt(year, 10) || null;
  const mdl = (model || '').toString().toLowerCase();

  const pick = (key, depth) => {
    if (depth > 3 || !DB[key]) return null;
    for (const e of DB[key]) {
      const yrOk = (e.from == null || (yr && yr >= e.from)) && (e.to == null || (yr && yr <= e.to)) || !yr;
      if (!yrOk) continue;
      if (e.model && !new RegExp(e.model, 'i').test(mdl)) continue;
      if (e.alias) return pick(e.alias, depth + 1);
      const { from, to, model: _m, alias, ...rest } = e;
      return rest;
    }
    return null;
  };
  return pick(mk, 0);
}
