# ============================================================
#  PC TIRES - Reviews + Family Block Patch (index.html)
#  Restores the reviews section (removed 2026-05-22 when the fake
#  ones were stripped) with your 2 REAL Google reviews, and adds a
#  family-run "next generation" trust block (no photo yet -- a
#  placeholder is left for a shot of the crew).
#  Reuses the existing dormant buildReviews() + .review-card styles.
#  Reviews shown with first names only (Paul leads; Andrea second).
#
#  HOW TO RUN:
#    1. This file lives in your pctires repo folder (same as index.html)
#    2. In PowerShell:  .\patch-reviews-family.ps1
#    3. If it says SUCCESS, deploy:  .\push-pctires.ps1
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

$h = Read-Text $indexPath
$hCRLF = $h.Contains($CRLF)
$h = $h.Replace($CRLF, $LF)

if ($h.Contains('id="reviewsGrid"')) {
  Write-Host "ALREADY PATCHED: reviews section already present. No changes made." -ForegroundColor Yellow
  exit 0
}

# ---------- 1) inject the reviews + family section after the restore-note comment ----------
$noteAnchor = 'to the DOMContentLoaded listener. -->'
$section = @'
to the DOMContentLoaded listener. -->

<!-- REVIEWS + FAMILY (restored 2026-06-10) -->
<section id="reviews" style="padding:64px 40px;background:var(--black);border-top:1px solid var(--border)">
  <div style="max-width:1100px;margin:0 auto">
    <div class="reviews-header">
      <div>
        <div class="eyebrow">What customers say</div>
        <h2 class="section-title">Reviews</h2>
      </div>
      <div style="text-align:right">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:32px;font-weight:800;color:var(--yellow);line-height:1">5.0 <span style="font-size:20px">&#9733;&#9733;&#9733;&#9733;&#9733;</span></div>
        <a href="https://www.google.com/search?q=PC+Tires+Pain+Court" target="_blank" rel="noopener" style="font-size:13px;color:var(--muted);text-decoration:none">2 Google reviews &middot; read them on Google &rarr;</a>
      </div>
    </div>
    <div class="reviews-grid" id="reviewsGrid"></div>
    <div style="display:flex;gap:16px;align-items:flex-start;background:var(--card);border:1px solid var(--border);border-left:3px solid var(--yellow);border-radius:4px;padding:20px 22px;margin-top:24px;flex-wrap:wrap">
      <div style="flex:0 0 78px;width:78px;height:78px;border-radius:6px;background:var(--raised);border:1px dashed var(--mid);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:10px;text-align:center;line-height:1.3;padding:6px">photo of the crew coming soon</div>
      <div style="flex:1;min-width:220px">
        <h3 style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:800;color:var(--white);margin-bottom:6px">A family-run Chatham-Kent shop</h3>
        <p style="font-size:14px;color:var(--light);line-height:1.65;margin:0">PC Tires is a family shop in Pain Court &mdash; owned by the Postma family, with the next generation doing the hands-on work. The young crew shows up, hustles, and gets you back on the road. Call and you&rsquo;ll reach a real local who&rsquo;ll sort your size and price fast.</p>
      </div>
    </div>
  </div>
  <script>window.addEventListener('load',function(){if(typeof buildReviews==='function'){try{buildReviews();}catch(e){}}});</script>
</section>
'@
$h = Apply $h $noteAnchor $section 1 'reviews-section'

# ---------- 2) populate the REVIEWS array with the 2 real reviews ----------
$h = Apply $h 'const REVIEWS = [];  // populated when real GBP reviews are collected' @'
const REVIEWS = [
  { rating:5, date:'4 days ago',  text:"These young fellas really nailed it. No hesitation on such short notice, and the price was very good. Thanks guys, much appreciated.", name:'Paul',   initials:'P', avatar:'#19a957' },
  { rating:5, date:'4 weeks ago', text:"I love my new rims and tires! Ordering through their website was easy.", name:'Andrea', initials:'A', avatar:'#f5c518' },
];
'@ 1 'reviews-array'

# ---------- verify ----------
$ok = $true
if (([regex]::Matches($h, [regex]::Escape('id="reviewsGrid"'))).Count -ne 1) { Write-Host "VERIFY FAIL: reviewsGrid not exactly once" -ForegroundColor Red; $ok = $false }
if (([regex]::Matches($h, [regex]::Escape('id="reviews"'))).Count -ne 1)      { Write-Host "VERIFY FAIL: id=reviews not exactly once" -ForegroundColor Red; $ok = $false }
if (-not $h.Contains("name:'Paul'"))   { Write-Host "VERIFY FAIL: Paul review missing" -ForegroundColor Red; $ok = $false }
if (-not $h.Contains("name:'Andrea'")) { Write-Host "VERIFY FAIL: Andrea review missing" -ForegroundColor Red; $ok = $false }
if (-not $ok) { Write-Host "No files changed." -ForegroundColor Red; exit 1 }

$backup = "$indexPath.$stamp.bak"
Copy-Item $indexPath $backup -Force
if ($hCRLF) { $h = $h.Replace($LF, $CRLF) }
Write-Text $indexPath $h

Write-Host ""
Write-Host "SUCCESS - reviews + family block restored." -ForegroundColor Green
Write-Host "Backup saved: $backup" -ForegroundColor DarkGray
Write-Host ""
Write-Host "NEXT:" -ForegroundColor Cyan
Write-Host "  1. Deploy:  .\push-pctires.ps1"
Write-Host "  2. Check the new Reviews section on pctires.ca (after the Tire Guide)."
Write-Host "  3. Drop a photo of the crew into the placeholder when you have one."
