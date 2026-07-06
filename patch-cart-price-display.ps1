# patch-cart-price-display.ps1 -- cart item row shows product price only (2026-07-05)
#
# WHY: Cart item row showed (tire price + install) x qty ($1089) while the
# summary below ALSO listed Installation ($100) as its own line. Install was
# only charged once (totals were always correct) but it READ like a double
# charge. Item row now shows product-only total, which visibly matches the
# Subtotal line; the Installation summary line accounts for install.
#
# Run:
#   cd C:\Users\Caleb\Documents\Claude\Projects\PCtires
#   .\patch-cart-price-display.ps1
# Then deploy:
#   .\push-pctires.ps1

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\Caleb\Documents\Claude\Projects\PCtires'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

$f = 'index.html'
$raw = [System.IO.File]::ReadAllText((Resolve-Path $f).Path)
$linesBefore = ([System.IO.File]::ReadAllLines((Resolve-Path $f).Path)).Count

$old = @'
        <div class="ci-price">$${((item.price + (item.install ? installPriceEach(item) : 0)) * item.qty).toFixed(2)}</div>
'@
$old = $old.Trim("`r", "`n")

$new = @'
        <div class="ci-price">$${(item.price * item.qty).toFixed(2)}</div>
'@
$new = $new.Trim("`r", "`n")

$count = ([regex]::Matches($raw, [regex]::Escape($old))).Count
if ($count -ne 1) {
  Write-Host "FAIL: cart price line found $count times (expected 1) -- NOT patching" -ForegroundColor Red
  exit 1
}

Copy-Item $f "$f.bak-cartprice-$stamp"
$raw = $raw.Replace($old, $new)
[System.IO.File]::WriteAllText((Resolve-Path $f).Path, $raw)

$linesAfter = ([System.IO.File]::ReadAllLines((Resolve-Path $f).Path)).Count
$chk = [System.IO.File]::ReadAllText((Resolve-Path $f).Path)
$okNew = $chk.Contains($new)
$okOldGone = -not $chk.Contains($old)

if (($linesAfter -ne $linesBefore) -or (-not $okNew) -or (-not $okOldGone)) {
  Write-Host "FAIL: verification (lines $linesBefore -> $linesAfter should be equal, newCode: $okNew, oldGone: $okOldGone) -- RESTORING BACKUP" -ForegroundColor Red
  Copy-Item "$f.bak-cartprice-$stamp" $f -Force
  exit 1
}

Write-Host "OK: cart item row now shows product-only price (backup $f.bak-cartprice-$stamp)" -ForegroundColor Green
Write-Host 'ALL CHECKS PASSED. Deploy with: .\push-pctires.ps1' -ForegroundColor Green
