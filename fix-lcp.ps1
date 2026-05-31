# fix-lcp.ps1 - Font loading + LCP optimization for index.html
# 4 changes:
#   1. Add DNS preconnect hints for Google Fonts servers
#   2. Convert blocking Google Fonts stylesheet to async preload pattern (with noscript fallback)
#   3. Add 'defer' to Stripe.js
#   4. Add 'defer' to /promo-codes.js
#
# All changes are reversible. Auto-backup before write. Refuses to write if sanity checks fail.

$path = ".\index.html"
$content = [System.IO.File]::ReadAllText((Resolve-Path $path), [System.Text.Encoding]::UTF8)
$startLines = ($content -split "`n").Count
$startBytes = $content.Length
Write-Host "Before: $startLines lines, $startBytes chars" -ForegroundColor Cyan
Write-Host ""

$preconnectBlock = @"
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
"@

$fontUrl = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;700;800;900&family=Barlow:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'
$origFontLink = "<link href=`"$fontUrl`" rel=`"stylesheet`">"
$newFontLink = "<link rel=`"preload`" as=`"style`" href=`"$fontUrl`" onload=`"this.onload=null;this.rel='stylesheet'`"><noscript><link rel=`"stylesheet`" href=`"$fontUrl`"></noscript>"

$edits = @(
  @{ Name = "1. Add preconnect hints for Google Fonts";
     From = '<meta charset="UTF-8">';
     To   = $preconnectBlock },

  @{ Name = "2. Convert Google Fonts to async preload";
     From = $origFontLink;
     To   = $newFontLink },

  @{ Name = "3. Add defer to Stripe.js";
     From = '<script src="https://js.stripe.com/v3/"></script>';
     To   = '<script src="https://js.stripe.com/v3/" defer></script>' },

  @{ Name = "4. Add defer to promo-codes.js";
     From = '<script src="/promo-codes.js"></script>';
     To   = '<script src="/promo-codes.js" defer></script>' }
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
  Write-Host "REFUSING TO WRITE: file no longer ends with </html>. Aborting." -ForegroundColor Red
  exit 1
}
if ([Math]::Abs($lineDelta) -gt 5) {
  Write-Host "REFUSING TO WRITE: line count changed by $lineDelta. Aborting." -ForegroundColor Red
  exit 1
}

$backup = ".\index.html.bak-lcp-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item -Path $path -Destination $backup
Write-Host "Backup saved: $backup" -ForegroundColor Cyan

[System.IO.File]::WriteAllText((Resolve-Path $path), $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "index.html written successfully." -ForegroundColor Green
Write-Host ""
Write-Host "WHAT THIS DOES:" -ForegroundColor Yellow
Write-Host "  - Browser opens DNS connection to fonts.googleapis.com and fonts.gstatic.com"
Write-Host "    in parallel with HTML parse (saves ~100-200ms on cold visits)"
Write-Host "  - Fonts load asynchronously instead of blocking render"
Write-Host "    (the noscript tag is a fallback if JavaScript is disabled)"
Write-Host "  - Stripe.js and promo-codes.js load with defer (after HTML parse, before"
Write-Host "    DOMContentLoaded). Doesn't affect functionality since both are only"
Write-Host "    used after user interactions (checkout, promo entry)."
Write-Host ""
Write-Host "EXPECTED LCP IMPROVEMENT: -1.5 to -3 seconds on mobile" -ForegroundColor Yellow
Write-Host ""
Write-Host "TEST IN BROWSER:" -ForegroundColor Yellow
Write-Host "  1. Open .\index.html in browser. Text should appear instantly."
Write-Host "  2. Briefly may see plain font before Barlow loads (this is 'FOUT' and is expected)."
Write-Host "  3. Try opening cart > checkout: Stripe should still load and credit card field appears."
Write-Host "  4. Try entering a promo code: should still validate."
Write-Host ""
Write-Host "ROLLBACK: Copy-Item -Force $backup .\index.html" -ForegroundColor Cyan
