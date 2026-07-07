# patch-antares-locus.ps1 -- update Antares review page with A1->Locus story (2026-07-07)
#
# Adds the Ingens A1 phase-out / Ingens-Locus succession note (discovered from
# live TDG stock 2026-07-06) and links the model names to the new model pages.
# All 5 edits pre-simulated in Python against the current file: each anchor
# appears exactly once, zero line delta, all strings pure ASCII.
#
# Run:
#   cd C:\Users\Caleb\Documents\Claude\Projects\PCtires
#   .\patch-antares-locus.ps1
# Then deploy:
#   .\push-pctires.ps1

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\Caleb\Documents\Claude\Projects\PCtires'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

$f = 'antares-tires-review.html'
$raw = [System.IO.File]::ReadAllText((Resolve-Path $f).Path)

$edits = @(
  @('<span>Updated June 2026</span>',
    '<span>Updated July 2026</span>'),
  @('<li><strong>Polymax 4S</strong>',
    '<li><strong><a href="/antares-polymax-4s">Polymax 4S</a></strong>'),
  @('<li><strong>Ingens A1</strong>',
    '<li><strong><a href="/antares-ingens-a1">Ingens A1</a></strong>'),
  @('<li><strong>Goliath AT</strong>',
    '<li><strong><a href="/antares-goliath-at">Goliath AT</a></strong>'),
  @('Good value pick for daily driving.</li>',
    'Good value pick for daily driving. Heads up: Antares is moving its sport sizes to the newer <a href="/antares-ingens-locus">Ingens-Locus</a> &mdash; if your A1 size shows sold out, that&rsquo;s where it went. Everyday sizes are still stocked deep.</li>')
)

foreach ($e in $edits) {
  $c = ([regex]::Matches($raw, [regex]::Escape($e[0]))).Count
  if ($c -ne 1) {
    Write-Host "FAIL: anchor found $c times (expected 1): $($e[0].Substring(0, [Math]::Min(50, $e[0].Length)))" -ForegroundColor Red
    exit 1
  }
}

Copy-Item $f "$f.bak-locus-$stamp"
foreach ($e in $edits) { $raw = $raw.Replace($e[0], $e[1]) }
[System.IO.File]::WriteAllText((Resolve-Path $f).Path, $raw)

$chk = [System.IO.File]::ReadAllText((Resolve-Path $f).Path)
$ok = ($chk.Contains('antares-ingens-locus')) -and ($chk.Contains('Updated July 2026')) -and (-not $chk.Contains('<li><strong>Polymax 4S</strong>'))
if ($ok) {
  Write-Host "OK: Antares review updated with Locus story + model page links (backup $f.bak-locus-$stamp)" -ForegroundColor Green
  Write-Host 'ALL CHECKS PASSED. Deploy with: .\push-pctires.ps1' -ForegroundColor Green
} else {
  Write-Host 'FAIL: verification -- RESTORING BACKUP' -ForegroundColor Red
  Copy-Item "$f.bak-locus-$stamp" $f -Force
  exit 1
}
