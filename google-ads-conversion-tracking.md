# Google Ads — Conversion Tracking (PC Tires)

Captured from the campaign construction "Set up with a Google Tag" screen
(campaign: "PC Tires — Search (Local)", campaignId 24029075651), July 13, 2026.

## Purchase conversion
- **send_to**: `AW-18156336783/OxLRCI7XpKscEI_tztFD`
  - Conversion ID: `AW-18156336783`
  - Conversion label: `OxLRCI7XpKscEI_tztFD`
- Measurement: Page load (fires on the confirmation/thank-you page)
- Base Google tag: reported already installed on pctires.ca

## Generic snippet Google showed (do NOT use as-is — no value)
```html
<!-- Event snippet for Purchase conversion page -->
<script>
  gtag('event', 'conversion', {
      'send_to': 'AW-18156336783/OxLRCI7XpKscEI_tztFD',
      'transaction_id': ''
  });
</script>
```

## Proper implementation — DONE (live in thank-you.html)
Purchase conversion already fires on thank-you.html with real values:
```html
<script>
  if (typeof gtag === 'function' && order && total > 0) {
    if (email) { gtag('set', 'user_data', { 'email': email }); }
    gtag('event', 'conversion', {
        'send_to': 'AW-18156336783/OxLRCI7XpKscEI_tztFD',
        'value': total,        // real order total (CAD)
        'currency': 'CAD',
        'transaction_id': order // dedupe key
    });
  }
</script>
```
- `total` + `order` come from thank-you.html URL params, which index.html's checkout sets on
  redirect: `/thank-you?order=<orderId>&total=<grandTotal.toFixed(2)>&...` (index.html ~line 5388–5403).
- `grandTotal` is the full order total. Fires for card + Affirm orders that land back on thank-you.html.

## The two conversions — DO NOT confuse them
- **Purchase** = `AW-18156336783/OxLRCI7XpKscEI_tztFD` — fires on **thank-you.html**, carries value/currency/transaction_id. This is the sales conversion.
- **Click-to-call** = `AW-18156336783/SbSRCNu5nbEcEI_tztFD` — fires on **ANY `tel:` link click** site-wide (delegated listener in <head> of index.html + every page). NO value. Never attach order value to this one.

## ⚠️ GOTCHA — the Ads "same value" setting silently overrides the tag (fixed Jul 15 2026)
**Symptom:** Purchase conversions logged ~$1 each (8 sales showed $11 total) even though thank-you.html was correctly sending `value: total`.
**Root cause:** NOT the site code. The Google Ads **conversion action Value setting** was "Use the same value for each conversion: $1 (USD)". That setting **overrides whatever value the tag sends** — Google ignored the real order total and stamped $1 on every sale.
**Fix (Ads UI only, no code change):** Google Ads → Goals → Conversions → **Purchase** → Settings → **Value** → "Use different values for each conversion" → source **Event snippet**. Now it honours the tag's value. (Currency default was also wrongly USD; the tag sends CAD explicitly, so that's fine once "different values" is on.)
**LESSON for future sessions:** if a conversion logs flat / tiny / wrong values, check the **Ads conversion action's Value setting FIRST** — a static "same value" silently overrides the tag — before assuming the site code is broken. Here the site was correct all along.

## Account structure notes (Jul 15 2026)
- **Account-default goals** (what campaigns optimize toward, and the "Conversions" column count) = **Purchases + Phone call leads** only. On "PC Tires — Search (Local)" that's ~52 = 8 Purchases + 16 Click-to-call + 28 Calls-from-ads.
- Auto-imported Google Business Profile actions — **Local actions: Directions / Website visits / Other engagements** — show as Primary but are marked "No" for account-level goals, so they do **NOT** drive bidding. Their Primary/Secondary optimization is **not editable** individually (Google locks it). Don't waste time trying to demote them — already excluded from bidding.
- **Next step** once real purchase values have flowed ~1–2 weeks: switch "PC Tires — Search (Local)" bidding from Maximize Conversions → **Maximize Conversion Value**, so it optimizes for revenue (big tire sales) over cheap phone calls. This was Caleb's core concern: a $25 cost is fine for a set-of-4 sale, bad for a phone call/repair — value-based bidding is the fix, and it only works once real $ values are flowing (which they now are).
