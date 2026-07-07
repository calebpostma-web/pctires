# PC Tires — Monthly Model Page + Feed Refresh

**Purpose:** keep the 16 tire model pages, `product-feed.txt` (Google Merchant
Center primary feed), and `local-inventory-feed.txt` (local inventory feed)
in sync with live TDG stock and the site's live pricing. Run monthly.
A scheduled task ("pctires-monthly-refresh") triggers Claude to do this;
Caleb only runs the final push.

## What lives here

- `generate.py` — builds all 16 model pages from `tdg-data.txt` (per-model copy is embedded in the script)
- `build-feed.py` — builds `product-feed.txt` from `feed-src.txt`, validated against `tdg-data.txt` (price match + GTIN check digits)
- `build-local-feed.py` — builds `local-inventory-feed.txt` from `product-feed.txt`; store code argument: `11770934583290184135`
- `tdg-data.txt` — page dataset: `#Brand|model-key|Season|Service` headers + `size|load|speed|qty|retail` rows (LAST REFRESH: 2026-07-06)
- `feed-src.txt` — feed dataset: `model-key|size|load|speed|qty|retail|gtin|mpn|image-path` rows (LAST REFRESH: 2026-07-06)

## Refresh procedure (Claude does steps 1-6, Caleb does step 7)

1. **Copy this folder's scripts into the session sandbox** (session outputs dir), work there.
2. **Re-pull live data via the browser** on an open pctires.ca tab (Chrome MCP).
   Use the site's own pricing engine — call `retailPrice({price: cost, map, size, boltPattern: undefined})`
   in page context. Pull per brand via `/tdg-proxy` (`path:'search'` payload `{brands:[...]}`,
   then `path:'inventory'` payload `{itemnumbers:[...]}` in batches of 50; qty = sum of
   `locations[].qtyAvailable`; cost/map from `inventory.pricing`). Keep rows with qty>=5 for the
   feed (also require gtin + productImageUrl); qty>0 for pages. Model regexes are in generate.py's
   data-key mapping and the original pull code — models: Antares (Comfort A5, Ingens A1, Ingens-Locus,
   Ingens EV, Polymax 4S, Grip 60 Ice, Goliath AT, SMT A7), Michelin (CrossClimate2 family regex
   /^CrossClimate ?2/, X-Ice Snow /^X-Ice Snow/, Pilot Sport AS 4), Pirelli (Scorpion AS Plus 3,
   Scorpion Weatheractive), Continental (ExtremeContact DWS06 PLUS), Bridgestone (WeatherPeak,
   Blizzak IcePeak).
   **Extraction trick:** browser tool output truncates ~2.5KB; inject the dataset into the page DOM
   (`document.body.innerHTML = '<pre>' + text + '</pre>'` in chunks of ~26KB) and read with
   get_page_text, then navigate the tab back to pctires.ca.
3. **Update the two dataset files** (tdg-data.txt, feed-src.txt) and the `CHECKED`/`LASTMOD`
   date constants in generate.py.
4. **Regenerate:** `python3 generate.py` (16 pages), `python3 build-feed.py`,
   `python3 build-local-feed.py 11770934583290184135`.
5. **Verify** (same checks as the original build): HTML parses, 2 JSON-LD blocks per page and they
   json-parse, price spot-checks vs data, all GTINs check-digit valid, feed columns = 13 tab-separated,
   local feed row count == product feed row count, no WELCOME10, phone 519-397-4686 only.
6. **Copy outputs to the repo folder** (16 .html files, product-feed.txt, local-inventory-feed.txt)
   and update the copies of the dataset files in refresh-tools/. Report results to Caleb.
7. **Caleb:** `cd C:\Users\Caleb\Documents\Claude\Projects\PCtires` then `.\push-pctires.ps1`.
   Google fetches both feeds daily at 00:00 automatically after that.

## Key references
- Merchant Center: PC Tires, ID 5821577669. Primary feed + local inventory feed both File(URL), daily fetch.
- Store code (GBP shop code): 11770934583290184135
- Feed URLs: https://pctires.ca/product-feed.txt, https://pctires.ca/local-inventory-feed.txt
- Delivery policy: Destination/Postcodes zone (N7L, N7M, N0P, N8A) at $25 — do not touch during refresh.
- Pricing engine note: TEST_NET_TARGET toggle in index.html changes retailPrice(); using the live
  site's own function (step 2) keeps everything consistent automatically, whatever Caleb has toggled.
