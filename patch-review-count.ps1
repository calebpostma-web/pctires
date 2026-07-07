# patch-review-count.ps1 -- update hardcoded Google review count (2026-07-06)
#
# Site said "2 Google reviews"; real GBP count is 11 at 5.0.
# One-line text change in index.html. Assertion math pre-simulated in Python
# against the current file: old string appears exactly once, line count
# unchanged after replace.
#
# Run:
#   cd C:\Users\Caleb\Documents\Claude\Projects\PCtires
#   .\patch-review-count.ps1
# Then deploy:
#   .\push-pctires.ps1
# NOTE: bump this text again as reviews grow (it is a manual count).

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\Caleb\Documents\Claude\Projects\PCtires'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

$f = 'index.html'
$raw = [System.IO.File]::ReadAllText((Resolve-Path $f).Path)

$old = '2 Google reviews &middot; read them on Google &rarr;'
$new = '11 Google reviews &middot; 5.0 rated &middot; read them on Google &rarr;'

$count = ([regex]::Matches($raw, [regex]::Escape($old))).Count
if ($count -ne 1) {
  Write-Host "FAIL: review-count line found $count times (expected 1) -- NOT patching" -ForegroundColor Red
  if ($raw.Contains($new)) { Write-Host 'NOTE: file already contains the updated text -- nothing to do.' -ForegroundColor Yellow }
  exit 1
}

Copy-Item $f "$f.bak-reviewcount-$stamp"
$raw = $raw.Replace($old, $new)
[System.IO.File]::WriteAllText((Resolve-Path $f).Path, $raw)

$chk = [System.IO.File]::ReadAllText((Resolve-Path $f).Path)
if ((([regex]::Matches($chk, [regex]::Escape($new))).Count -eq 1) -and (-not $chk.Contains($old))) {
  Write-Host "OK: review count updated to 11 (backup $f.bak-reviewcount-$stamp)" -ForegroundColor Green
  Write-Host 'ALL CHECKS PASSED. Deploy with: .\push-pctires.ps1' -ForegroundColor Green
} else {
  Write-Host 'FAIL: verification -- RESTORING BACKUP' -ForegroundColor Red
  Copy-Item "$f.bak-reviewcount-$stamp" $f -Force
  exit 1
}
