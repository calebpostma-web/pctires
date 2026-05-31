# tools/ — landing page generator

This folder contains the auto-generator that produces SEO-optimized landing pages from your live TDG inventory.

## What's here

- **`generate-tire-pages.js`** — Node.js generator. Fetches live tire data from your `/tdg-proxy` endpoint, generates one landing page per popular tire size, writes them to `./tires/`, updates `sitemap.xml`.
- **`run-generator.ps1`** — PowerShell wrapper that checks Node version, backs up sitemap, runs the generator, and prints next steps.

## Requirements

- **Node.js 18 or later** (uses built-in `fetch`, no `npm install` needed)
  - Check: `node --version`
  - If missing or too old: install LTS from https://nodejs.org/

## How to run

From `C:\Users\Caleb\Documents\Claude\Projects\PCtires`:

```powershell
.\tools\run-generator.ps1
```

The script will:

1. Verify Node 18+ is installed
2. Back up `sitemap.xml` with a timestamp
3. Run the generator (fetches TDG, generates ~31 pages)
4. List the generated files
5. Print next steps

Typical run takes 60-90 seconds (one TDG call per size, with 250ms politeness delay between).

## What gets generated

For each entry in `POPULAR_SIZES` at the top of `generate-tire-pages.js`:

- One HTML file at `./tires/{size-slug}.html` (e.g. `./tires/225-65r17.html`)
- Page includes:
  - Local SEO meta tags (title, description, OG, geo, canonical)
  - `Product` JSON-LD schema for each tire in the size (up to 30)
  - `BreadcrumbList` schema
  - `FAQPage` schema with 4 questions sized to the page
  - Listing of tires grouped by season (All-Season / All-Weather / Winter / Summer / Truck)
  - "Browse other sizes" cross-link block (internal linking for SEO)
  - Service area mentions for Chatham-Kent local relevance

After all sizes generate, `sitemap.xml` is rewritten — any prior `/tires/*.html` entries are replaced with the new ones (so re-runs don't duplicate). All other entries (home, service pages, manuals) are preserved.

## Editing the size list

Open `generate-tire-pages.js` and modify the `POPULAR_SIZES` array. Format:

```js
['225/65R17', ['Honda CR-V', 'Subaru Forester', 'Subaru Outback']],
```

First element is the exact size string. Second is a list of common vehicles using that size — appears as a sentence on the page to give Google context.

## Cadence

Run the generator any time:

- Your TDG inventory changes significantly (new brand carry, big stock changes)
- You want fresh prices in the schema (Google uses `priceValidUntil` which is set to 30 days out, so refresh at least monthly)
- Before any major marketing push

Future automation idea: GitHub Action that runs this nightly so prices and stock stay fresh automatically. Not built yet.

## Rollback

If the generator produces something weird:

```powershell
# Remove all generated pages
Remove-Item .\tires\*.html

# Restore previous sitemap (timestamped backup)
Copy-Item -Force .\sitemap.xml.bak-<timestamp> .\sitemap.xml
```

`push-pctires.ps1` next will clear the live deploys of the removed pages.

