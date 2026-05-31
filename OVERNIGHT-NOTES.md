# Overnight build — 2026-05-31

Two PowerShell scripts are ready. Run them in order, test each in your browser, then push.

## Quick run order

```powershell
cd C:\Users\Caleb\Documents\Claude\Projects\PCtires

# 1. Font + script loading — low risk, high reward
.\fix-lcp.ps1
start .\index.html       # eyeball: text appears fast, briefly default font then swaps to Barlow
# If happy: push
.\push-pctires.ps1

# 2. Move vehicle DB out of HTML — medium risk, medium reward
.\extract-vehicle-db.ps1
start .\index.html       # eyeball: see "CRITICAL TEST" list the script prints
# If happy: push
.\push-pctires.ps1
```

Run them ONE AT A TIME. Test, push, verify on the live site, then move to the next.
If you do both and something breaks, it's harder to tell which one caused it.

---

## What each does

### fix-lcp.ps1 (4 edits, ~700 char change)

- DNS preconnect to `fonts.googleapis.com` + `fonts.gstatic.com`
- Google Fonts loads asynchronously (no longer blocks first paint)
- Stripe.js: `defer` added
- promo-codes.js: `defer` added

**Expected:** mobile LCP drops 1.5–3 seconds. FCP drops 1–2 seconds. Won't visually change
the site except for a brief flash of unstyled text (FOUT) the first time someone visits
before fonts are cached — that's expected and is the whole point.

**Risks:** Very low. Stripe and promo-codes only run on user actions (cart, checkout) — both
happen long after `defer` scripts finish loading.

### extract-vehicle-db.ps1 (extracts ~25KB out of index.html)

- Pulls `VD`, `OEM_SIZES`, `OEM_ALT_SIZES`, `OEM_BOLT_PATTERNS` out of the inline script
- Writes them to a new file: `vehicle-db.js`
- Adds `<script src="/vehicle-db.js" defer></script>` before `</head>`
- Replaces extracted blocks in `index.html` with marker comments

**Expected:** index.html drops ~25KB (~900 lines). FCP/LCP improve a further 0.5–1.5s on
mobile because the browser finishes parsing the HTML sooner.

**Risks:** Medium. The vehicle lookup feature depends on these constants being loaded
before any function references them. With `defer`, they're loaded after HTML parse but
before `DOMContentLoaded` — and every function that uses them runs on user click or after
DOMContentLoaded. So it should be safe. But it's worth testing carefully (see below).

**MANDATORY tests before pushing #2:**
1. Vehicle tab → pick Year / Make / Model / Trim → click Search → tires should load
2. Wheels tab → "Search by Vehicle" → same test
3. VIN tab → paste any 17-char VIN → click Decode → vehicle + OEM tire size appears
4. Tire Selection Guide (yellow banner) → "By My Vehicle" path → completes successfully

If any of those break, rollback (commands printed by the script).

**Push note:** `vehicle-db.js` is a NEW file. Make sure your `push-pctires.ps1`
picks it up. Most generic push scripts include `*.js` automatically; if yours filters
by an explicit list, you may need to add `vehicle-db.js`. Easy way to check: after
the push, look at the count of files pushed — should be at least 2 (index.html + vehicle-db.js).

---

## Rollback summary

Each script prints its own rollback command at the end. In short:

```powershell
# LCP rollback
Copy-Item -Force .\index.html.bak-lcp-<timestamp> .\index.html

# Vehicle DB rollback (BOTH files)
Copy-Item -Force .\index.html.bak-vehicledb-<timestamp> .\index.html
Remove-Item .\vehicle-db.js
```

If everything goes wrong, nuke local + pull GitHub:
```powershell
git checkout origin/main -- index.html
Remove-Item .\vehicle-db.js -ErrorAction SilentlyContinue
```

---

## After both are deployed

Re-run PageSpeed Insights for pctires.ca on mobile. Expected scores:

| | Before | After Task 2 only | After all 3 |
|--|---|---|---|
| Performance | 94 | 94 | 96+ |
| SEO | 62 | 92+ | 92+ |
| LCP | 7.3s | 7.3s | 3–4s |
| FCP | 4.8s | 4.8s | 2–3s |

Performance score doesn't move dramatically because mobile already scores 94 — the bigger
deal is the actual Core Web Vitals (LCP, FCP) coming down into "good" range, which is
what Google actually uses for mobile ranking signals.

Drop those Instagram/TikTok URLs whenever your wife has the accounts live and I'll wire them up.

— Claude
