# patch-install-page.ps1
# Revamps tire-installation.html: bring-your-own / Marketplace hero + band,
# tiered pricing ($25/$30 bought-from-us, $30/$35 bring-your-own), 'we don't sell used' messaging.
# Full-page update (big diff is normal). Backs up the old page first.
$ErrorActionPreference='Stop'
$ScriptDir=Split-Path -Parent $MyInvocation.MyCommand.Path
$file=Join-Path $ScriptDir 'tire-installation.html'
if(-not(Test-Path $file)){Write-Host 'ERROR: tire-installation.html not found next to this script.' -ForegroundColor Red;exit 1}
$enc=New-Object System.Text.UTF8Encoding($false)
$old=[System.IO.File]::ReadAllText($file)
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$backup="$file.bak-installpage-$stamp"
[System.IO.File]::WriteAllText($backup,$old,$enc)
Write-Host "Backup written: $backup"
$new=@'
<!DOCTYPE html>
<html lang="en-CA">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Tire Installation Chatham-Kent &#8212; We Install Tires You Bought | PC Tires</title>
<meta name="description" content="We install tires you bought anywhere &#8212; online, Marketplace, or a used set. Mount, balance, TPMS reset & disposal from $30/tire in Chatham-Kent ($25/tire on tires bought from us). We don&#8217;t sell used tires. Call 519-397-4686.">
<meta name="keywords" content="tire installation Chatham-Kent, tire mounting Chatham, mount and balance Chatham-Kent, tire shop Chatham, TPMS reset Chatham, Pain Court tire installation">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://pctires.ca/tire-installation.html">

<meta property="og:type" content="website">
<meta property="og:url" content="https://pctires.ca/tire-installation.html">
<meta property="og:title" content="We Install Tires You Bought &#8212; Tire Installation Chatham-Kent | PC Tires">
<meta property="og:description" content="Bought tires online or off Marketplace? We mount, balance, reset TPMS & dispose old tires from $30/tire in Chatham-Kent. We don&#8217;t sell used tires.">
<meta property="og:image" content="https://pctires.ca/favicon-192.png">
<meta property="og:locale" content="en_CA">
<meta property="og:site_name" content="PC Tires">

<meta name="geo.region" content="CA-ON">
<meta name="geo.placename" content="Pain Court, Chatham-Kent, Ontario">
<meta name="geo.position" content="42.4187;-82.2776">

<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" sizes="192x192" href="/favicon-192.png">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;700;800;900&family=Barlow:wght@300;400;500;600&display=swap" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;700;800;900&family=Barlow:wght@300;400;500;600&display=swap"></noscript>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": "https://pctires.ca/tire-installation.html#service",
  "name": "Tire Installation",
  "serviceType": "Tire mounting, balancing, TPMS reset, and disposal",
  "description": "Tire installation including mounting, computer balancing, TPMS sensor reset, and disposal of old tires. From $25 per tire on tires bought from PC Tires; from $30 per tire to install tires you bought elsewhere.",
  "provider": {
    "@type": "AutoPartsStore",
    "@id": "https://pctires.ca/#business",
    "name": "PC Tires",
    "telephone": "+1-519-397-4686",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "7144 Grande River Line",
      "addressLocality": "Pain Court",
      "addressRegion": "ON",
      "postalCode": "N0P 1Z0",
      "addressCountry": "CA"
    }
  },
  "areaServed": [
    {"@type": "City", "name": "Chatham"},
    {"@type": "City", "name": "Chatham-Kent"},
    {"@type": "City", "name": "Wallaceburg"},
    {"@type": "City", "name": "Tilbury"},
    {"@type": "City", "name": "Blenheim"},
    {"@type": "City", "name": "Ridgetown"},
    {"@type": "City", "name": "Dresden"},
    {"@type": "City", "name": "Pain Court"}
  ],
  "offers": {
    "@type": "Offer",
    "price": "25.00",
    "priceCurrency": "CAD",
    "priceSpecification": {
      "@type": "UnitPriceSpecification",
      "price": "25.00",
      "priceCurrency": "CAD",
      "unitText": "per tire"
    }
  }
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://pctires.ca/"},
    {"@type": "ListItem", "position": 2, "name": "Services", "item": "https://pctires.ca/#services"},
    {"@type": "ListItem", "position": 3, "name": "Tire Installation"}
  ]
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What's included with tire installation?",
      "acceptedAnswer": {"@type": "Answer", "text": "Mount, computer balance, TPMS sensor reset, and disposal of your old tires. No environmental fees. No hidden charges. The price you see is what you pay."}
    },
    {
      "@type": "Question",
      "name": "Can I bring my own tires for installation?",
      "acceptedAnswer": {"@type": "Answer", "text": "Yes - that is a big part of what we do. Bought tires online, off Marketplace, or found a used set? We install them. Customer-supplied installation is $30 per tire ($35 for 20-inch and up), including mount, balance, TPMS reset, and disposal of old tires. We do not sell used tires ourselves. All tires are subject to inspection - we may refuse tires with sidewall damage, dry rot, or tread under 3/32 inch."}
    },
    {
      "@type": "Question",
      "name": "How long does tire installation take?",
      "acceptedAnswer": {"@type": "Answer", "text": "Typically 45 to 60 minutes for a standard 4-tire install on a passenger car or SUV. Trucks with 20-inch or larger wheels may take slightly longer. We block enough time in your appointment so it never feels rushed."}
    },
    {
      "@type": "Question",
      "name": "Do I need an appointment for tire installation?",
      "acceptedAnswer": {"@type": "Answer", "text": "Yes. We operate by appointment to guarantee availability and proper installation time. Book online at pctires.ca or call 519-397-4686. Walk-ins accommodated when possible but same-day service is not guaranteed."}
    },
    {
      "@type": "Question",
      "name": "What if my TPMS light comes on after installation?",
      "acceptedAnswer": {"@type": "Answer", "text": "Most TPMS systems need a drive cycle of 10 to 15 kilometres to fully relearn after sensor handling. If the light stays on past that, bring it back. We diagnose at no charge for the first follow-up. If a sensor is defective, replacement is $60 per sensor."}
    },
    {
      "@type": "Question",
      "name": "Do you do wheel alignment?",
      "acceptedAnswer": {"@type": "Answer", "text": "Not currently. We focus on tire and wheel service. We can recommend trusted alignment shops in Chatham-Kent if you need one."}
    }
  ]
}
</script>

<style>
:root{
  --black:#080808; --dark:#111; --card:#161616; --raised:#1d1d1d;
  --border:#252525; --mid:#404040; --muted:#686868; --light:#a0a0a0; --white:#f0ece0;
  --yellow:#f5c518; --yellow-dim:rgba(245,197,24,0.12); --yellow-dark:#d4a800;
  --green:#22c55e;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--black);color:var(--white);font-family:'Barlow',sans-serif;font-size:16px;line-height:1.7;min-height:100vh}
nav{display:flex;align-items:center;justify-content:space-between;padding:18px 32px;background:var(--dark);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10}
.logo{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;letter-spacing:2px;color:var(--white);text-decoration:none}
.logo .pc{color:var(--yellow)}
.nav-cta{display:flex;gap:12px;align-items:center}
.phone-link{font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--yellow);text-decoration:none;font-weight:700}
.btn{background:var(--yellow);color:var(--black);border:none;padding:10px 18px;border-radius:2px;font-family:'Barlow',sans-serif;font-size:13px;font-weight:700;text-decoration:none;display:inline-block;transition:all .2s;text-transform:uppercase;letter-spacing:1px}
.btn:hover{background:var(--yellow-dark)}
.btn.ghost{background:transparent;color:var(--white);border:1px solid var(--border)}
.btn.ghost:hover{border-color:var(--yellow);color:var(--yellow)}

.hero{padding:80px 24px 60px;text-align:center;background:linear-gradient(180deg,var(--dark) 0%,var(--black) 100%);border-bottom:1px solid var(--border)}
.hero-inner{max-width:900px;margin:0 auto}
.eyebrow{font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:4px;text-transform:uppercase;color:var(--yellow);margin-bottom:12px}
h1{font-family:'Barlow Condensed',sans-serif;font-size:clamp(36px,6vw,64px);font-weight:900;line-height:1.05;letter-spacing:1px;text-transform:uppercase;margin-bottom:18px}
.hero-sub{font-size:18px;color:var(--light);max-width:680px;margin:0 auto 30px;line-height:1.6}
.hero-cta{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.hero-cta .btn{padding:14px 28px;font-size:14px}

.wrap{max-width:980px;margin:0 auto;padding:60px 24px}
section.block{margin-bottom:60px}
h2{font-family:'Barlow Condensed',sans-serif;font-size:clamp(26px,4vw,36px);font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:18px;color:var(--white)}
h2 .y{color:var(--yellow)}
h3{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:24px 0 10px;color:var(--white)}
p{margin-bottom:14px;color:var(--light)}
strong{color:var(--white)}
.lead{font-size:18px;color:var(--light)}

.feature-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:24px}
.feature{background:var(--card);border:1px solid var(--border);padding:24px;border-left:3px solid var(--yellow)}
.feature-icon{font-size:24px;margin-bottom:10px}
.feature-title{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;color:var(--white)}
.feature-desc{font-size:14px;color:var(--light);line-height:1.6}

.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:24px}
.step{background:var(--card);border:1px solid var(--border);padding:20px;position:relative}
.step-num{font-family:'Barlow Condensed',sans-serif;font-size:48px;font-weight:900;color:var(--border);line-height:1;margin-bottom:8px}
.step-title{font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;color:var(--white)}
.step-desc{font-size:13px;color:var(--muted);line-height:1.6}

.price-table{background:var(--card);border:1px solid var(--border);border-radius:2px;overflow:hidden;margin:20px 0}
.price-row{display:flex;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--border);font-size:15px}
.price-row:last-child{border-bottom:none}
.price-row .item{color:var(--light)}
.price-row .price{color:var(--yellow);font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:18px}

.callout{background:var(--yellow-dim);border-left:3px solid var(--yellow);padding:18px 22px;margin:24px 0;font-size:15px;color:var(--light)}
.callout strong{color:var(--yellow)}

.faq{margin-top:24px}
.faq-item{background:var(--card);border:1px solid var(--border);margin-bottom:8px;padding:18px 22px}
.faq-q{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--yellow);margin-bottom:10px}
.faq-a{font-size:15px;color:var(--light);line-height:1.7}

.areas{background:var(--card);border:1px solid var(--border);padding:24px;margin-top:24px}
.areas-list{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.area-tag{background:var(--raised);border:1px solid var(--border);padding:5px 12px;font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--light);border-radius:2px}

.cta-final{background:var(--yellow-dim);border-top:3px solid var(--yellow);padding:48px 24px;text-align:center;margin-top:40px}
.cta-final h2{margin-bottom:14px;color:var(--white)}
.cta-final p{font-size:17px;margin-bottom:24px}
.cta-final .btn{padding:14px 28px;font-size:14px;margin:0 6px 8px}

footer{background:var(--dark);border-top:1px solid var(--border);padding:32px 24px;text-align:center;color:var(--muted);font-size:13px}
footer a{color:var(--muted);text-decoration:none}
footer a:hover{color:var(--yellow)}
.footer-links{margin-top:8px}
.footer-links a{margin:0 6px}
</style>
</head>
<body>

<nav>
  <a class="logo" href="/"><span class="pc">PC</span> TIRES</a>
  <div class="nav-cta">
    <a class="phone-link" href="tel:5193974686">519-397-4686</a>
    <a class="btn" href="/#catalog">Shop Tires</a>
  </div>
</nav>

<section class="hero">
  <div class="hero-inner">
    <h1>Have Your Own Tires?<br><span style="color:var(--yellow)">We&#8217;ll Put Them On.</span></h1>
    <p class="hero-sub">Mount, balance, TPMS reset &amp; old-tire disposal &#8212; from $30/tire to install tires you bought. Chatham-Kent.</p>
    <div class="hero-cta">
      <a class="btn" href="/#services">Book Online</a>
      <a class="btn ghost" href="tel:5193974686">Call 519-397-4686</a>
    </div>
  </div>
</section>

<section style="background:var(--card);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:22px 24px;text-align:center">
  <p style="max-width:760px;margin:0 auto;font-size:15px;color:var(--light);line-height:1.6">Bought them online, off Marketplace, or found a used set? Bring them in &#8212; we install tires from anywhere. <strong style="color:var(--yellow)">We don&#8217;t sell used tires ourselves.</strong></p>
</section>

<div class="wrap">

<section class="block">
<h2>What Every <span class="y">Install</span> Includes</h2>
<p class="lead">No surprise charges at the counter. Every install includes the full job done right.</p>
<div class="feature-grid">
  <div class="feature"><div class="feature-icon">&#128295;</div><div class="feature-title">Mount &amp; Dismount</div><div class="feature-desc">Professional bead-breaking, tire removal, and mounting on alloy or steel wheels. Careful with finished surfaces.</div></div>
  <div class="feature"><div class="feature-icon">&#9878;&#65039;</div><div class="feature-title">Computer Balancing</div><div class="feature-desc">Each wheel balanced on our CAE-3446WB balancer. Smooth ride from the first kilometre.</div></div>
  <div class="feature"><div class="feature-icon">&#128225;</div><div class="feature-title">TPMS Sensor Reset</div><div class="feature-desc">Sensor relearn included on every install. No dash warning lights when you drive away.</div></div>
  <div class="feature"><div class="feature-icon">&#128297;</div><div class="feature-title">Valve Stem Service</div><div class="feature-desc">New rubber valve stems on most installs. TPMS valve kit available if your sensor needs service ($40).</div></div>
  <div class="feature"><div class="feature-icon">&#128207;</div><div class="feature-title">Torque to Spec</div><div class="feature-desc">Every lug torqued to your manufacturer's specification with a calibrated torque wrench. Final check included.</div></div>
  <div class="feature"><div class="feature-icon">&#9851;&#65039;</div><div class="feature-title">Old Tire Disposal</div><div class="feature-desc">Environmentally compliant disposal of your old tires. No environmental fee charged separately &#8212; it's already in the price.</div></div>
</div>
</section>

<section class="block">
<h2>How It Works</h2>
<p class="lead">From online order to driving away &#8212; usually under two hours.</p>
<div class="steps">
  <div class="step"><div class="step-num">01</div><div class="step-title">Book Online</div><div class="step-desc">Pick your date and time slot on the main site. No phone calls required.</div></div>
  <div class="step"><div class="step-num">02</div><div class="step-title">Tires Arrive</div><div class="step-desc">Order tires through us &#8212; they ship to our shop directly. Or bring your own.</div></div>
  <div class="step"><div class="step-num">03</div><div class="step-title">Drop Off</div><div class="step-desc">Arrive at your appointment time. We get to work immediately.</div></div>
  <div class="step"><div class="step-num">04</div><div class="step-title">Drive Away</div><div class="step-desc">Usually 45&#8211;60 minutes. Lug torque re-check welcome 50&#8211;100 km later, free.</div></div>
</div>
</section>

<section class="block">
<h2>Transparent <span class="y">Pricing</span></h2>
<div class="price-table">
  <div class="price-row"><span class="item">Tires bought from PC Tires &#8212; installed</span><span class="price">$25 / tire</span></div>
  <div class="price-row"><span class="item">Bought from PC Tires &#8212; 20" and up</span><span class="price">$30 / tire</span></div>
  <div class="price-row"><span class="item">Bring your own tires (bought anywhere)</span><span class="price">$30 / tire</span></div>
  <div class="price-row"><span class="item">Bring your own &#8212; 20" and up</span><span class="price">$35 / tire</span></div>
  <div class="price-row"><span class="item">Seasonal changeover &#8212; pre-mounted set</span><span class="price">$20 / tire</span></div>
  <div class="price-row"><span class="item">TPMS valve service kit (if needed)</span><span class="price">+$40 flat</span></div>
  <div class="price-row"><span class="item">TPMS sensor replacement (if defective)</span><span class="price">+$60 / sensor</span></div>
  <div class="price-row"><span class="item">Lug torque re-check (50&#8211;100 km after install)</span><span class="price">Free</span></div>
</div>
<div class="callout"><strong>HST extra.</strong> Run-flat or oversized (24"+) tires may be quoted separately depending on condition. We'll always confirm before any work starts.</div>
</section>

<section class="block">
<h2>Why <span class="y">PC Tires</span></h2>
<div class="feature-grid">
  <div class="feature"><div class="feature-icon">&#10003;</div><div class="feature-title">Certified Technicians</div><div class="feature-desc">Trained, experienced techs. Not subcontracted out to a third party. Every install touched by someone who knows what they're doing.</div></div>
  <div class="feature"><div class="feature-icon">&#10003;</div><div class="feature-title">Online Booking</div><div class="feature-desc">Pick your time slot in real-time. No phone tag, no "we'll call you back." Just confirm and show up.</div></div>
  <div class="feature"><div class="feature-icon">&#10003;</div><div class="feature-title">All-In Pricing</div><div class="feature-desc">No environmental fee, no shop supply fee, no disposal surcharge. The price we quote is the price you pay.</div></div>
  <div class="feature"><div class="feature-icon">&#10003;</div><div class="feature-title">Buy + Install in One Stop</div><div class="feature-desc">Order tires online, we ship them to our shop, you book installation in the same checkout. One stop, one price.</div></div>
</div>
</section>

<section class="block">
<h2>Frequently Asked Questions</h2>
<div class="faq">
  <div class="faq-item">
    <div class="faq-q">What&#8217;s included with installation?</div>
    <div class="faq-a">Mount, computer balance, TPMS sensor reset, and disposal of your old tires. No environmental fees. No hidden charges. The price you see is what you pay.</div>
  </div>
  <div class="faq-item">
    <div class="faq-q">Can I bring my own tires for installation?</div>
    <div class="faq-a">Yes &#8212; that&#8217;s a big part of what we do. Bought tires online, off Marketplace, or found a used set? Bring them in. Customer-supplied installation is $30 per tire ($35 for 20" and up), including mount, balance, TPMS reset, and old-tire disposal. We don&#8217;t sell used tires ourselves. All tires are subject to inspection &#8212; we may refuse tires with sidewall damage, dry rot, or tread under 3/32".</div>
  </div>
  <div class="faq-item">
    <div class="faq-q">How long does tire installation take?</div>
    <div class="faq-a">Typically 45&#8211;60 minutes for a standard 4-tire install on a passenger car or SUV. Trucks with 20"+ wheels may take slightly longer. We block enough time in your appointment so it never feels rushed.</div>
  </div>
  <div class="faq-item">
    <div class="faq-q">Do I need an appointment?</div>
    <div class="faq-a">Yes. We operate by appointment to guarantee availability and proper installation time. Book online at pctires.ca or call 519-397-4686. Walk-ins accommodated when possible but same-day service is not guaranteed.</div>
  </div>
  <div class="faq-item">
    <div class="faq-q">What if my TPMS light comes on after installation?</div>
    <div class="faq-a">Most TPMS systems need a drive cycle of 10&#8211;15 km to fully relearn after sensor handling. If the light stays on past that, bring it back &#8212; we diagnose at no charge for the first follow-up. If a sensor is defective, replacement is $60/sensor.</div>
  </div>
  <div class="faq-item">
    <div class="faq-q">Do you do wheel alignment?</div>
    <div class="faq-a">Not currently. We focus on tire and wheel service. We can recommend trusted alignment shops in Chatham-Kent if you need one.</div>
  </div>
  <div class="faq-item">
    <div class="faq-q">Do you do wheel installation only (no tires)?</div>
    <div class="faq-a">Yes. Wheel-only mount is $30/wheel for steel, $40/wheel for alloy (more careful handling required). Includes balance and TPMS reset.</div>
  </div>
</div>
</section>

<section class="block">
<h2>Areas We Serve</h2>
<div class="areas">
  <p>PC Tires is based in Pain Court (just outside Chatham), serving customers throughout Chatham-Kent and surrounding communities. Our shop at <strong>7144 Grande River Line, Pain Court, ON</strong> is a short drive from downtown Chatham (15 minutes), Wallaceburg (20 minutes), and Tilbury (15 minutes).</p>
  <div class="areas-list">
    <span class="area-tag">Chatham</span>
    <span class="area-tag">Chatham-Kent</span>
    <span class="area-tag">Wallaceburg</span>
    <span class="area-tag">Tilbury</span>
    <span class="area-tag">Blenheim</span>
    <span class="area-tag">Ridgetown</span>
    <span class="area-tag">Dresden</span>
    <span class="area-tag">Pain Court</span>
    <span class="area-tag">Mitchell's Bay</span>
    <span class="area-tag">Erieau</span>
    <span class="area-tag">Bothwell</span>
    <span class="area-tag">Thamesville</span>
  </div>
</div>
</section>

</div>

<div class="cta-final">
  <h2>Ready to Book Your Installation?</h2>
  <p>Online booking is fastest. Or give us a call.</p>
  <a class="btn" href="/#services">Book Online</a>
  <a class="btn ghost" href="tel:5193974686">&#128222; 519-397-4686</a>
</div>

<footer>
  &#169; 2026 PC Tires (Postma Contracting Inc.) &#183; 7144 Grande River Line, Pain Court, ON
  <div class="footer-links">
    <a href="/">Home</a> &#183;
    <a href="/winter-tires.html">Winter Tires</a> &#183;
    <a href="/tpms-service.html">TPMS Service</a> &#183;
    <a href="/seasonal-changeover.html">Seasonal Changeover</a> &#183;
    <a href="/privacy.html">Privacy</a> &#183;
    <a href="/returns.html">Returns</a>
  </div>
</footer>

</body>
</html>

'@
[System.IO.File]::WriteAllText($file,$new,$enc)
$ok=$true
foreach($t in @('Have Your Own Tires?','Bring your own tires (bought anywhere)','$35 / tire','We don&#8217;t sell used tires ourselves.')){ if(-not $new.Contains($t)){ Write-Host "WARN token missing: $t" -ForegroundColor Yellow; $ok=$false } }
if($new.Contains('$25 Per Tire') -or $new.Contains('Tire Installation<br>')){ Write-Host 'WARN old hero still present' -ForegroundColor Yellow; $ok=$false }
if($ok){ Write-Host "" ; Write-Host "SUCCESS. tire-installation.html updated." -ForegroundColor Cyan }
Write-Host "Review locally, then deploy with:  .\push-pctires.ps1" -ForegroundColor Yellow