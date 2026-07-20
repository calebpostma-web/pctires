// ─────────────────────────────────────────────────────────────
//  PC TIRES — SERVICE PRICING
//  Edit the numbers below, then run:  .\push-pctires.ps1
//
//  price      = dollars per unit (no $ sign, just the number)
//  unit       = 'per tire' | 'per stem' | 'flat'
//  priceLarge = optional. Price per tire for 20" and larger rims.
//               Only set this on services that cost more on big rims.
//  free: true = shows "Free" instead of a price.
//
//  That's it. Change a number, push, done. Nothing else to touch.
// ─────────────────────────────────────────────────────────────

const SERVICE_PRICING = {
  rotation:  { price: 60, unit: 'flat' },                                  // Tire Rotation & TPMS Relearn
  swap:      { price: 15, unit: 'per tire' },                              // Seasonal Swap (pre-mounted set)
  tpms:      { price: 30, unit: 'flat' },                                  // TPMS Relearn
  mountnew:  { price: 25, unit: 'per tire' },                              // Install Tires Purchased Here
  mountown:  { price: 30, unit: 'per tire', priceLarge: 35, largeFrom: 20 }, // Customer-Supplied Install — $30 under 20", $35 for 20"+
  patch:     { price: 45, unit: 'flat' },                                  // Flat Repair — Proper Patch
  bead:      { price: 55, unit: 'flat' },                                  // Bead Leak Repair
  valve:     { price: 25, unit: 'per stem' },                              // Valve Stem Replacement (rubber)
  tpmsvalve: { price: 40, unit: 'flat' },                                  // TPMS Valve Service Kit
  torque:    { price: 0,  unit: '', free: true },                          // Wheel Torque Re-check (Free)
};
