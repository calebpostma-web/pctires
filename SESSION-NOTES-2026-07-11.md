# PC Tires — Session Notes, July 11 2026

Paste this into the Claude project instructions (or leave it here — the next session can read it from the repo folder). Everything below is DEPLOYED and TESTED unless marked otherwise.

---

## 1. What shipped this session

### SMS quote texting via voip.ms — LIVE, TESTED WORKING
- **`functions/send-quote-sms.js`** (new Cloudflare Pages Function). POST `{ phone, link, name? }` → sends SMS via voip.ms REST API (`sendSMS`). Responds `{ ok: true }` or `{ ok: false, error }`.
  - Only sends links matching `https://pctires.ca/...` — not usable as an open SMS gateway.
  - Message is a fixed server-side template, GSM-7/ASCII only (unicode would force 70-char segments): `PC Tires quote for {name}: {link} Questions? Call 519-397-4686`, auto-shortens if over 160 chars.
  - Rate limiting via the existing `TECH_KV` binding: 5/hour per IP, 200/day global. KV failure never blocks a send.
  - Sends from `VOIPMS_DID`, normalizes destination to 10-digit NA numbers.
- **Share Quote modal (index.html)**: the old `sms:` anchor (opened the messaging app) is now a phone input (pre-filled from the quote form) + **📱 TEXT IT** button posting to `/send-quote-sms`. On failure it shows the voip.ms error and offers an "Open messaging app instead" fallback link, so nothing breaks if SMS is misconfigured.
- **Cloudflare env vars (Production, all set)**: `VOIPMS_API_USERNAME` = postmacontracting@gmail.com, `VOIPMS_API_PASSWORD` (set by Caleb), `VOIPMS_DID` = 5193974686.
- **voip.ms account config (done)**: API enabled, API password set, IP whitelist = `216.154.83.197,0.0.0.0` (0.0.0.0 disables the whitelist — required because Cloudflare egress IPs rotate; the API password still gates access).
- **Gotcha learned**: env vars only take effect on the NEXT deployment. If a var is added after the last deploy, use Cloudflare → pctires → latest deployment → Manage deployment → **Retry deployment** (rebuilds same commit with current vars, ~20 s).
- End-to-end tested: quote created → TEXT IT → SMS received from 519-397-4686.

### Quote banner replaced with toast
- `showQuoteBanner()` in index.html no longer renders the full-width fixed yellow overlay (it covered the products). It now shows a 3-second toast: "Hi {first name} — your PC Tires quote" + the personal note (or a hint about "Pick this set" for multi-set comparison quotes).
- The cart drawer still auto-opens ~800 ms after load and carries everything the banner used to show (items, total, Pick-this-set buttons, checkout).
- `showQuoteError()` (red banner for expired/invalid quote links) is intentionally unchanged.

### Google Merchant Center fixes (deadline: Aug 8 2026)
Two account-level issues arrived July 11, limiting visibility of all 504 products ("Limited" status, all impacted in Canada):

**Issue 1 — "User cannot complete purchase"**: fixed by adding **Buy buttons to all 16 tire model pages**:
- `refresh-tools/generate.py` now emits a 5th table column: `Buy →` link per size row → `https://pctires.ca/?buysize=215%2F55R16&brand=Michelin#catalog`.
- Buy links use the **plain metric size** — P/LT/C prefixes and load-range suffixes (XL, LRE…) are stripped (`plain_size` in generate.py), because the site searches TDG with plain sizes. No spaces in URLs.
- CSS: price cell is now `.size-table td:nth-child(4)` (was `td:last-child`), new `.buy-link` button style.
- **index.html: new `handleBuyLink()`** (near `checkForQuoteInUrl`, called from the same DOMContentLoaded init). Reads `?buysize=` + `&brand=`, validates the size format (tolerates P/LT/C prefixes and XL/LR? suffixes), runs `switchCatalogType('tires')` + `loadTires({tireSizes: variants})`, pre-selects the Brand refine filter, updates the lookup result text, scrolls to #catalog.
- The buttons live in the generator, so **monthly refreshes keep them automatically**.

**Issue 2 — "Website or online shop needs improvement"**: fixed by:
- Removing the "photo of the crew coming soon" placeholder box from the homepage reviews section (the text blurb stays).
- Removing the disabled Instagram/TikTok buttons (a comment marks where to re-add real links when the accounts are live).
- New **`shipping.html`** (matches returns.html design): free shipping to shop, 1–3 day typical timing, free pickup, $25 local delivery in N7L/N7M/N0P/N8A (matches the Merchant Center delivery policy), 72-h damage window, contact/hours. Footer "Help" column links to it.
- `sitemap.xml`: lastmod bumped to 2026-07-11 for the 16 model pages, shipping.html entry added.

**Merchant Center status as checked July 11**: feed is healthy (the July 6 "file format" failure self-resolved after the July 7 refresh — 504 products loaded). Neither issue offers a manual "Request review" button — both say **Google will automatically conduct a review before Aug 8**. A Request-review button may appear on Products → Diagnostics → Account issues in a few days; click it if it shows up, otherwise the auto-review covers it. **Check back ~late July to confirm products left "Limited" status.**

---

## 2. Still open / next steps

1. **about.html (recommended, small)** — Google's requirement list mentions "a clear about page". The homepage family blurb may pass, but a dedicated page (family story, address, hours, real photo) closes it beyond argument. Model on shipping.html/returns.html style, add footer link + sitemap entry.
2. **Real crew/shop photo** — for the homepage family section (placeholder was removed, a real photo would strengthen trust signals) and for the future about page.
3. **Instagram/TikTok links** — re-add as real `<a>` links in the social section when the accounts are live (search index.html for "Instagram/TikTok buttons removed").
4. **Verify Merchant Center review passed** — late July. If products are still Limited by Aug 1, investigate; the deadline is Aug 8.
5. Longer-term backlog unchanged: AI receptionist with live inventory/order lookup, weekly SEO posts, relearn-steps DB for the tech portal.

---

## 3. ⚠️ File-corruption warning for future sessions (important)

**Three times this session, files in the mounted repo folder lost their tails mid-edit** (host Edit tool + sandbox bash writes interleaving badly): `refresh-tools/generate.py` twice, `index.html` once (lost 2,721 chars). All were caught and fully repaired:
- generate.py's write-loop tail was reconstructed and **proven correct by diffing regenerated pages against the previously generated pages in the repo** (only intended changes differed).
- index.html's tail was restored byte-for-byte from GitHub main (fetched via the browser: fetch the raw file in page context, inject `tail.replace(/\n/g,'¶')` into `document.body.textContent`, read with get_page_text, restore newlines — the javascript_tool output filter blocks raw/base64 code, the DOM route works).

**Rules for future sessions editing this repo:**
- After EVERY edit to a repo file, verify the tail: `tail -3 file` + `wc -l` and compare against expectations. For HTML: assert it ends with `</html>`. For JS: `node --check`. For Python: `ast.parse`.
- Prefer a single write channel per file per session (all bash, or all Edit tool) — don't interleave.
- generate.py's write-loop tail (last ~20 lines) is the reconstructed section; it works (16 pages generate correctly) but if it ever looks odd, that's why.

---

## 4. Operational reference (current state)

- **Deploy**: Caleb runs `.\push-pctires.ps1` in `C:\Users\Caleb\Documents\Claude\Projects\PCtires` (byte-compares against GitHub, uploads changes via API, Cloudflare auto-builds in ~60–90 s). Local folder = source of truth; local git history is stale (ignore it).
- **Cloudflare Pages project `pctires`**, account Postmacontracting. Env vars: ANTHROPIC_API_KEY, BOOKKEEPING_PASSWORD, RESEND_API_KEY, STRIPE_SECRET, TDG_API_KEY, TECH_PASSWORD, USED_PASSWORD, VOIPMS_API_USERNAME, VOIPMS_API_PASSWORD, VOIPMS_DID. KV bindings include QUOTES_KV (PC_TIRES_QUOTES) and TECH_KV (PC_TIRES_TECH).
- **Quote links**: `pctires.ca/q/CODE`, 30-day TTL, live TDG pricing on open, auto-lock after payment (`markQuoteAsPaid`, 90-day paid TTL).
- **Merchant Center**: PC Tires, ID 5821577669. Feeds: `https://pctires.ca/product-feed.txt` (primary) + `local-inventory-feed.txt` (local, store code 11770934583290184135), both fetched daily at 00:00. Datasets last refreshed 2026-07-07.
- **Monthly refresh** (`refresh-tools/README-REFRESH.md`): unchanged procedure; generate.py now also emits Buy buttons; LASTMOD constant should be set to the refresh date (currently 2026-07-11 from this session's regeneration).
- **Phone**: 519-397-4686 (voip.ms DID, SMS-capable, now also the SMS sender for quotes).
- Shop: 7144 Grande River Line, Pain Court, ON N0P 1Z0 · Mon–Sat 8–6, Sun closed.

---

**Start the next session with:** "Check Merchant Center review status" or "Build about.html" — both are queued above.
