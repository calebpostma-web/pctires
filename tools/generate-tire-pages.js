#!/usr/bin/env node
/**
 * generate-tire-pages.js
 *
 * Pulls the live TDG catalog (via your existing /tdg-proxy endpoint at pctires.ca)
 * and generates static landing pages per popular tire size, with full Product
 * schema, Google-friendly meta tags, FAQs, and internal links.
 *
 * Output: ./tires/{size-slug}.html  (e.g. ./tires/225-65r17.html)
 * Also updates ./sitemap.xml with the new pages.
 *
 * Usage:
 *   node tools/generate-tire-pages.js
 *
 * Requires Node 18+ (uses built-in fetch). No npm install needed.
 */

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────
const TDG_PROXY = 'https://pctires.ca/tdg-proxy';
const SITE_ORIGIN = 'https://pctires.ca';
const OUTPUT_DIR = path.join(__dirname, '..', 'tires');
const SITEMAP_PATH = path.join(__dirname, '..', 'sitemap.xml');
const MARKUP_MULTIPLIER = 1.35;  // matches index.html TDG.MARKUP
const INSTALL_PRICE = 25;

// The sizes we'll generate pages for. These are the highest-search-volume tire
// sizes in southwestern Ontario based on common vehicle distribution.
// Each entry: [size string, [common vehicles using this size]]
const POPULAR_SIZES = [
  ['205/55R16', ['Toyota Corolla', 'Honda Civic (older)', 'Mazda3', 'VW Jetta']],
  ['215/55R17', ['Honda Civic', 'Mazda3', 'Hyundai Elantra']],
  ['215/60R16', ['Subaru Crosstrek', 'Mazda CX-30', 'Kia Soul']],
  ['215/65R16', ['Mid-size sedans and compact CUVs']],
  ['225/45R17', ['VW Golf GTI', 'Acura Integra', 'Mazda3 Sport']],
  ['225/50R17', ['Honda Accord', 'Mazda6', 'Hyundai Sonata']],
  ['225/55R17', ['Hyundai Tucson', 'Nissan Qashqai']],
  ['225/60R17', ['Honda CR-V (older)', 'Subaru Forester']],
  ['225/65R17', ['Honda CR-V', 'Subaru Forester', 'Subaru Outback']],
  ['235/45R18', ['Toyota Camry', 'Honda Accord', 'Mazda6']],
  ['235/55R18', ['Toyota Highlander', 'Ford Edge']],
  ['235/60R17', ['Mid-size SUVs and CUVs']],
  ['235/60R18', ['Honda Pilot', 'Mazda CX-9']],
  ['235/65R16', ['Mid-size SUVs (older)', 'Minivans']],
  ['235/65R17', ['Toyota RAV4', 'Ford Escape', 'Nissan Rogue']],
  ['235/65R18', ['Acura MDX', 'Lincoln Nautilus']],
  ['245/45R18', ['BMW 3 Series', 'Mercedes-Benz C-Class']],
  ['245/45R19', ['Lexus ES', 'Acura TLX']],
  ['245/60R18', ['Toyota Highlander', 'Honda Pilot', 'Ford Explorer']],
  ['245/65R17', ['Mid-size pickup trucks', 'Toyota Tacoma']],
  ['255/55R18', ['Ford Edge', 'Lincoln Nautilus']],
  ['255/55R20', ['Ford Explorer', 'Acura MDX']],
  ['255/65R18', ['Ford F-150 (smaller wheels)', 'Toyota Tundra']],
  ['255/70R18', ['Toyota Tacoma', 'Toyota 4Runner', 'Nissan Frontier']],
  ['265/60R18', ['Full-size pickups', 'Toyota Tacoma']],
  ['265/65R17', ['Toyota Tacoma', 'Nissan Frontier', 'Ford Ranger']],
  ['265/65R18', ['Chevy Silverado', 'GMC Sierra', 'Nissan Titan']],
  ['265/70R17', ['Toyota Tacoma', 'Toyota 4Runner', 'Jeep Wrangler']],
  ['275/55R20', ['Chevy Tahoe', 'GMC Yukon', 'Ford Expedition']],
  ['275/60R20', ['RAM 1500', 'Ford F-150', 'Chevy Silverado']],
  ['275/65R18', ['Ford F-150', 'Chevy Silverado', 'GMC Sierra', 'RAM 1500']],
];

// Vehicle areas served, repeated across pages for local SEO
const AREAS_SERVED = [
  'Chatham', 'Chatham-Kent', 'Wallaceburg', 'Tilbury', 'Blenheim',
  'Ridgetown', 'Dresden', 'Pain Court', 'Mitchell\'s Bay', 'Erieau',
  'Bothwell', 'Thamesville', 'Wheatley'
];

// ─────────────────────────────────────────────────────────────────────────
// TDG FETCH HELPERS
// ─────────────────────────────────────────────────────────────────────────
async function tdgFetch(action, payload) {
  const res = await fetch(TDG_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: action, payload: payload || {} })
  });
  if (!res.ok) throw new Error(`TDG ${action} failed: ${res.status} ${res.statusText}`);
  return res.json();
}

function extractData(r) {
  if (Array.isArray(r)) return r;
  if (r?.data && Array.isArray(r.data)) return r.data;
  if (r?.products && Array.isArray(r.products)) return r.products;
  if (r?.items && Array.isArray(r.items)) return r.items;
  if (r?.results && Array.isArray(r.results)) return r.results;
  return [];
}

// Normalise tire data — mirrors index.html's normaliseTire so prices match the live site
function normaliseTire(product, inventory) {
  const sp = product.specifications || {};
  const inv = inventory || {};
  const locs = inv.locations || [];
  const totalQty = locs.reduce((s, l) => s + (l.qtyAvailable || 0), 0);
  const seasonRaw = (sp.season || '').toLowerCase();
  let type = 'allseason';
  if (seasonRaw.includes('winter')) type = 'winter';
  else if (seasonRaw.includes('summer')) type = 'summer';
  else if (seasonRaw.includes('all weather') || seasonRaw.includes('allweather') || seasonRaw.includes('all-weather')) type = 'allweather';
  if ((sp.serviceType || '').toLowerCase().includes('lt')) type = 'truck';

  const cost = inv.pricing?.price ?? product.pricing?.price ?? 0;
  const msrp = inv.pricing?.msrp ?? product.pricing?.msrp ?? cost;
  const map = inv.pricing?.map ?? product.pricing?.map ?? null;

  let price = cost * MARKUP_MULTIPLIER;
  if (map && map > price) price = map;
  price = Math.round(price * 100) / 100;

  return {
    itemNumber: product.itemNumber,
    brand: product.brandName || product.brand || 'Unknown',
    name: product.productName || product.name || '',
    size: sp.size || '',
    type,
    season: sp.season || 'All-Season',
    price,
    msrp,
    speed: sp.speedRating || '',
    loadIndex: sp.loadIndex || '',
    sidewall: sp.sidewall || 'Black Sidewall',
    serviceType: sp.serviceType || '',
    treadwear: sp.treadwear || '',
    runFlat: sp.runFlat === 'Yes',
    evCompat: sp.eVCompatible === 'Yes',
    imageUrl: product.productImageUrl || null,
    description: product.description || '',
    stock: locs.length === 0 ? 'out' : (totalQty === 0 ? 'out' : (totalQty <= 4 ? 'low' : 'in')),
    qtyAvailable: totalQty,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// URL SLUG HELPERS
// ─────────────────────────────────────────────────────────────────────────
function sizeToSlug(size) {
  // "225/65R17" -> "225-65r17"
  return size.toLowerCase().replace(/[\/x]/g, '-');
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function escapeJson(s) {
  return String(s || '').replace(/[\\"]/g, '\\$&').replace(/\n/g, ' ').replace(/\r/g, '');
}

// ─────────────────────────────────────────────────────────────────────────
// SIZE-PAGE TEMPLATE
// ─────────────────────────────────────────────────────────────────────────
function renderSizePage(size, tires, vehicleHints) {
  const slug = sizeToSlug(size);
  const url = `${SITE_ORIGIN}/tires/${slug}.html`;

  // Sort tires: in-stock first, then by price ascending
  const sortedTires = [...tires].sort((a, b) => {
    const stockOrder = { in: 0, low: 1, out: 2 };
    const stockDiff = (stockOrder[a.stock] ?? 3) - (stockOrder[b.stock] ?? 3);
    if (stockDiff !== 0) return stockDiff;
    return a.price - b.price;
  });

  // Group by season for sectioned display
  const seasons = {
    'All-Season': sortedTires.filter(t => t.type === 'allseason'),
    'All-Weather': sortedTires.filter(t => t.type === 'allweather'),
    'Winter': sortedTires.filter(t => t.type === 'winter'),
    'Summer / Performance': sortedTires.filter(t => t.type === 'summer'),
    'Truck / SUV': sortedTires.filter(t => t.type === 'truck'),
  };
  const seasonSections = Object.entries(seasons).filter(([_, list]) => list.length > 0);

  // Stats
  const inStock = sortedTires.filter(t => t.stock !== 'out').length;
  const brands = [...new Set(sortedTires.map(t => t.brand))].filter(Boolean).sort();
  const minPrice = sortedTires.length ? Math.min(...sortedTires.filter(t => t.price > 0).map(t => t.price)) : 0;
  const maxPrice = sortedTires.length ? Math.max(...sortedTires.map(t => t.price)) : 0;

  // Vehicle hint text
  const vehiclesText = vehicleHints && vehicleHints.length
    ? `Common vehicles using ${size}: ${vehicleHints.join(', ')}.`
    : '';

  // Title and meta
  const title = `${size} Tires in Chatham-Kent — ${inStock} in Stock | PC Tires`;
  const description = `Shop ${size} tires in Chatham-Kent. ${inStock} options in stock from ${brands.length} brands. From $${Math.floor(minPrice)}. Installation $25/tire. Call 519-397-4686.`;

  // Product schema for each tire (up to 30 to avoid bloating)
  const productSchemas = sortedTires.slice(0, 30).map(t => ({
    '@type': 'Product',
    'name': `${t.brand} ${t.name}`,
    'brand': { '@type': 'Brand', 'name': t.brand },
    'sku': t.itemNumber,
    'image': t.imageUrl || `${SITE_ORIGIN}/favicon-192.png`,
    'description': `${t.brand} ${t.name} in size ${t.size}. ${t.season} tire with ${t.speed || 'standard'} speed rating, ${t.loadIndex || 'standard'} load index.`,
    'additionalProperty': [
      { '@type': 'PropertyValue', 'name': 'Tire Size', 'value': t.size },
      { '@type': 'PropertyValue', 'name': 'Season', 'value': t.season },
      ...(t.speed ? [{ '@type': 'PropertyValue', 'name': 'Speed Rating', 'value': t.speed }] : []),
      ...(t.loadIndex ? [{ '@type': 'PropertyValue', 'name': 'Load Index', 'value': t.loadIndex }] : []),
    ],
    'offers': {
      '@type': 'Offer',
      'price': t.price.toFixed(2),
      'priceCurrency': 'CAD',
      'availability': t.stock === 'out' ? 'https://schema.org/OutOfStock' : t.stock === 'low' ? 'https://schema.org/LimitedAvailability' : 'https://schema.org/InStock',
      'seller': { '@id': `${SITE_ORIGIN}/#business` },
      'priceValidUntil': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      'url': `${SITE_ORIGIN}/#catalog`,
    },
  }));

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': SITE_ORIGIN + '/' },
      { '@type': 'ListItem', 'position': 2, 'name': 'Tires by Size', 'item': SITE_ORIGIN + '/tires/' },
      { '@type': 'ListItem', 'position': 3, 'name': `${size} Tires`, 'item': url },
    ],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': [
      {
        '@type': 'Question',
        'name': `How much do ${size} tires cost in Chatham-Kent?`,
        'acceptedAnswer': { '@type': 'Answer', 'text': `${size} tires range from approximately $${Math.floor(minPrice)} to $${Math.floor(maxPrice)} per tire at PC Tires, depending on brand, season, and performance tier. Installation is an additional $25 per tire (mount, balance, TPMS reset, disposal — all-in pricing).` }
      },
      {
        '@type': 'Question',
        'name': `What does ${size} mean?`,
        'acceptedAnswer': { '@type': 'Answer', 'text': `In the tire size ${size}, the first three digits are the section width in millimetres. The next two digits are the aspect ratio (sidewall height as a percentage of width). The R means radial construction. The final two digits are the rim diameter in inches.` }
      },
      {
        '@type': 'Question',
        'name': `Do you have ${size} winter tires in stock?`,
        'acceptedAnswer': { '@type': 'Answer', 'text': `Yes. We carry ${size} winter tires from major brands including Michelin, Bridgestone, Goodyear, Continental, and Nokian. Stock varies seasonally. Book installation when you order and we'll have them ready at our Chatham-Kent shop.` }
      },
      {
        '@type': 'Question',
        'name': `Can you install ${size} tires the same day?`,
        'acceptedAnswer': { '@type': 'Answer', 'text': `If the tires are in stock, yes — usually within 48 hours of order. Online booking shows real-time availability. Walk-ins accommodated when possible but not guaranteed. Call 519-397-4686 to confirm same-day timing.` }
      },
    ],
  };

  // Tire card rendering
  function renderTireCard(t) {
    const stockClass = t.stock === 'in' ? 'in' : t.stock === 'low' ? 'low' : 'out';
    const stockLabel = t.stock === 'in' ? 'In Stock' : t.stock === 'low' ? 'Low Stock' : 'Call to Order';
    return `
    <div class="tire-card">
      <div class="tc-top">
        <div class="tc-brand">${escapeHtml(t.brand)}</div>
        <span class="stock-pill ${stockClass}">${stockLabel}</span>
      </div>
      <div class="tc-name">${escapeHtml(t.name)}</div>
      <div class="tc-meta">${escapeHtml(t.season)}${t.speed ? ' · ' + escapeHtml(t.speed) : ''}${t.loadIndex ? ' · LI ' + escapeHtml(t.loadIndex) : ''}</div>
      <div class="tc-foot">
        ${t.price > 0
          ? `<div class="tc-price">$${Math.floor(t.price)}<span class="cents">.${(t.price % 1).toFixed(2).slice(2)}</span></div>`
          : `<div class="tc-price-call">Call for price</div>`}
        <a class="tc-cta" href="/#catalog">Shop &rarr;</a>
      </div>
    </div>`;
  }

  // Build HTML
  return `<!DOCTYPE html>
<html lang="en-CA">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="keywords" content="${escapeHtml(size)} tires Chatham-Kent, ${escapeHtml(size)} Chatham, tires Chatham, tire installation Chatham-Kent">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">

<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${SITE_ORIGIN}/favicon-192.png">
<meta property="og:locale" content="en_CA">

<meta name="geo.region" content="CA-ON">
<meta name="geo.placename" content="Pain Court, Chatham-Kent, Ontario">
<meta name="geo.position" content="42.4187;-82.2776">

<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;700;800;900&family=Barlow:wght@300;400;500;600&display=swap" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;700;800;900&family=Barlow:wght@300;400;500;600&display=swap"></noscript>

<script type="application/ld+json">
${JSON.stringify({ '@context': 'https://schema.org', '@graph': productSchemas }, null, 2)}
</script>
<script type="application/ld+json">
${JSON.stringify(breadcrumbSchema, null, 2)}
</script>
<script type="application/ld+json">
${JSON.stringify(faqSchema, null, 2)}
</script>

<style>
:root{--black:#080808;--dark:#111;--card:#161616;--raised:#1d1d1d;--border:#252525;--mid:#404040;--muted:#686868;--light:#a0a0a0;--white:#f0ece0;--yellow:#f5c518;--yellow-dim:rgba(245,197,24,0.12);--yellow-dark:#d4a800;--green:#22c55e;--green-dim:rgba(34,197,94,0.12);--red:#ef4444}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--black);color:var(--white);font-family:'Barlow',sans-serif;font-size:16px;line-height:1.7;min-height:100vh}
nav{display:flex;align-items:center;justify-content:space-between;padding:18px 32px;background:var(--dark);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10}
.logo{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;letter-spacing:2px;color:var(--white);text-decoration:none}
.logo .pc{color:var(--yellow)}
.phone-link{font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--yellow);text-decoration:none;font-weight:700}
.btn{background:var(--yellow);color:var(--black);border:none;padding:10px 18px;border-radius:2px;font-family:'Barlow',sans-serif;font-size:13px;font-weight:700;text-decoration:none;display:inline-block;text-transform:uppercase;letter-spacing:1px}
.btn:hover{background:var(--yellow-dark)}
.btn.ghost{background:transparent;color:var(--white);border:1px solid var(--border)}
.btn.ghost:hover{border-color:var(--yellow);color:var(--yellow)}

.hero{padding:60px 24px 50px;background:linear-gradient(180deg,var(--dark) 0%,var(--black) 100%);border-bottom:1px solid var(--border)}
.hero-inner{max-width:1100px;margin:0 auto}
.crumbs{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:14px}
.crumbs a{color:var(--muted);text-decoration:none}
.crumbs a:hover{color:var(--yellow)}
h1{font-family:'Barlow Condensed',sans-serif;font-size:clamp(36px,6vw,56px);font-weight:900;line-height:1.05;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px}
h1 .y{color:var(--yellow)}
.hero-sub{font-size:17px;color:var(--light);max-width:720px;line-height:1.6;margin-bottom:22px}
.stat-row{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:24px}
.stat{background:var(--card);border:1px solid var(--border);padding:14px 22px;border-radius:2px}
.stat-num{font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;color:var(--yellow);line-height:1}
.stat-label{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-top:4px}
.hero-cta{display:flex;gap:12px;flex-wrap:wrap}

.wrap{max-width:1100px;margin:0 auto;padding:48px 24px}
section.block{margin-bottom:48px}
h2{font-family:'Barlow Condensed',sans-serif;font-size:clamp(24px,3.5vw,32px);font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:18px}
h2 .y{color:var(--yellow)}
p{margin-bottom:14px;color:var(--light)}
strong{color:var(--white)}
.intro{font-size:17px;color:var(--light)}

.season-section{margin-bottom:32px}
.season-head{display:flex;align-items:center;gap:14px;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid var(--border)}
.season-name{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--yellow)}
.season-count{font-size:13px;color:var(--muted);font-family:'IBM Plex Mono',monospace}

.tire-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.tire-card{background:var(--card);border:1px solid var(--border);padding:18px;border-left:3px solid var(--yellow)}
.tc-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
.tc-brand{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--yellow)}
.stock-pill{font-size:10px;font-weight:600;padding:3px 8px;border-radius:2px;letter-spacing:.5px;text-transform:uppercase}
.stock-pill.in{background:var(--green-dim);color:var(--green);border:1px solid rgba(34,197,94,.25)}
.stock-pill.low{background:var(--yellow-dim);color:var(--yellow);border:1px solid rgba(245,197,24,.25)}
.stock-pill.out{background:rgba(239,68,68,.1);color:var(--red);border:1px solid rgba(239,68,68,.2)}
.tc-name{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;line-height:1.15;margin-bottom:6px}
.tc-meta{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);margin-bottom:14px}
.tc-foot{display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid var(--border)}
.tc-price{font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;color:var(--white)}
.tc-price .cents{font-size:14px;color:var(--muted);font-weight:400}
.tc-price-call{font-size:14px;color:var(--yellow);font-weight:700}
.tc-cta{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--yellow);text-decoration:none;font-weight:700}
.tc-cta:hover{color:var(--white)}

.callout{background:var(--yellow-dim);border-left:3px solid var(--yellow);padding:18px 22px;margin:24px 0;font-size:15px;color:var(--light)}
.callout strong{color:var(--yellow)}

.brand-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.brand-tag{background:var(--raised);border:1px solid var(--border);padding:6px 14px;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--white);border-radius:2px}

.faq{margin-top:18px}
.faq-item{background:var(--card);border:1px solid var(--border);margin-bottom:8px;padding:18px 22px}
.faq-q{font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--yellow);margin-bottom:10px}
.faq-a{font-size:14px;color:var(--light);line-height:1.7}

.related{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:14px}
.related a{background:var(--card);border:1px solid var(--border);padding:12px 14px;text-decoration:none;color:var(--light);font-family:'IBM Plex Mono',monospace;font-size:13px;border-radius:2px;text-align:center}
.related a:hover{border-color:var(--yellow);color:var(--yellow)}

.cta-final{background:var(--yellow-dim);border-top:3px solid var(--yellow);padding:42px 24px;text-align:center;margin-top:32px}
.cta-final h2{margin-bottom:12px}
.cta-final p{font-size:16px;margin-bottom:22px}
.cta-final .btn{padding:12px 24px;font-size:13px;margin:0 6px 8px}

footer{background:var(--dark);border-top:1px solid var(--border);padding:28px 24px;text-align:center;color:var(--muted);font-size:13px}
footer a{color:var(--muted);text-decoration:none;margin:0 6px}
footer a:hover{color:var(--yellow)}
</style>
</head>
<body>

<nav>
  <a class="logo" href="/"><span class="pc">PC</span> TIRES</a>
  <div style="display:flex;gap:12px;align-items:center">
    <a class="phone-link" href="tel:5193974686">519-397-4686</a>
    <a class="btn" href="/#catalog">Shop All Tires</a>
  </div>
</nav>

<div class="hero">
  <div class="hero-inner">
    <div class="crumbs"><a href="/">Home</a> &rsaquo; <a href="/tires/">Tires</a> &rsaquo; ${escapeHtml(size)}</div>
    <h1>${escapeHtml(size)} Tires<br><span class="y">in Chatham-Kent</span></h1>
    <p class="hero-sub">${escapeHtml(description)}</p>
    <div class="stat-row">
      <div class="stat"><div class="stat-num">${inStock}</div><div class="stat-label">In Stock</div></div>
      <div class="stat"><div class="stat-num">${brands.length}</div><div class="stat-label">Brands</div></div>
      <div class="stat"><div class="stat-num">$${Math.floor(minPrice)}+</div><div class="stat-label">Starting Price</div></div>
      <div class="stat"><div class="stat-num">$25</div><div class="stat-label">Install Per Tire</div></div>
    </div>
    <div class="hero-cta">
      <a class="btn" href="/#catalog">Shop ${escapeHtml(size)} Tires</a>
      <a class="btn ghost" href="tel:5193974686">Call to Confirm Stock</a>
    </div>
  </div>
</div>

<div class="wrap">

<section class="block">
<h2>About <span class="y">${escapeHtml(size)}</span> Tires</h2>
<p class="intro">${vehiclesText ? escapeHtml(vehiclesText) + ' ' : ''}PC Tires stocks ${sortedTires.length} tire model${sortedTires.length === 1 ? '' : 's'} in size ${escapeHtml(size)} from ${brands.length} major brand${brands.length === 1 ? '' : 's'}. All prices include free shipping to our Chatham-Kent shop. Installation is a flat $25 per tire — mount, balance, TPMS reset, and disposal of old tires, all in.</p>
<div class="brand-tags">${brands.map(b => `<span class="brand-tag">${escapeHtml(b)}</span>`).join('')}</div>
</section>

${seasonSections.map(([season, list]) => `
<section class="season-section">
  <div class="season-head">
    <div class="season-name">${escapeHtml(season)}</div>
    <div class="season-count">${list.length} in this size</div>
  </div>
  <div class="tire-grid">
    ${list.map(renderTireCard).join('')}
  </div>
</section>
`).join('')}

<section class="block">
<h2>Frequently Asked Questions</h2>
<div class="faq">
  ${faqSchema.mainEntity.map(q => `
  <div class="faq-item">
    <div class="faq-q">${escapeHtml(q.name)}</div>
    <div class="faq-a">${escapeHtml(q.acceptedAnswer.text)}</div>
  </div>`).join('')}
</div>
</section>

<section class="block">
<h2>Browse Other <span class="y">Tire Sizes</span></h2>
<p>Looking for a different size? Pick from popular sizes serving Chatham-Kent vehicles:</p>
<div class="related">
  ${POPULAR_SIZES.filter(([s]) => s !== size).slice(0, 12).map(([s]) => `<a href="/tires/${sizeToSlug(s)}.html">${escapeHtml(s)}</a>`).join('')}
</div>
</section>

<section class="block">
<h2>Service Areas</h2>
<p>PC Tires serves Chatham-Kent and surrounding southwestern Ontario communities: ${AREAS_SERVED.join(', ')}. Our shop is at 7144 Grande River Line, Pain Court — 15 minutes from downtown Chatham, 20 from Wallaceburg, 15 from Tilbury.</p>
</section>

</div>

<div class="cta-final">
  <h2>Ready to Buy ${escapeHtml(size)} Tires?</h2>
  <p>Shop online, install at our Chatham-Kent shop. $25/tire all-in.</p>
  <a class="btn" href="/#catalog">Shop Tires</a>
  <a class="btn ghost" href="tel:5193974686">Call 519-397-4686</a>
</div>

<footer>
  &copy; 2026 PC Tires (Postma Contracting Inc.) &middot; 7144 Grande River Line, Pain Court, ON
  <div style="margin-top:8px">
    <a href="/">Home</a> &middot;
    <a href="/tire-installation.html">Tire Installation</a> &middot;
    <a href="/winter-tires.html">Winter Tires</a> &middot;
    <a href="/tpms-service.html">TPMS Service</a> &middot;
    <a href="/seasonal-changeover.html">Seasonal Changeover</a>
  </div>
</footer>

</body>
</html>
`;
}

// ─────────────────────────────────────────────────────────────────────────
// SITEMAP UPDATE
// ─────────────────────────────────────────────────────────────────────────
function updateSitemap(generatedSlugs) {
  const today = new Date().toISOString().slice(0, 10);
  let current = '';
  try { current = fs.readFileSync(SITEMAP_PATH, 'utf8'); }
  catch (e) { current = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n`; }

  // Remove any prior <url> blocks for /tires/*.html (so we don't duplicate)
  let cleaned = current.replace(/\s*<url>\s*<loc>https:\/\/pctires\.ca\/tires\/[^<]+\.html<\/loc>[\s\S]*?<\/url>/g, '');

  // Build new entries
  const newEntries = generatedSlugs.map(slug => `
  <url>
    <loc>${SITE_ORIGIN}/tires/${slug}.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('');

  // Insert before </urlset>
  const out = cleaned.replace('</urlset>', `${newEntries}\n</urlset>`);
  fs.writeFileSync(SITEMAP_PATH, out, 'utf8');
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('PC Tires — landing page generator');
  console.log('=================================');
  console.log(`Output dir: ${OUTPUT_DIR}`);
  console.log(`Sitemap:    ${SITEMAP_PATH}`);
  console.log(`Sizes to generate: ${POPULAR_SIZES.length}`);
  console.log('');

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const generatedSlugs = [];
  let totalTires = 0;
  let failedSizes = [];

  for (const [size, vehicleHints] of POPULAR_SIZES) {
    process.stdout.write(`Generating ${size.padEnd(14)} ... `);
    try {
      // Fetch products and inventory in parallel
      const [prodRes, invRes] = await Promise.all([
        tdgFetch('search', { tireSizes: [size] }),
        tdgFetch('inventory', { tireSizes: [size] }),
      ]);
      const products = extractData(prodRes).filter(p => p.type === 'Tire' || p.type === 'tire');
      const invMap = {};
      extractData(invRes).forEach(i => { if (i?.itemNumber) invMap[i.itemNumber] = i; });
      const tires = products.map(p => normaliseTire(p, invMap[p.itemNumber]));

      if (tires.length === 0) {
        console.log('SKIP (no tires found)');
        continue;
      }

      const html = renderSizePage(size, tires, vehicleHints);
      const slug = sizeToSlug(size);
      const filePath = path.join(OUTPUT_DIR, `${slug}.html`);
      fs.writeFileSync(filePath, html, 'utf8');
      generatedSlugs.push(slug);
      totalTires += tires.length;
      console.log(`OK (${tires.length} tires, ${(html.length / 1024).toFixed(1)} KB)`);

      // Small delay to be polite to TDG
      await new Promise(r => setTimeout(r, 250));
    } catch (e) {
      console.log(`FAIL — ${e.message}`);
      failedSizes.push(size);
    }
  }

  // Update sitemap
  console.log('');
  if (generatedSlugs.length > 0) {
    updateSitemap(generatedSlugs);
    console.log(`Sitemap updated with ${generatedSlugs.length} entries.`);
  }

  console.log('');
  console.log('=================================');
  console.log(`Generated: ${generatedSlugs.length} pages, ${totalTires} total tire listings`);
  if (failedSizes.length > 0) {
    console.log(`Failed:    ${failedSizes.length} sizes (${failedSizes.join(', ')})`);
  }
  console.log('');
  console.log('Next steps:');
  console.log('  1. Open ./tires/ in your browser to spot-check a few pages');
  console.log('  2. Submit updated sitemap.xml in Google Search Console after deploy');
  console.log('  3. Push with .\\push-pctires.ps1');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
