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
//  ⚠ CODES DO NOT RESPECT THE MARGIN FLOOR (as of Aug 14 2026).
//  calculatePromoDiscount() in index.html recomputes 'markup' and 'net_target'
//  straight off TDG cost with nothing stopping it going under MIN_MARGIN. The
//  member 10% has this guard (discountEligible); promo codes don't.
//  On a $49.50-cost Antares: MULTI2026 nets $4.35/tire and POSTMAH&C nets
//  MINUS $2.83 — you pay for the privilege. Fine on premium tires, bad on budget.
//  Check the numbers before adding a 'markup' code below 1.25.
//
//  CODES ARE CASE-INSENSITIVE — customer can type 'multi2026' or 'MULTI2026'
// ─────────────────────────────────────────────────

const PROMO_CODES = {

  // Removed Aug 14 2026 — ALSLAWNCARE (net_target 10). A $10/tire net is under
  // the $25 MIN_MARGIN floor at every cost, so it was the deepest discount on the
  // site. Caleb's call: not selling to Al's. The 'net_target' type still works if
  // a partner code ever needs it again.

  // ── Partner codes (25% markup from cost instead of 35%) ──
  'MULTI2026':    { type: 'markup', value: 1.25, label: 'Multi Construction — Partner Pricing' },
  'WINDMILL2026': { type: 'markup', value: 1.25, label: 'Windmill Cabinets — Partner Pricing' },

  // ── Member / friends & family ──
  // Postma H&C stays at 1.1 by Caleb's call — they know it's a good deal and it
  // has moved them up into better tires. It nets slightly negative on 53 Antares
  // SKUs (cost under \$94); accepted, since they don't buy budget.
  'POSTMAH&C':   { type: 'markup', value: 1.1, label: 'Postma H&C' },
  // EZRA2026 removed Aug 14 2026 — no longer needed.

  // ── Promo / marketing codes ──

  // ── Examples (uncomment or copy to add more) ──
  // 'SUMMER15':     { type: 'percent',      value: 15, label: '15% Off Summer Sale',  expires: '2026-09-01' },
  // 'SAVE50':       { type: 'flat',         value: 50, label: '$50 Off Your Order',   minCart: 400 },
  // 'TIRE10':       { type: 'per_tire',     value: 10, label: '$10 Off Per Tire' },
  // 'FREEINSTALL':  { type: 'free_install', value: 0,  label: 'Free Installation' },
  // 'AUNTJUNE':     { type: 'per_tire',     value: 30, label: '$30 Off Per Tire — Family' },

};
