# SEO Phase 2 — Service Landing Pages + Schema

Four new landing pages, updated sitemap, and one small PowerShell script to wire them into your footer.

## What you have now

**4 new HTML files (ready to push as-is):**
- `tire-installation.html` (~22KB) — broad-keyword page for "tire installation Chatham"
- `winter-tires.html` (~25KB) — high-value seasonal page; biggest SEO target Oct–Dec
- `tpms-service.html` (~22KB) — niche, low-competition, high-intent
- `seasonal-changeover.html` (~22KB) — twice-yearly seasonal page Mar–May / Sep–Nov

Each page includes:
- Local SEO meta tags (geo, canonical, OG)
- Three JSON-LD schema blocks: **Service** + **BreadcrumbList** + **FAQPage**
- 1,000–1,500 words of substantive content (not thin)
- FAQ section with 6–8 questions (drives featured-snippet eligibility)
- "Areas We Serve" section with Chatham-Kent town tags
- Internal links to other landing pages and home
- Matches your dark-theme aesthetic

**Updated `sitemap.xml`:**
- All 4 new pages added with priority + lastmod
- Plus privacy/returns pages I created earlier
- Submit to Google Search Console after deploy: https://search.google.com/search-console

**Footer-wiring script (`wire-footer-links.ps1`):**
- Swaps the footer "Services" column in `index.html` to link to the 4 new landing pages instead of in-page anchors
- This gives Google an internal link from every page view to each landing page (a small but important ranking signal)

## How to deploy

Most direct path:

```powershell
cd C:\Users\Caleb\Documents\Claude\Projects\PCtires
.\wire-footer-links.ps1
.\push-pctires.ps1
```

That's it. `push-pctires.ps1` should pick up:
- The 4 new HTML files (tire-installation, winter-tires, tpms-service, seasonal-changeover)
- The updated sitemap.xml
- The footer change to index.html

If your push script doesn't pick up new files automatically:
```powershell
git add tire-installation.html winter-tires.html tpms-service.html seasonal-changeover.html sitemap.xml
git commit -m "SEO Phase 2: service landing pages + sitemap"
git push
```

## After deploying

1. **Hit each page in a browser** to make sure they render correctly:
   - https://pctires.ca/tire-installation.html
   - https://pctires.ca/winter-tires.html
   - https://pctires.ca/tpms-service.html
   - https://pctires.ca/seasonal-changeover.html

2. **Submit sitemap to Google Search Console**:
   - Go to https://search.google.com/search-console
   - Pick your pctires.ca property
   - Left menu -> Sitemaps
   - Enter `sitemap.xml` and click Submit
   - Google will discover and crawl all 4 new pages within 1-7 days

3. **Test the schema with Google's Rich Results Test**:
   - Go to https://search.google.com/test/rich-results
   - Paste each landing page URL
   - Confirm Service, BreadcrumbList, and FAQPage are all detected with zero errors
   - This is how you know your schema is valid (and eligible for SERP enhancements)

## What this is worth

For local SEO in Chatham-Kent specifically:

- **Winter-tires.html** is the biggest immediate win — that page targets the highest-volume seasonal keyword in your service area. Submit it well before October and you should rank top 5 by November.
- **Tire-installation.html** targets a broader, more competitive keyword but builds your overall topical authority.
- **TPMS-service.html** is the niche play — low competition, high purchase intent. People searching this have a specific problem and need it solved today.
- **Seasonal-changeover.html** is the twice-a-year revenue driver — peaks in April and October.

Combined with the technical SEO already deployed (anchors, LCP, vehicle DB extraction), your mobile rankings should improve materially over the next 2-3 months as Google re-crawls and re-evaluates.

## Still to do (your call)

Things from my earlier list I haven't built yet:
- **Real Google reviews collection system** — requires you to actually text customers after install. Can't be automated from my side.
- **Google Business Profile optimization** — 30 minutes of work on YOUR end (adding service categories, photos, posts)
- **Product schema for individual tires/wheels** — deeper integration with the TDG-driven catalog. Skipped because the catalog is dynamic and the simpler approach (Service schema on landing pages) covers most of the rich-result opportunity.
- **More blog posts** — "When to switch to winter tires in Ontario", "Tire size for popular vehicles", etc.

When you're ready for any of these, just say the word.

## Rollback

If anything looks broken after deploy:

```powershell
# Restore index.html footer change
Copy-Item -Force .\index.html.bak-footerlinks-<timestamp> .\index.html

# Remove the 4 new landing pages (if you want)
Remove-Item .\tire-installation.html, .\winter-tires.html, .\tpms-service.html, .\seasonal-changeover.html

# Push the rollback
.\push-pctires.ps1
```

