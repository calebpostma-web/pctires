# fix-schema-warnings.ps1 - Adds priceRange and image to the LocalBusiness
# provider block in each of the 4 service landing pages.
#
# Why: Google Rich Results tester flagged both as missing (non-critical).
# Adding them clears the warnings and slightly improves rich-result eligibility.

$pages = @(
  ".\tire-installation.html",
  ".\winter-tires.html",
  ".\tpms-service.html",
  ".\seasonal-changeover.html"
)

# The pattern to find (same in all 4 files) and the replacement.
# These match the EXACT current schema structure I generated.
$oldProvider = '"provider": {"@type": "AutoPartsStore", "@id": "https://pctires.ca/#business", "name": "PC Tires", "telephone": "+1-519-397-4686", "address":'
$newProvider = '"provider": {"@type": "AutoPartsStore", "@id": "https://pctires.ca/#business", "name": "PC Tires", "telephone": "+1-519-397-4686", "priceRange": "$$", "image": "https://pctires.ca/favicon-192.png", "address":'

$totalUpdated = 0

foreach ($p in $pages) {
  if (-not (Test-Path $p)) {
    Write-Host ("SKIP  $p (file not found)") -ForegroundColor Yellow
    continue
  }

  $content = [System.IO.File]::ReadAllText((Resolve-Path $p), [System.Text.Encoding]::UTF8)

  if (-not $content.Contains($oldProvider)) {
    Write-Host ("SKIP  $p (pattern not found - already patched?)") -ForegroundColor Yellow
    continue
  }

  $backup = "$p.bak-schema-$(Get-Date -Format yyyyMMdd-HHmmss)"
  Copy-Item -Path $p -Destination $backup

  $content = $content.Replace($oldProvider, $newProvider)
  [System.IO.File]::WriteAllText((Resolve-Path $p), $content, (New-Object System.Text.UTF8Encoding($false)))

  Write-Host ("OK    $p (backup: $backup)") -ForegroundColor Green
  $totalUpdated++
}

Write-Host ""
Write-Host "Updated $totalUpdated of $($pages.Count) pages." -ForegroundColor Cyan
Write-Host ""
Write-Host "Push when ready:" -ForegroundColor Yellow
Write-Host "  .\push-pctires.ps1"
