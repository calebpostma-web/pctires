# patch-kill-welcome10.ps1
# Removes the discontinued WELCOME10 promo from the live homepage (index.html)
# and the winter-tires blog (best-winter-tires-2026.html).
# Safe: backs up each file, verifies WELCOME10 is gone before saving, idempotent.
# Run:  .\patch-kill-welcome10.ps1    then deploy with  .\push-pctires.ps1

$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot
$enc = New-Object System.Text.UTF8Encoding($false)

# ---------------- homepage ----------------
$f = Join-Path $dir 'index.html'
if (Test-Path $f) {
  $t = [System.IO.File]::ReadAllText($f)
  if ($t.Contains('WELCOME10')) {
    Copy-Item $f "$f.bak-welcome10-$(Get-Date -Format yyyyMMdd-HHmmss)"
    $t = $t.Replace('<strong class="pb-prefix">NEW CUSTOMER:</strong> <span class="pb-long">Save 10% on your first order</span><span class="pb-short">10% off first order</span>','<strong class="pb-prefix">LOCAL INSTALL:</strong> <span class="pb-long">All four tires installed for $25/tire in Chatham-Kent</span><span class="pb-short">$25/tire install</span>')
    $t = $t.Replace('<span class="pb-use">Use code: </span><button class="promo-bar-code" onclick="copyPromoCode(this)" data-code="WELCOME10">WELCOME10</button>','<a href="tel:5193974686" class="promo-bar-code" style="text-decoration:none">519-397-4686</a>')
    if ($t.Contains('WELCOME10')) { Write-Host 'ERROR: index.html still contains WELCOME10 - NOT saved, review manually' -ForegroundColor Red }
    else { [System.IO.File]::WriteAllText($f,$t,$enc); Write-Host 'SUCCESS: index.html cleaned' -ForegroundColor Green }
  } else { Write-Host 'OK: index.html already clean' -ForegroundColor Yellow }
} else { Write-Host 'SKIP: index.html not found' -ForegroundColor Yellow }

# ---------------- winter blog ----------------
$f = Join-Path $dir 'best-winter-tires-2026.html'
if (Test-Path $f) {
  $t = [System.IO.File]::ReadAllText($f)
  if ($t.Contains('WELCOME10')) {
    Copy-Item $f "$f.bak-welcome10-$(Get-Date -Format yyyyMMdd-HHmmss)"
    $t = $t.Replace('<strong>NEW CUSTOMER:</strong> Save 10% on your first order with code <code>WELCOME10</code>','<strong>LOCAL INSTALL:</strong> Any tires installed for $25/tire at our Chatham-Kent shop')
    $t = [regex]::Replace($t, '\s*<p style="margin-top:20px[^>]*>New customer\?.*?WELCOME10</code></p>', '', [System.Text.RegularExpressions.RegexOptions]::Singleline)
    if ($t.Contains('WELCOME10')) { Write-Host 'ERROR: winter page still contains WELCOME10 - NOT saved, review manually' -ForegroundColor Red }
    else { [System.IO.File]::WriteAllText($f,$t,$enc); Write-Host 'SUCCESS: best-winter-tires-2026.html cleaned' -ForegroundColor Green }
  } else { Write-Host 'OK: winter page already clean' -ForegroundColor Yellow }
} else { Write-Host 'SKIP: best-winter-tires-2026.html not found' -ForegroundColor Yellow }

Write-Host ''
Write-Host 'Done. Review the homepage banner, then deploy with  .\push-pctires.ps1'
