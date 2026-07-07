# patch-model-pages.ps1 -- wire 16 new tire model pages into the site (2026-07-06)
#
# The 16 model page HTML files are already in the repo folder (written by Claude).
# This script:
#   1. Adds a "Tires by Model" footer column to index.html (after Tire Guides)
#   2. Adds the 16 pages to sitemap.xml
#
# Run:
#   cd C:\Users\Caleb\Documents\Claude\Projects\PCtires
#   .\patch-model-pages.ps1
# Then deploy:
#   .\push-pctires.ps1

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\Caleb\Documents\Claude\Projects\PCtires'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$fail = $false

$pages = @(
  @('antares-ingens-a1',            'Antares Ingens A1'),
  @('antares-ingens-locus',         'Antares Ingens-Locus'),
  @('antares-ingens-ev',            'Antares Ingens EV'),
  @('antares-comfort-a5',           'Antares Comfort A5'),
  @('antares-polymax-4s',           'Antares Polymax 4S'),
  @('antares-grip-60-ice',          'Antares Grip 60 Ice'),
  @('antares-goliath-at',           'Antares Goliath AT'),
  @('antares-smt-a7',               'Antares SMT A7'),
  @('michelin-crossclimate2',       'Michelin CrossClimate2'),
  @('michelin-x-ice-snow',          'Michelin X-Ice Snow'),
  @('michelin-pilot-sport-as-4',    'Michelin Pilot Sport AS4'),
  @('pirelli-scorpion-as-plus-3',   'Pirelli Scorpion AS Plus 3'),
  @('pirelli-scorpion-weatheractive','Pirelli Scorpion Weatheractive'),
  @('continental-dws06-plus',       'Continental DWS06 Plus'),
  @('bridgestone-weatherpeak',      'Bridgestone WeatherPeak'),
  @('bridgestone-blizzak-icepeak',  'Bridgestone Blizzak IcePeak')
)

# ---- 0. sanity: all 16 page files must exist in the repo ----
$missing = @()
foreach ($p in $pages) { if (-not (Test-Path ($p[0] + '.html'))) { $missing += $p[0] } }
if ($missing.Count -gt 0) {
  Write-Host "FAIL: missing page files: $($missing -join ', ')" -ForegroundColor Red
  exit 1
}
Write-Host 'OK: all 16 page files present in repo' -ForegroundColor Green

# ---- 1. index.html footer column ----
$f1 = 'index.html'
$raw1 = [System.IO.File]::ReadAllText((Resolve-Path $f1).Path)

$anchor = '<a href="/tire-terms-explained">Tire Terms Explained</a></div></div>'
$count = ([regex]::Matches($raw1, [regex]::Escape($anchor))).Count
if ($count -ne 1) {
  Write-Host "FAIL: footer anchor found $count times (expected 1) -- NOT patching index.html" -ForegroundColor Red
  $fail = $true
} elseif ($raw1.Contains('Tires by Model')) {
  Write-Host 'SKIP: index.html already has Tires by Model column' -ForegroundColor Yellow
} else {
  $links = ($pages | ForEach-Object { '<a href="/' + $_[0] + '">' + $_[1] + '</a>' }) -join ''
  $newCol = '<div class="footer-col"><h3>Tires by Model</h3><div class="footer-links">' + $links + '</div></div>'
  Copy-Item $f1 "$f1.bak-modelpages-$stamp"
  $raw1 = $raw1.Replace($anchor, $anchor + $newCol)
  [System.IO.File]::WriteAllText((Resolve-Path $f1).Path, $raw1)
  $chk = [System.IO.File]::ReadAllText((Resolve-Path $f1).Path)
  if (($chk.Contains('Tires by Model')) -and (([regex]::Matches($chk, [regex]::Escape('/antares-ingens-locus'))).Count -ge 1)) {
    Write-Host "OK: footer column added to index.html (backup $f1.bak-modelpages-$stamp)" -ForegroundColor Green
  } else {
    Write-Host 'FAIL: footer verification -- RESTORING BACKUP' -ForegroundColor Red
    Copy-Item "$f1.bak-modelpages-$stamp" $f1 -Force
    $fail = $true
  }
}

# ---- 2. sitemap.xml ----
$f2 = 'sitemap.xml'
$raw2 = [System.IO.File]::ReadAllText((Resolve-Path $f2).Path)
$closeTag = '</urlset>'
if (([regex]::Matches($raw2, [regex]::Escape($closeTag))).Count -ne 1) {
  Write-Host 'FAIL: sitemap.xml closing tag not found exactly once' -ForegroundColor Red
  $fail = $true
} elseif ($raw2.Contains('antares-ingens-locus')) {
  Write-Host 'SKIP: sitemap.xml already has model pages' -ForegroundColor Yellow
} else {
  $entries = New-Object System.Text.StringBuilder
  foreach ($p in $pages) {
    [void]$entries.Append("  <url>`n    <loc>https://pctires.ca/$($p[0])</loc>`n    <lastmod>2026-07-06</lastmod>`n    <changefreq>weekly</changefreq>`n    <priority>0.8</priority>`n  </url>`n")
  }
  Copy-Item $f2 "$f2.bak-modelpages-$stamp"
  $raw2 = $raw2.Replace($closeTag, $entries.ToString() + $closeTag)
  [System.IO.File]::WriteAllText((Resolve-Path $f2).Path, $raw2)
  $chk2 = [System.IO.File]::ReadAllText((Resolve-Path $f2).Path)
  $n = 0
  foreach ($p in $pages) { if ($chk2.Contains('https://pctires.ca/' + $p[0] + '</loc>')) { $n++ } }
  try { [xml]$null = $chk2; $xmlOk = $true } catch { $xmlOk = $false }
  if ($n -eq 16 -and $xmlOk) {
    Write-Host "OK: 16 sitemap entries added, XML validates (backup $f2.bak-modelpages-$stamp)" -ForegroundColor Green
  } else {
    Write-Host "FAIL: sitemap verification (entries: $n, xml: $xmlOk) -- RESTORING BACKUP" -ForegroundColor Red
    Copy-Item "$f2.bak-modelpages-$stamp" $f2 -Force
    $fail = $true
  }
}

if ($fail) { Write-Host 'PATCH DID NOT FULLY APPLY -- see messages above.' -ForegroundColor Red; exit 1 }
Write-Host ''
Write-Host 'ALL CHECKS PASSED. Deploy with: .\push-pctires.ps1' -ForegroundColor Green
Write-Host '16 model pages + footer links + sitemap will go live together.' -ForegroundColor Green
