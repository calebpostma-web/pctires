# run-generator.ps1 - Convenience wrapper for generate-tire-pages.js
# From C:\Users\Caleb\Documents\Claude\Projects\PCtires, run:
#   .\tools\run-generator.ps1

# Verify Node is installed
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host "Node.js is not installed or not on PATH." -ForegroundColor Red
  Write-Host "Install from https://nodejs.org/ (LTS is fine) and re-run." -ForegroundColor Yellow
  exit 1
}

$nodeVer = (node --version) -replace '^v', ''
$major = [int]($nodeVer -split '\.')[0]
if ($major -lt 18) {
  Write-Host "Node $nodeVer detected. Generator requires Node 18+ (uses built-in fetch)." -ForegroundColor Red
  Write-Host "Upgrade from https://nodejs.org/ and re-run." -ForegroundColor Yellow
  exit 1
}

Write-Host "Node $nodeVer detected. Running generator..." -ForegroundColor Cyan
Write-Host ""

# Backup current sitemap before generator modifies it
$sitemapBackup = ".\sitemap.xml.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
if (Test-Path ".\sitemap.xml") {
  Copy-Item -Path ".\sitemap.xml" -Destination $sitemapBackup
  Write-Host "sitemap.xml backed up to: $sitemapBackup" -ForegroundColor Cyan
  Write-Host ""
}

# Run the generator
node .\tools\generate-tire-pages.js

if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Generator exited with code $LASTEXITCODE." -ForegroundColor Red
  Write-Host "ROLLBACK: Copy-Item -Force $sitemapBackup .\sitemap.xml" -ForegroundColor Yellow
  exit $LASTEXITCODE
}

# Show what was generated
Write-Host ""
$generated = Get-ChildItem -Path ".\tires" -Filter "*.html" -ErrorAction SilentlyContinue
if ($generated) {
  Write-Host "Generated pages in .\tires\:" -ForegroundColor Green
  $generated | ForEach-Object { Write-Host ("  - " + $_.Name + " (" + [math]::Round($_.Length / 1024, 1) + " KB)") }
  Write-Host ""
  Write-Host ("Total: " + $generated.Count + " pages") -ForegroundColor Green
} else {
  Write-Host "No pages generated. Check the output above for errors." -ForegroundColor Red
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open .\tires\225-65r17.html (or any other) in your browser to spot-check"
Write-Host "  2. Push: .\push-pctires.ps1"
Write-Host "  3. After deploy, submit sitemap.xml in Google Search Console"
Write-Host ""
Write-Host "ROLLBACK if any page looks wrong:" -ForegroundColor Cyan
Write-Host "  Remove-Item .\tires\*.html"
Write-Host "  Copy-Item -Force $sitemapBackup .\sitemap.xml"
