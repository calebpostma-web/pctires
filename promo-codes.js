// ─────────────────────────────────────────────────
//  PC TIRES — PROMO / DISCOUNT CODES
//
//  Edit this file to add, change, or remove codes.
//  Push to GitHub and they're live. No need to touch index.html.
//
//  TYPES:
//    'percent'      → % off the subtotal        (value: 15 = 15% off)
//    'flat'         → fixed $ off               (value: 50 = $50 off)
//    'per_tire'     → $ off per tire in cart     (value: 10 = $10/tire off)
//    'free_install' → waives all install fees    (value: 0)
//    'markup'       → partner pricing at a       (value: 1.25 = 25% markup from cost
//                     custom markup from cost         instead of the normal 35%)
//
//  OPTIONS:
//    label    → what the customer sees (e.g. "15% Off Summer Sale")
//    expires  → 'YYYY-MM-DD' — code stops working after this date
//    minCart  → minimum subtotal in $ to qualify (e.g. 400)
//
//  CODES ARE CASE-INSENSITIVE — customer can type 'multi2026' or 'MULTI2026'
// ─────────────────────────────────────────────────

const PROMO_CODES = {

  // ── Partner codes (25% markup from cost instead of 35%) ──
  'MULTI2026':    { type: 'markup', value: 1.15, label: 'Multi Construction — Partner Pricing' },
  'WINDMILL2026': { type: 'markup', value: 1.15, label: 'Windmill Cabinets — Partner Pricing' },

  // ── Member / friends & family ──
  'POSTMAH&C':   { type: 'markup', value: 1.1, label: 'Postma H&C' },
  'EZRA2026':    { type: 'percent', value: 10, label: '10% Off — Ezra' },

  // ── Promo / marketing codes ──
  'WELCOME10':    { type: 'percent', value: 10, label: '10% Off — Welcome Offer', expires: '2026-12-31' },

  // ── Examples (uncomment or copy to add more) ──
  // 'SUMMER15':     { type: 'percent',      value: 15, label: '15% Off Summer Sale',  expires: '2026-09-01' },
  // 'SAVE50':       { type: 'flat',         value: 50, label: '$50 Off Your Order',   minCart: 400 },
  // 'TIRE10':       { type: 'per_tire',     value: 10, label: '$10 Off Per Tire' },
  // 'FREEINSTALL':  { type: 'free_install', value: 0,  label: 'Free Installation' },
  // 'AUNTJUNE':     { type: 'per_tire',     value: 30, label: '$30 Off Per Tire — Family' },

};
