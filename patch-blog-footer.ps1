# patch-blog-footer.ps1
# Adds a "Tire Guides" column to the index.html footer linking the 8 tire blog posts.
# Safe by design: backs up first, idempotent (won't double-apply), verifies before keeping.
# Run from the repo folder:  .\patch-blog-footer.ps1   then deploy with  .\push-pctires.ps1

$ErrorActionPreference = 'Stop'
$dir  = $PSScriptRoot
$path = Join-Path $dir 'index.html'

if (-not (Test-Path $path)) {
    Write-Host "ERROR: index.html not found in $dir" -ForegroundColor Red
    exit 1
}

$html = [System.IO.File]::ReadAllText($path)

if ($html.Contains('Tire Guides')) {
    Write-Host "Already patched: a 'Tire Guides' footer column is present. No change made." -ForegroundColor Yellow
    exit 0
}

$anchor = '<a href="/returns.html">Returns &amp; Warranty</a></div></div>'
if (-not $html.Contains($anchor)) {
    Write-Host "ERROR: footer anchor not found - the footer markup may have changed. No change made." -ForegroundColor Red
    exit 1
}

$col = '      <div class="footer-col"><h3>Tire Guides</h3><div class="footer-links">' +
       '<a href="/how-to-find-tire-size">Find Your Tire Size</a>' +
       '<a href="/do-you-need-premium-tires">Premium vs Value Tires</a>' +
       '<a href="/value-tire-brands">Value Tire Brands</a>' +
       '<a href="/antares-tires-review">Antares Tire Review</a>' +
       '<a href="/are-used-tires-safe">Are Used Tires Safe?</a>' +
       '<a href="/all-season-vs-winter-tires">All-Season vs Winter</a>' +
       '<a href="/trailer-farm-tire-guide">Trailer &amp; Farm Guide</a>' +
       '<a href="/tire-terms-explained">Tire Terms Explained</a>' +
       '</div></div>'

# Backup before touching anything
$stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $dir "index.html.bak-blogfooter-$stamp"
Copy-Item $path $backup

$new = $html.Replace($anchor, $anchor + $col)

if ($new.Length -le $html.Length) {
    Write-Host "ERROR: replacement did not grow the file. Original left untouched." -ForegroundColor Red
    exit 1
}

# Write back as UTF-8 with no BOM (avoids breaking the Cloudflare build)
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($path, $new, $enc)

# Verify every link landed
$check = [System.IO.File]::ReadAllText($path)
$need = @('Tire Guides','/how-to-find-tire-size','/do-you-need-premium-tires','/value-tire-brands',
          '/antares-tires-review','/are-used-tires-safe','/all-season-vs-winter-tires',
          '/trailer-farm-tire-guide','/tire-terms-explained')
$missing = @()
foreach ($n in $need) { if (-not $check.Contains($n)) { $missing += $n } }

if ($missing.Count -gt 0) {
    Write-Host "WARNING: these did not land: $($missing -join ', ')" -ForegroundColor Red
    Write-Host "Restore with: Copy-Item '$backup' '$path' -Force" -ForegroundColor Yellow
    exit 1
}

Write-Host "SUCCESS: 'Tire Guides' footer column added with all 8 links." -ForegroundColor Green
Write-Host "Backup: $backup"
Write-Host "Next: review the footer in a browser, then deploy with  .\push-pctires.ps1"
