// /functions/product.js
// PC Tires — per-SKU product landing pages:  https://pctires.ca/p/<feed-id>
//
// WHY THIS EXISTS
// Google Merchant Center suspended the account with "User cannot complete
// purchase" and a price-mismatch flag. Both had the same root cause: every SKU
// in product-feed.txt used the shared model page (e.g. /michelin-x-ice-snow) as
// its landing page, and every Buy button on those model pages deep-linked to
// the homepage. A crawler landing there sees 100+ sizes and a "from $177.62"
// headline instead of the one SKU at its feed price, and no purchasable item.
//
// This function serves a real, server-rendered product page for each feed id.
// It reads product-feed.txt at request time — the exact same file Google
// fetches — so the price on the landing page is by construction identical to
// the price in the feed. There is no second source of truth to drift.
//
// Route: functions/product.js  ->  /product?id=<feed-id>
//
// URL SHAPE -- WHY A QUERY PARAM AND NOT /p/<id>
// Two earlier attempts failed on this specific deployment:
//   1. functions/p/[pid].js -- correct Cloudflare convention, but push-pctires.ps1
//      deploys by PUTting each file to the GitHub Contents API by URL, and a
//      filename containing [ ] is not safely representable in that path.
//   2. functions/p/_middleware.js -- a Pages directory holding ONLY middleware
//      and no route file never gets routed; /p/<id> returned 404 in production
//      while /used-tires (a top-level function file) worked fine. (/q/ survives
//      only because _redirects has an explicit /q/* rule.)
// A top-level function file is the pattern this project has actually proven, so
// that is what this is. Query-string landing pages are entirely normal for
// Merchant Center -- each SKU still gets a unique, canonical, crawlable URL.
// _redirects also 301s /p/<id> -> /product?id=<id> so the short form still works.

const FEED_PATH = '/product-feed.txt';
const TTL_MS = 5 * 60 * 1000; // re-read the feed at most every 5 minutes per isolate

// model-key -> page metadata. Mirrors META in refresh-tools/build-feed.py.
// Keep these two in sync when a model is added or removed.
const META = {
  'ingens-a1':              { brand: 'Antares',     model: 'Ingens A1',                 page: 'antares-ingens-a1' },
  'ingens-locus':           { brand: 'Antares',     model: 'Ingens-Locus',              page: 'antares-ingens-locus' },
  'ingens-ev':              { brand: 'Antares',     model: 'Ingens EV',                 page: 'antares-ingens-ev' },
  'comfort-a5':             { brand: 'Antares',     model: 'Comfort A5',                page: 'antares-comfort-a5' },
  'polymax-4s':             { brand: 'Antares',     model: 'Polymax 4S',                page: 'antares-polymax-4s' },
  'grip-60-ice':            { brand: 'Antares',     model: 'Grip 60 Ice',               page: 'antares-grip-60-ice' },
  'goliath-at':             { brand: 'Antares',     model: 'Goliath AT',                page: 'antares-goliath-at' },
  'smt-a7':                 { brand: 'Antares',     model: 'SMT A7',                    page: 'antares-smt-a7' },
  'crossclimate2':          { brand: 'Michelin',    model: 'CrossClimate2',             page: 'michelin-crossclimate2' },
  'x-ice-snow':             { brand: 'Michelin',    model: 'X-Ice Snow',                page: 'michelin-x-ice-snow' },
  'pilot-sport-as-4':       { brand: 'Michelin',    model: 'Pilot Sport All Season 4',  page: 'michelin-pilot-sport-as-4' },
  'scorpion-as-plus-3':     { brand: 'Pirelli',     model: 'Scorpion AS Plus 3',        page: 'pirelli-scorpion-as-plus-3' },
  'scorpion-weatheractive': { brand: 'Pirelli',     model: 'Scorpion Weatheractive',    page: 'pirelli-scorpion-weatheractive' },
  'dws06-plus':             { brand: 'Continental', model: 'ExtremeContact DWS06 Plus', page: 'continental-dws06-plus' },
  'weatherpeak':            { brand: 'Bridgestone', model: 'WeatherPeak',               page: 'bridgestone-weatherpeak' },
  'blizzak-icepeak':        { brand: 'Bridgestone', model: 'Blizzak IcePeak',           page: 'bridgestone-blizzak-icepeak' },
};

// Longest key first so 'ingens-a1' can never shadow a longer key that starts the same way.
const META_KEYS = Object.keys(META).sort((a, b) => b.length - a.length);

// ---------------------------------------------------------------- feed cache
let _cache = null; // { at: <ms>, map: Map<id, row> }

async function loadFeed(env, request) {
  const now = Date.now();
  if (_cache && now - _cache.at < TTL_MS) return _cache.map;

  const url = new URL(FEED_PATH, request.url).toString();
  let res = null;
  try {
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      res = await env.ASSETS.fetch(new Request(url, { headers: { 'Accept': 'text/plain' } }));
    }
  } catch (e) { res = null; }
  if (!res || !res.ok) {
    // Fallback: fetch the published asset over HTTP.
    try { res = await fetch(url, { cf: { cacheTtl: 300 } }); } catch (e) { res = null; }
  }
  if (!res || !res.ok) {
    // Serve the previous cache rather than 500ing if the feed is briefly unreadable.
    if (_cache) return _cache.map;
    throw new Error('feed unavailable');
  }

  const text = await res.text();
  const lines = text.split('\n');
  const header = (lines[0] || '').split('\t');
  const col = {};
  header.forEach((h, i) => { col[h.trim()] = i; });

  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const c = line.split('\t');
    const id = (c[col.id] || '').trim();
    if (!id) continue;
    map.set(id, {
      id: id,
      title: (c[col.title] || '').trim(),
      description: (c[col.description] || '').trim(),
      image: (c[col.image_link] || '').trim(),
      availability: (c[col.availability] || 'in_stock').trim(),
      price: (c[col.price] || '').trim(),
      brand: (c[col.brand] || '').trim(),
      gtin: (c[col.gtin] || '').trim(),
      mpn: (c[col.mpn] || '').trim(),
      productType: (c[col.product_type] || '').trim(),
    });
  }
  _cache = { at: now, map: map };
  return map;
}

// ---------------------------------------------------------------- helpers
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function metaForId(id) {
  for (const k of META_KEYS) {
    if (id === k || id.startsWith(k + '-')) return { key: k, ...META[k] };
  }
  return null;
}

// "285.97 CAD" -> { amount: '285.97', currency: 'CAD' }
function parsePrice(raw) {
  const m = /^\s*([\d.]+)\s*([A-Z]{3})\s*$/.exec(raw || '');
  if (!m) return null;
  return { amount: m[1], currency: m[2] };
}

// Title is built as "<brand> <model> <size> <load><speed> <season> Tire".
// Strip the known prefix/suffix to recover the size and load/speed for this SKU.
// The size itself can carry a trailing token of its own -- "245/40R19 XL",
// "35x12.50R18LT LRE" -- so the load/speed is the LAST token, not the second.
function parseTitle(title, meta, season) {
  const out = { size: '', load: '', speed: '' };
  let t = title;
  const prefix = meta.brand + ' ' + meta.model + ' ';
  if (t.startsWith(prefix)) t = t.slice(prefix.length);
  const suffix = ' ' + season + ' Tire';
  if (t.endsWith(suffix)) t = t.slice(0, -suffix.length);
  const parts = t.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return out;
  // Load index + speed rating: 98W, 123R, and the parenthesised 95(Y) form.
  const ls = /^(\d{2,3})(\(?[A-Z]{1,2}\)?)$/.exec(parts[parts.length - 1]);
  if (ls && parts.length > 1) {
    out.load = ls[1];
    out.speed = ls[2];
    out.size = parts.slice(0, -1).join(' ');
  } else {
    out.size = parts.join(' ');
  }
  return out;
}

// The site searches TDG with plain metric sizes (215/55R16, 35X12.50R18), so
// reduce the display size to that form for the deep link: first token only,
// then drop any P/LT/C prefix and any trailing service/load-range suffix.
function plainSize(size) {
  return String(size || '')
    .trim()
    .split(/\s+/)[0]
    .replace(/^(P|LT|C)(?=\d)/, '')
    .replace(/(XL|LR[A-F]|RF|LT|C)$/, '');
}

const CSS = `
:root{--black:#0a0a0a;--card:#141414;--raised:#1c1c1c;--border:#2a2a2a;--white:#fff;--light:#d4d4d4;--muted:#8a8a8a;--yellow:#f5c518;--yellow-dark:#dba900;--green:#16a34a;--red:#dc2626}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--black);color:var(--white);font-family:'Barlow',sans-serif;font-size:16px;line-height:1.7;overflow-x:hidden}
.site-header{position:sticky;top:0;z-index:100;background:rgba(10,10,10,.96);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);padding:14px 32px;display:flex;align-items:center;justify-content:space-between}
.logo{font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:var(--white);text-decoration:none}
.logo .pc{color:var(--yellow)}
.nav-actions{display:flex;align-items:center;gap:18px}
.nav-actions a{font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--muted);text-decoration:none;transition:color .2s}
.nav-actions a:hover{color:var(--white)}
.cta-btn{background:var(--yellow);color:var(--black);padding:9px 18px;font-weight:700;border-radius:2px;font-size:13px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;transition:background .2s}
.cta-btn:hover{background:var(--yellow-dark);color:var(--black)!important}
.promo-strip{background:linear-gradient(90deg,#000 0%,#1a1a1a 50%,#000 100%);color:var(--yellow);font-size:13px;font-weight:600;padding:9px 16px;text-align:center;border-bottom:1px solid var(--yellow)}
.promo-strip strong{color:var(--yellow);text-transform:uppercase;letter-spacing:.8px;font-weight:800}
.promo-strip code{background:var(--yellow);color:var(--black);padding:2px 8px;border-radius:2px;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:800;letter-spacing:1.5px;margin-left:6px}
.wrap{max-width:980px;margin:0 auto;padding:34px 24px 80px}
.crumbs{font-size:12px;text-transform:uppercase;letter-spacing:1.4px;color:var(--muted);font-weight:600;margin-bottom:24px}
.crumbs a{color:var(--muted);text-decoration:none;border-bottom:0}
.crumbs a:hover{color:var(--yellow)}
.crumbs .sep{opacity:.4;margin:0 7px}
.product{display:grid;grid-template-columns:minmax(0,400px) minmax(0,1fr);gap:44px;align-items:start}
.shot{background:var(--card);border:1px solid var(--border);border-radius:3px;padding:26px;display:flex;align-items:center;justify-content:center;min-height:320px}
.shot img{max-width:100%;height:auto;display:block}
h1{font-family:'Barlow Condensed',sans-serif;font-size:clamp(28px,4vw,40px);line-height:1.1;font-weight:900;letter-spacing:-.5px;color:var(--white);margin-bottom:6px}
h1 .accent{color:var(--yellow)}
.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:1.6px;color:var(--yellow);font-weight:700;margin-bottom:10px}
.sizeline{font-family:'IBM Plex Mono',monospace;font-size:15px;color:var(--light);margin-bottom:20px}
.pricebox{background:var(--card);border:1px solid var(--border);border-left:3px solid var(--yellow);border-radius:2px;padding:20px 24px;margin-bottom:20px}
.price{font-family:'Barlow Condensed',sans-serif;font-size:46px;font-weight:900;color:var(--yellow);line-height:1}
.price .cur{font-size:19px;color:var(--muted);font-weight:700;margin-left:6px;letter-spacing:1px}
.price-sub{font-size:14px;color:var(--muted);margin-top:6px}
.stock{display:inline-block;font-size:13px;font-weight:700;letter-spacing:.6px;margin-top:12px}
.stock.in{color:var(--green)}
.stock.out{color:var(--red)}
.buy-row{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:22px 0 10px}
.buy-btn{display:inline-block;background:var(--yellow);color:#111;font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;text-decoration:none;padding:15px 34px;border-radius:2px;border-bottom:0;transition:background .2s}
.buy-btn:hover{background:var(--yellow-dark)}
.call-btn{font-family:'IBM Plex Mono',monospace;font-size:17px;color:var(--white);text-decoration:none;border-bottom:0}
.call-btn:hover{color:var(--yellow)}
.buy-note{font-size:13px;color:var(--muted);margin-bottom:26px}
.specs{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0 26px}
.specs th{text-align:left;font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:1px;font-size:12px;color:var(--muted);font-weight:700;padding:9px 12px 9px 0;width:170px;vertical-align:top;border-bottom:1px solid var(--border)}
.specs td{padding:9px 0;color:var(--light);border-bottom:1px solid var(--border);font-family:'IBM Plex Mono',monospace;font-size:13px}
h2{font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:800;color:var(--white);margin:46px 0 14px;line-height:1.2}
p{margin-bottom:16px;color:var(--light)}
a{color:var(--yellow);text-decoration:none;border-bottom:1px solid rgba(245,197,24,.3)}
a:hover{border-bottom-color:var(--yellow)}
.callout{background:var(--raised);border-left:3px solid var(--yellow);padding:18px 22px;margin:24px 0;border-radius:2px;font-size:15px}
.callout strong{color:var(--yellow)}
footer{padding:34px 24px;border-top:1px solid var(--border);text-align:center;color:var(--muted);font-size:13px;margin-top:60px}
footer a{color:var(--muted);border-bottom:0;margin:0 8px}
footer a:hover{color:var(--yellow)}
.foot-links{margin-bottom:10px}
@media(max-width:760px){
  .product{grid-template-columns:1fr;gap:28px}
  .wrap{padding:24px 18px 60px}
  .site-header{padding:12px 16px}
  .nav-actions{gap:10px}
  .nav-actions a{font-size:11px}
  .cta-btn{padding:7px 12px;font-size:11px}
  .shot{min-height:220px;padding:18px}
  .price{font-size:38px}
  .buy-btn{width:100%;text-align:center}
}`;

const GTAG = `
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18156336783"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-18156336783');
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest && e.target.closest('a[href^="tel:"]');
    if (a && typeof gtag === 'function') {
      gtag('event', 'conversion', { 'send_to': 'AW-18156336783/SbSRCNu5nbEcEI_tztFD' });
    }
  }, true);
</script>`;

const HEADER = `
<header class="site-header">
  <a href="/" class="logo"><span class="pc">PC</span>TIRES</a>
  <div class="nav-actions">
    <a href="/#catalog">Shop Tires</a>
    <a href="/used-tires">Budget Tires</a>
    <a href="tel:5193974686" class="cta-btn">519-397-4686</a>
  </div>
</header>`;

const FOOTER = `
<footer>
  <div class="foot-links">
    <a href="/about">About</a><a href="/contact">Contact</a><a href="/returns">Returns &amp; Warranty</a><a href="/shipping">Shipping &amp; Delivery</a><a href="/privacy">Privacy</a>
  </div>
  <p style="margin:0">PC Tires &mdash; 7144 Grande River Line, Pain Court, ON N0P 1Z0 &middot; <a href="tel:5193974686">519-397-4686</a></p>
  <p style="margin-top:8px;font-size:12px">&copy; 2026 PC Tires (Postma Contracting Inc.). All rights reserved.</p>
</footer>`;

// ---------------------------------------------------------------- rendering
function renderProduct(row, meta, origin) {
  const season = row.productType.replace(/^Tires\s*>\s*/, '').trim();
  const { size, load, speed } = parseTitle(row.title, meta, season);
  const price = parsePrice(row.price);
  const inStock = row.availability === 'in_stock';
  const canonical = origin + '/product?id=' + encodeURIComponent(row.id);
  const modelPage = '/' + meta.page;
  const full = meta.brand + ' ' + meta.model;

  // Complete-purchase path: hand the size, brand and item number to the shop
  // page, which runs a live TDG lookup, drops this exact tire in the cart and
  // opens it. handleBuyLink() in index.html reads these params.
  const buyHref = '/?buysize=' + encodeURIComponent(plainSize(size)) +
                  '&brand=' + encodeURIComponent(meta.brand) +
                  '&add=' + encodeURIComponent(row.mpn) +
                  '&gtin=' + encodeURIComponent(row.gtin) + '#catalog';

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: row.title,
    description: row.description,
    sku: row.id,
    mpn: row.mpn,
    gtin: row.gtin,
    image: [row.image],
    brand: { '@type': 'Brand', name: row.brand },
    category: 'Automotive Tires',
    offers: {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: price ? price.currency : 'CAD',
      price: price ? price.amount : '',
      itemCondition: 'https://schema.org/NewCondition',
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'AutoPartsStore',
        '@id': 'https://pctires.ca/#business',
        name: 'PC Tires',
        telephone: '+1-519-397-4686',
        image: 'https://pctires.ca/favicon-192.png',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '7144 Grande River Line',
          addressLocality: 'Pain Court',
          addressRegion: 'ON',
          postalCode: 'N0P 1Z0',
          addressCountry: 'CA',
        },
      },
    },
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Tires', item: origin + '/#catalog' },
      { '@type': 'ListItem', position: 2, name: full, item: origin + modelPage },
      { '@type': 'ListItem', position: 3, name: size, item: canonical },
    ],
  };

  const metaDesc = full + ' ' + size + (load ? ' ' + load + speed : '') +
    ' — $' + (price ? price.amount : '') + ' per tire at PC Tires in Chatham-Kent. ' +
    'In stock, buy online, installed locally for $25 a tire.';

  return `<!DOCTYPE html>
<html lang="en-CA">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(row.title)} | $${esc(price ? price.amount : '')} | PC Tires</title>
<meta name="description" content="${esc(metaDesc)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(row.title)}">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:type" content="product">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(row.image)}">
<meta property="og:locale" content="en_CA">
<meta property="og:site_name" content="PC Tires">
<meta property="product:price:amount" content="${esc(price ? price.amount : '')}">
<meta property="product:price:currency" content="${esc(price ? price.currency : 'CAD')}">
<script type="application/ld+json">
${JSON.stringify(productLd, null, 1)}
</script>
<script type="application/ld+json">
${JSON.stringify(breadcrumbLd, null, 1)}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet">
${GTAG}
<style>${CSS}</style>
</head>
<body>

<div class="promo-strip">
  <strong>In stock in Chatham-Kent:</strong> $${esc(price ? price.amount : '')}/tire + $25/tire local install. Call <code>519-397-4686</code>
</div>
${HEADER}
<div class="wrap">

<nav class="crumbs">
  <a href="/#catalog">Tires</a><span class="sep">/</span><a href="${esc(modelPage)}">${esc(full)}</a><span class="sep">/</span><span>${esc(size)}</span>
</nav>

<div class="product">
  <div class="shot">
    <img src="${esc(row.image)}" width="400" height="400" alt="${esc(full)} ${esc(size)} tire" loading="eager">
  </div>
  <div class="info">
    <div class="eyebrow">${esc(row.brand)} &middot; ${esc(season)}</div>
    <h1>${esc(meta.model)} <span class="accent">${esc(size)}</span></h1>
    <div class="sizeline">${esc(size)}${load ? ' &nbsp;&middot;&nbsp; Load ' + esc(load) + ' &nbsp;&middot;&nbsp; Speed ' + esc(speed) : ''}</div>

    <div class="pricebox">
      <div class="price">$${esc(price ? price.amount : '')}<span class="cur">${esc(price ? price.currency : 'CAD')}</span></div>
      <div class="price-sub">per tire &middot; HST extra &middot; local install $25/tire</div>
      <div class="stock ${inStock ? 'in' : 'out'}">${inStock ? '&#10003; In stock &mdash; ships to our shop for install or pickup' : 'Currently out of stock &mdash; call for an ETA'}</div>
    </div>

    <div class="buy-row">
      <a class="buy-btn" href="${esc(buyHref)}" rel="nofollow">Add to cart &rarr;</a>
      <a class="call-btn" href="tel:5193974686">519-397-4686</a>
    </div>
    <p class="buy-note">Card, Apple&nbsp;Pay, Google&nbsp;Pay or Affirm at checkout. Tires ship to our Pain Court shop &mdash; book install for $25 a tire, or pick them up.</p>

    <table class="specs">
      <tr><th>Size</th><td>${esc(size)}</td></tr>
      ${load ? `<tr><th>Load index</th><td>${esc(load)}</td></tr><tr><th>Speed rating</th><td>${esc(speed)}</td></tr>` : ''}
      <tr><th>Brand</th><td>${esc(row.brand)}</td></tr>
      <tr><th>Model</th><td>${esc(meta.model)}</td></tr>
      <tr><th>Category</th><td>${esc(season)}</td></tr>
      <tr><th>Condition</th><td>New</td></tr>
      <tr><th>MPN</th><td>${esc(row.mpn)}</td></tr>
      <tr><th>GTIN</th><td>${esc(row.gtin)}</td></tr>
    </table>
  </div>
</div>

<h2>About this tire</h2>
<p>${esc(row.description)}</p>

<div class="callout">
  <strong>How buying works:</strong> order online and the tires ship to our shop at 7144 Grande River Line, Pain Court &mdash; minutes from Chatham. Book installation at $25 a tire (mounted, balanced, torqued to spec) or pick them up. Prices are per tire and HST is added at checkout.
</div>

<h2>Other sizes in this model</h2>
<p>This page is the ${esc(size)} fitment. See every ${esc(full)} size we stock, with current pricing, on the <a href="${esc(modelPage)}">${esc(full)} page</a>.</p>

<h2>Questions?</h2>
<p>Call or text <a href="tel:5193974686">519-397-4686</a>, or see our <a href="/returns">returns &amp; warranty policy</a>, <a href="/shipping">shipping &amp; delivery</a>, and <a href="/contact">contact details</a>.</p>

</div>
${FOOTER}
</body>
</html>`;
}

function renderNotFound(origin) {
  return `<!DOCTYPE html>
<html lang="en-CA">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Tire not found | PC Tires</title>
<meta name="robots" content="noindex, follow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;800;900&family=Barlow:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
${HEADER}
<div class="wrap">
  <h1>That tire isn&rsquo;t listed <span class="accent">right now</span></h1>
  <p>Stock moves fast. The size you were looking at may have sold through, or the link may be out of date.</p>
  <div class="buy-row">
    <a class="buy-btn" href="/#catalog">Search all tires &rarr;</a>
    <a class="call-btn" href="tel:5193974686">519-397-4686</a>
  </div>
  <p class="buy-note">Call or text us with your size and we&rsquo;ll source it &mdash; the full catalogue runs deeper than any one day&rsquo;s stock.</p>
</div>
${FOOTER}
</body>
</html>`;
}

// ---------------------------------------------------------------- handler
export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const origin = url.origin;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { 'Allow': 'GET, HEAD' } });
  }

  // /product?id=<feed-id>. Also accept the /p/<id> path form, in case a
  // _redirects rewrite (rather than a redirect) ever points here.
  let pid = url.searchParams.get('id') || '';
  if (!pid && /^\/p\//.test(url.pathname)) pid = url.pathname.replace(/^\/p\/?/, '').split('/')[0];
  try { pid = decodeURIComponent(pid); } catch (e) { /* leave as-is */ }
  pid = String(pid).trim().replace(/\.html?$/i, '');

  // No id at all isn't a product -- send them to the catalogue.
  if (!pid) return Response.redirect(origin + '/#catalog', 302);

  const notFound = () => new Response(renderNotFound(origin), {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
  });

  if (!pid || !/^[A-Za-z0-9._-]{1,120}$/.test(pid)) return notFound();

  let feed;
  try {
    feed = await loadFeed(env, request);
  } catch (e) {
    return new Response('Product catalogue temporarily unavailable. Call 519-397-4686.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const row = feed.get(pid);
  if (!row) return notFound();

  const meta = metaForId(row.id);
  if (!meta) return notFound();

  return new Response(renderProduct(row, meta, origin), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Short cache: the feed is regenerated monthly, but a short TTL keeps a
      // price correction live within minutes rather than hours.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'X-Robots-Tag': 'index, follow',
    },
  });
}
