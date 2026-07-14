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

## Proper implementation (TODO — build into thank-you.html)
Fire on order confirmation with real values so we get revenue/ROAS + dedupe:
```html
<script>
  gtag('event', 'conversion', {
      'send_to': 'AW-18156336783/OxLRCI7XpKscEI_tztFD',
      'value': ORDER_TOTAL,        // grand total in CAD
      'currency': 'CAD',
      'transaction_id': ORDER_NUMBER  // dedupe key
  });
</script>
```
Notes:
- Confirm base gtag `AW-18156336783` config is present in <head> before the event fires.
- Pull ORDER_TOTAL and ORDER_NUMBER from the thank-you page's existing order data / URL params.
- Affirm redirect returns to thank-you.html too, so this fires for both card and Affirm orders that land back on the page.
