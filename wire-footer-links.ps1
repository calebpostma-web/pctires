# wire-footer-links.ps1 - Updates footer Services column in index.html
# to link to the dedicated service landing pages instead of section anchors.
#
# This gives Google clear internal-link signals from every page view to the
# 4 dedicated service pages, which helps them get crawled, indexed, and ranked.
#
# Before: footer Services links scroll to #install / #services anchors on home
# After:  footer Services links go to dedicated /tire-installation.html etc.
#
# The original mobile menu and main nav are untouched - they still scroll to
# in-page sections for users browsing the home page.

$path = ".\index.html"
$content = [System.IO.File]::ReadAllText((Resolve-Path $path), [System.Text.Encoding]::UTF8)
$startLines = ($content -split "`n").Count
$startBytes = $content.Length
Write-Host "Before: $startLines lines, $startBytes chars" -ForegroundColor Cyan
Write-Host ""

# Find/replace 1: Footer Services column - swap anchor scrolls for real URLs
$oldServicesFooter = '<div class="footer-col"><h3>Services</h3><div class="footer-links"><a href="#install">Tire Installation</a><a href="#install">Mount &amp; Balance</a><a href="#services">TPMS Service</a><a href="#services">Seasonal Changeover</a><a href="#services">Book Appointment</a></div></div>'
$newServicesFooter = '<div class="footer-col"><h3>Services</h3><div class="footer-links"><a href="/tire-installation.html">Tire Installation</a><a href="/tire-installation.html">Mount &amp; Balance</a><a href="/tpms-service.html">TPMS Service</a><a href="/seasonal-changeover.html">Seasonal Changeover</a><a href="/winter-tires.html">Winter Tires</a></div></div>'

# Find/replace 2: Footer Shop column - keep these as section anchors since the catalog is on the home page
# (no change here, the anchor links to the catalog section are correct)

$edits = @(
  @{ Name = "Footer Services column -> dedicated landing pages";
     From = $oldServicesFooter;
     To   = $newServicesFooter }
)

$failures = @()
foreach ($e in $edits) {
  if ($content.Contains($e.From)) {
    $content = $content.Replace($e.From, $e.To)
    Write-Host ("OK    " + $e.Name) -ForegroundColor Green
  } else {
    Write-Host ("FAIL  " + $e.Name + " -- pattern not found") -ForegroundColor Red
    $failures += $e.Name
  }
}

Write-Host ""
if ($failures.Count -gt 0) {
  Write-Host "ABORTED. $($failures.Count) pattern(s) not found. File NOT modified." -ForegroundColor Red
  Write-Host "(Likely cause: the footer Services HTML differs slightly from what this script expects.)" -ForegroundColor Yellow
  exit 1
}

$endLines = ($content -split "`n").Count
$endBytes = $content.Length
$lineDelta = $endLines - $startLines
$byteDelta = $endBytes - $startBytes
$hasClosingHtml = $content.TrimEnd().EndsWith("</html>")

Write-Host "After:  $endLines lines (delta $lineDelta), $endBytes chars (delta $byteDelta)"
Write-Host "Ends with </html>: $hasClosingHtml"
Write-Host ""

if (-not $hasClosingHtml) {
  Write-Host "REFUSING TO WRITE: file no longer ends with </html>" -ForegroundColor Red; exit 1
}
if ([Math]::Abs($lineDelta) -gt 5) {
  Write-Host "REFUSING TO WRITE: line count changed by $lineDelta" -ForegroundColor Red; exit 1
}

$backup = ".\index.html.bak-footerlinks-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item -Path $path -Destination $backup
Write-Host "Backup saved: $backup" -ForegroundColor Cyan

[System.IO.File]::WriteAllText((Resolve-Path $path), $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "index.html written successfully." -ForegroundColor Green
Write-Host ""
Write-Host "ROLLBACK: Copy-Item -Force $backup .\index.html" -ForegroundColor Cyan
