# patch-returns-sticker.ps1 -- add sticker-intact return condition (2026-07-06)
#
# Distributor will not take back tires without the manufacturer sticker on the
# tread. Returns page implied "resaleable condition" but never said it
# explicitly. This adds one bullet to the 30-Day Return Window conditions.
# Assertion math pre-simulated in Python: anchor appears exactly once,
# line delta +1.
#
# Run:
#   cd C:\Users\Caleb\Documents\Claude\Projects\PCtires
#   .\patch-returns-sticker.ps1
# Then deploy:
#   .\push-pctires.ps1

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\Caleb\Documents\Claude\Projects\PCtires'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

$f = 'returns.html'
$raw = [System.IO.File]::ReadAllText((Resolve-Path $f).Path)
$nl = "`n"; if ($raw.Contains("`r`n")) { $nl = "`r`n" }

$anchor = @'
  <li>Original packaging is intact (where applicable)</li>
'@
$anchor = $anchor.Trim("`r", "`n")

$newLi = @'
  <li>The <strong>manufacturer&rsquo;s sticker/label is still on the tread</strong> &mdash; tires with the sticker removed or peeled cannot be returned, no exceptions (our distributor will not take them back)</li>
'@
$newLi = $newLi.Trim("`r", "`n")

$count = ([regex]::Matches($raw, [regex]::Escape($anchor))).Count
if ($count -ne 1) {
  Write-Host "FAIL: anchor found $count times (expected 1) -- NOT patching" -ForegroundColor Red
  if ($raw.Contains('sticker/label is still on the tread')) { Write-Host 'NOTE: sticker condition already present.' -ForegroundColor Yellow }
  exit 1
}

Copy-Item $f "$f.bak-sticker-$stamp"
$raw = $raw.Replace($anchor, $anchor + $nl + $newLi)
[System.IO.File]::WriteAllText((Resolve-Path $f).Path, $raw)

$chk = [System.IO.File]::ReadAllText((Resolve-Path $f).Path)
if (([regex]::Matches($chk, [regex]::Escape($newLi))).Count -eq 1) {
  Write-Host "OK: sticker condition added to returns.html (backup $f.bak-sticker-$stamp)" -ForegroundColor Green
  Write-Host 'ALL CHECKS PASSED. Deploy with: .\push-pctires.ps1' -ForegroundColor Green
} else {
  Write-Host 'FAIL: verification -- RESTORING BACKUP' -ForegroundColor Red
  Copy-Item "$f.bak-sticker-$stamp" $f -Force
  exit 1
}
