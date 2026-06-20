# patch-alslawncare.ps1
# Adds the ALSLAWNCARE partner code that auto-prices each tire so Caleb NETS
# $10/tire after Stripe (2.9% + HST) and the $5 OTS eco fee, at ANY tire cost.
# 1. Adds a new 'net_target' discount type to index.html
# 2. Adds the ALSLAWNCARE code to promo-codes.js
# Backs up both files first. Safe to read top-to-bottom before running.

$ErrorActionPreference = "Stop"

# Anchor every path to THIS script's folder, so it works no matter where it's run from.
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
Set-Location $root
[Environment]::CurrentDirectory = $root

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$utf8  = New-Object System.Text.UTF8Encoding($false)

$promoPath = Join-Path $root "promo-codes.js"
$idxPath   = Join-Path $root "index.html"

if (-not (Test-Path $promoPath)) { throw "Cannot find promo-codes.js in $root" }
if (-not (Test-Path $idxPath))   { throw "Cannot find index.html in $root" }

function Read-Text($p)     { return [System.IO.File]::ReadAllText($p) }
function Write-Text($p,$t) { [System.IO.File]::WriteAllText($p, $t, $utf8) }

# ---------------------------------------------------------------
# promo-codes.js
# ---------------------------------------------------------------
$promo = Read-Text $promoPath

if ($promo -match "ALSLAWNCARE") {
    Write-Host "SKIP: ALSLAWNCARE already present in promo-codes.js" -ForegroundColor Yellow
} else {
    $promoAnchor = "const PROMO_CODES = {"
    $n = ([regex]::Matches($promo, [regex]::Escape($promoAnchor))).Count
    if ($n -ne 1) { throw "promo-codes.js: expected 1 anchor, found $n. Aborting." }

    $promoInsert = @'
const PROMO_CODES = {

  // -- Al's Lawn Care partner pricing --
  // type 'net_target' = auto-prices each tire so you NET value$ after Stripe (2.9%+HST)
  // and the $5 OTS eco fee. Holds at any tire cost. Change value to retune your take-home.
  'ALSLAWNCARE': { type: 'net_target', value: 10, label: "Al's Lawn Care - Partner Pricing" },
'@

    Copy-Item $promoPath "$promoPath.bak-alslawncare-$stamp"
    $promo = $promo.Replace($promoAnchor, $promoInsert)
    Write-Text $promoPath $promo
    Write-Host "OK: ALSLAWNCARE added to promo-codes.js (backup made)" -ForegroundColor Green
}

# ---------------------------------------------------------------
# index.html  (add 'net_target' case to calculatePromoDiscount)
# ---------------------------------------------------------------
$idx = Read-Text $idxPath

if ($idx -match "case 'net_target'") {
    Write-Host "SKIP: net_target case already present in index.html" -ForegroundColor Yellow
} else {
    $idxAnchor = "    case 'markup': {"
    $m = ([regex]::Matches($idx, [regex]::Escape($idxAnchor))).Count
    if ($m -ne 1) { throw "index.html: expected 1 anchor, found $m. Aborting." }

    $idxInsert = @'
    case 'net_target': {
      // Auto-prices each tire so you net def.value AFTER Stripe and the $5 OTS fee.
      // Stripe charges 2.9% on the HST-inclusive charge, so R = 0.029 * 1.13.
      // markup = (target + OTS + R*cost) / (1 - R); price = cost + markup.
      // OTS eco fee applies to tires only. orig.price is your raw TDG cost.
      const R = 0.029 * 1.13;
      let savings = 0;
      for (const c of cartItems) {
        const pool = c.itemType === 'wheel' ? allWheels : allTires;
        const orig = pool.find(t => t.itemNumber === c.itemNumber);
        if (!orig) continue;
        const ots = c.itemType === 'wheel' ? 0 : 5;
        const markup = (def.value + ots + R * orig.price) / (1 - R);
        const newPrice = Math.round((orig.price + markup) * 100) / 100;
        if (c.price > newPrice) savings += (c.price - newPrice) * c.qty;
      }
      return { sub: Math.min(savings, sub), inst: 0 };
    }
    case 'markup': {
'@

    Copy-Item $idxPath "$idxPath.bak-alslawncare-$stamp"
    $idx = $idx.Replace($idxAnchor, $idxInsert)
    Write-Text $idxPath $idx
    Write-Host "OK: net_target case added to index.html (backup made)" -ForegroundColor Green
}

# ---------------------------------------------------------------
# Verify
# ---------------------------------------------------------------
Write-Host ""
Write-Host "--- Verification ---"
$promo2 = Read-Text $promoPath
$idx2   = Read-Text $idxPath

$ok = $true
if ($promo2 -match "ALSLAWNCARE")     { Write-Host "  promo-codes.js: ALSLAWNCARE present   [PASS]" -ForegroundColor Green } else { Write-Host "  promo-codes.js: MISSING  [FAIL]" -ForegroundColor Red; $ok=$false }
if ($idx2 -match "case 'net_target'") { Write-Host "  index.html: net_target case present   [PASS]" -ForegroundColor Green } else { Write-Host "  index.html: MISSING  [FAIL]" -ForegroundColor Red; $ok=$false }

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    & node --check $promoPath
    if ($LASTEXITCODE -eq 0) { Write-Host "  node --check promo-codes.js           [PASS]" -ForegroundColor Green } else { Write-Host "  node --check promo-codes.js           [FAIL]" -ForegroundColor Red; $ok=$false }
} else {
    Write-Host "  (node not found - skipped JS syntax check)" -ForegroundColor Yellow
}

Write-Host ""
if ($ok) {
    Write-Host "ALL CHECKS PASSED. Now deploy with:  .\push-pctires.ps1" -ForegroundColor Cyan
} else {
    Write-Host "SOMETHING FAILED - do NOT push. Restore from the .bak files in the folder." -ForegroundColor Red
}
