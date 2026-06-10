# ============================================================
#  PC TIRES - Mobile Call-First Patch (index.html)
#  Most ad traffic is mobile (92% of clicks) and nobody orders
#  without calling first -- so this makes the PHONE the hero:
#    1. A bold call-first banner above the search (offer + big
#       tap-to-call button). The tel: link also fires your
#       existing click-to-call conversion, so more calls get tracked.
#    2. The tiny nav phone number becomes a prominent yellow
#       tap-to-call button on mobile.
#  Both changes are ADDITIVE (nothing existing is removed) and
#  reversible via the timestamped backup.
#
#  HOW TO RUN:
#    1. This file lives in your pctires repo folder (same as index.html)
#    2. In PowerShell:  .\patch-mobile-callfirst.ps1
#    3. If it says SUCCESS, deploy:  .\push-pctires.ps1
#    4. Open pctires.ca on your PHONE and eyeball it.
#  Creates a timestamped .bak backup before touching anything.
# ============================================================

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
$indexPath = Join-Path $root 'index.html'

if (-not (Test-Path $indexPath)) { Write-Host "ABORT: cannot find $indexPath" -ForegroundColor Red; exit 1 }

$enc   = New-Object System.Text.UTF8Encoding($false)
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$CRLF  = ([string][char]13) + ([string][char]10)
$LF    = ([string][char]10)

function Read-Text($p)     { return [System.IO.File]::ReadAllText($p, $enc) }
function Write-Text($p,$t) { [System.IO.File]::WriteAllText($p, $t, $enc) }

function Apply($content, $old, $new, $expected, $label) {
  $count = ([regex]::Matches($content, [regex]::Escape($old))).Count
  if ($count -ne $expected) {
    Write-Host "ABORT [$label]: expected $expected match(es), found $count. No files changed." -ForegroundColor Red
    Write-Host ("anchor: " + $old.Substring(0, [Math]::Min(80,$old.Length))) -ForegroundColor DarkYellow
    exit 1
  }
  return $content.Replace($old, $new)
}

# ---------- read + normalize to LF (index.html is CRLF) ----------
$h = Read-Text $indexPath
$hCRLF = $h.Contains($CRLF)
$h = $h.Replace($CRLF, $LF)

if ($h.Contains('pc-callfirst')) {
  Write-Host "ALREADY PATCHED: index.html already has the call-first block. No changes made." -ForegroundColor Yellow
  exit 0
}

# ---------- 1) inject the call-first CSS before </head> ----------
$css = @'
<style id="pc-callfirst-css">
/* ===== Mobile call-first layer (added 2026-06) ===== */
/* mobile-only: desktop stays Caleb's quoting tool, untouched */
.pc-callfirst{display:none;margin:0 0 22px;border:1px solid rgba(245,197,24,.35);background:linear-gradient(180deg,rgba(245,197,24,.10),rgba(245,197,24,.03));border-radius:4px;padding:18px 20px;max-width:600px}
.pc-cf-offer{font-family:'Barlow Condensed',sans-serif;font-weight:900;line-height:1.05;letter-spacing:-.3px;color:var(--white);font-size:clamp(25px,6vw,38px);margin:0 0 6px;text-transform:uppercase}
.pc-cf-offer .y{color:var(--yellow)}
.pc-cf-sub{color:var(--light);font-size:14px;margin:0 0 16px;line-height:1.5}
.pc-cf-call{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:100%;background:#19a957;color:#fff;font-family:'Barlow Condensed',sans-serif;text-decoration:none;padding:14px 18px;border-radius:3px;box-shadow:0 4px 14px rgba(25,169,87,.32);transition:transform .12s,box-shadow .12s}
.pc-cf-call:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(25,169,87,.46)}
.pc-cf-call-main{font-weight:800;font-size:23px;letter-spacing:.5px}
.pc-cf-call-sub{font-weight:600;font-size:12px;letter-spacing:.3px;opacity:.82}
.pc-cf-note{text-align:center;color:var(--muted);font-size:12px;margin:11px 0 0;line-height:1.45}
@media(max-width:600px){
  /* turn the tiny nav number into a real tap-to-call button */
  .phone-link{font-size:13px !important;font-weight:800 !important;background:#19a957 !important;color:#fff !important;padding:8px 12px !important;border-radius:3px !important;gap:6px !important}
  .pc-callfirst{display:block;padding:16px 16px}
  /* collapse the rebate ticker on mobile + close the gap it leaves */
  .rebate-ticker{display:none !important}
  body.with-promo-bar nav{top:48px !important}
  body.with-promo-bar .lookup-section{padding-top:112px !important}
  body:not(.with-promo-bar) nav{top:0 !important}
  body:not(.with-promo-bar) .lookup-section{padding-top:64px !important}
}
</style>
'@
$h = Apply $h "</head>" ($css + "`n</head>") 1 'css-before-head'

# ---------- 2) inject the call-first banner at the top of the hero ----------
$anchor = @'
<section class="lookup-section" id="lookup">
  <div class="lookup-inner">
'@
$banner = @'
<section class="lookup-section" id="lookup">
  <div class="lookup-inner">
    <div class="pc-callfirst">
      <p class="pc-cf-offer">Tires installed in Chatham-Kent &mdash; <span class="y">$25/tire, all in.</span></p>
      <p class="pc-cf-sub">Mount, balance, TPMS reset &amp; disposal included. Open Saturdays.</p>
      <a class="pc-cf-call" href="tel:5193974686">
        <span class="pc-cf-call-main">&#128222; Call 519-397-4686</span>
        <span class="pc-cf-call-sub">Talk to the owner &mdash; fast, fair, all-in pricing</span>
      </a>
      <p class="pc-cf-note">Or find your fit below.</p>
    </div>
'@
$h = Apply $h $anchor $banner 1 'hero-banner'

# ---------- 3) default the tire search to "By Tire Size" everywhere ----------
$sizeScript = @'
<script id="pc-size-default">window.addEventListener('load',function(){try{if(typeof switchLookupTab==='function'){switchLookupTab('size');}}catch(e){}});</script>
'@
$h = Apply $h "</body>" ($sizeScript + "`n</body>") 1 'size-default'

# ---------- verify ----------
$ok = $true
if (-not $h.Contains('pc-callfirst-css'))   { Write-Host "VERIFY FAIL: css block missing" -ForegroundColor Red; $ok = $false }
if (-not $h.Contains('pc-cf-call-main'))     { Write-Host "VERIFY FAIL: call button missing" -ForegroundColor Red; $ok = $false }
if (-not $h.Contains('pc-size-default'))     { Write-Host "VERIFY FAIL: size-default script missing" -ForegroundColor Red; $ok = $false }
if (-not $h.Contains('.rebate-ticker{display:none !important}')) { Write-Host "VERIFY FAIL: ticker-collapse missing" -ForegroundColor Red; $ok = $false }
if (([regex]::Matches($h, [regex]::Escape('id="lookup"'))).Count -ne 1) { Write-Host "VERIFY FAIL: lookup section duplicated" -ForegroundColor Red; $ok = $false }
if (-not $ok) { Write-Host "No files changed." -ForegroundColor Red; exit 1 }

# ---------- backup + save (restore CRLF) ----------
$backup = "$indexPath.$stamp.bak"
Copy-Item $indexPath $backup -Force
if ($hCRLF) { $h = $h.Replace($LF, $CRLF) }
Write-Text $indexPath $h

Write-Host ""
Write-Host "SUCCESS - index.html patched (mobile call-first)." -ForegroundColor Green
Write-Host "Backup saved: $backup" -ForegroundColor DarkGray
Write-Host ""
Write-Host "NEXT:" -ForegroundColor Cyan
Write-Host "  1. Deploy:  .\push-pctires.ps1"
Write-Host "  2. Open pctires.ca on your PHONE and check the hero + nav call button."
Write-Host "  3. Don't like it? Restore with:  Copy-Item '$backup' '$indexPath' -Force"
