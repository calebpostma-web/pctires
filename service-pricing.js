// ─────────────────────────────────────────────────────────────
//  PC TIRES — SERVICE PRICING
//  Edit the numbers below, then run:  .\push-pctires.ps1
//
//  price      = dollars per unit (no $ sign, just the number).
//               For rim-laddered services this is the 16"-and-under price.
//  unit       = 'per tire' | 'per stem' | 'flat'
//  ladder     = optional. Per-tire price by rim diameter, for sizes between
//               the base price and largeFrom. e.g. { 17:29, 18:33, 19:36 }
//  priceLarge = optional. Price per tire for largeFrom (20") and larger rims.
//  largeFrom  = rim size at/above which priceLarge kicks in. Defaults to 20.
//  free: true = shows "Free" instead of a price.
//
//  RULE: customer-supplied tires ("bring your own") are $5 more per tire at
//  every rung than tires bought from us. If you change one ladder, change both.
//
//  The cart charges install automatically off the actual tire size the customer
//  bought — that ladder lives in index.html as TDG.INSTALL_LADDER. Keep the
//  'mountnew' numbers here matching it, or the booking page and the cart will
//  quote two different prices for the same job.
//
//  That's it. Change a number, push, done. Nothing else to touch.
// ─────────────────────────────────────────────────────────────

const SERVICE_PRICING = {
  rotation:  { price: 60, unit: 'flat' },                                  // Tire Rotation & TPMS Relearn
  swap:      { price: 15, unit: 'per tire' },                              // Seasonal Swap (pre-mounted set)
  tpms:      { price: 30, unit: 'flat' },                                  // TPMS Relearn

  // Tires bought from PC Tires — must match TDG.INSTALL_LADDER in index.html
  mountnew:  { price: 25, unit: 'per tire', ladder: { 17: 29, 18: 33, 19: 36 }, priceLarge: 40, largeFrom: 20 },

  // Customer-supplied tires — same ladder, +$5 per tire at every rung
  mountown:  { price: 30, unit: 'per tire', ladder: { 17: 34, 18: 38, 19: 41 }, priceLarge: 45, largeFrom: 20 },

  patch:     { price: 45, unit: 'flat' },                                  // Flat Repair — Proper Patch
  bead:      { price: 55, unit: 'flat' },                                  // Bead Leak Repair
  valve:     { price: 25, unit: 'per stem' },                              // Valve Stem Replacement (rubber)
  tpmsvalve: { price: 40, unit: 'flat' },                                  // TPMS Valve Service Kit
  torque:    { price: 0,  unit: '', free: true },                          // Wheel Torque Re-check (Free)
};
