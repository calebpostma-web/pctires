# fix-anchors.ps1 - applies 15 crawlable-anchor fixes to index.html
# Pure-ASCII script - safe to run in Windows PowerShell 5.1.
# Emoji + special chars are built at runtime via [char]::ConvertFromUtf32.

$path = ".\index.html"
$content = [System.IO.File]::ReadAllText((Resolve-Path $path), [System.Text.Encoding]::UTF8)
$startLines = ($content -split "`n").Count
$startBytes = $content.Length
Write-Host "Before: $startLines lines, $startBytes chars" -ForegroundColor Cyan
Write-Host ""

# Build emojis at runtime (no non-ASCII chars in this script file)
$person    = [char]::ConvertFromUtf32(0x1F464)                     # bust-in-silhouette
$moon      = [char]::ConvertFromUtf32(0x1F313)                     # first-quarter moon
$book      = [char]::ConvertFromUtf32(0x1F4D8)                     # blue book / Facebook stand-in
$camera    = [char]::ConvertFromUtf32(0x1F4F8)                     # camera with flash
$play      = [char]0x25B6 + [char]0xFE0F                           # play button + variation selector
# (Note: source HTML uses these exact glyph sequences in the social/menu copy.)

# Helper: builds before/after string pair with optional emoji and optional inner-quote escaping.
# Using @"...."@ here-strings would have its own gotchas with `# inside HTML.
# Sticking with double-quoted strings + `" for embedded quotes.

$edits = @(
  @{ Name = "1. Logo href (# -> /)";
     From = 'class="logo" href="#"';
     To   = 'class="logo" href="/"' },

  @{ Name = "2. Mobile menu Member Login (a -> button)";
     From = "<a class=`"mobile-menu-link`" href=`"#`" onclick=`"closeMenu();openMemberModal();return false`">$person Member Login</a>";
     To   = "<button class=`"mobile-menu-link`" type=`"button`" onclick=`"closeMenu();openMemberModal()`" style=`"background:none;border:none;text-align:left;width:100%;cursor:pointer;font:inherit;color:inherit;padding:inherit`">$person Member Login</button>" },

  @{ Name = "3. Mobile menu Theme Toggle (a -> button)";
     From = "<a class=`"mobile-menu-link`" href=`"#`" onclick=`"closeMenu();toggleTheme();return false`">$moon Toggle Light/Dark</a>";
     To   = "<button class=`"mobile-menu-link`" type=`"button`" onclick=`"closeMenu();toggleTheme()`" style=`"background:none;border:none;text-align:left;width:100%;cursor:pointer;font:inherit;color:inherit;padding:inherit`">$moon Toggle Light/Dark</button>" },

  @{ Name = "4. Cookie banner privacy link";
     From = 'agree to our <a href="#">Privacy Policy</a>. Required';
     To   = 'agree to our <a href="/privacy.html">Privacy Policy</a>. Required' },

  @{ Name = "5. Footer Shop column";
     From = '<div class="footer-col"><h3>Shop</h3><div class="footer-links"><a>All-Season Tires</a><a>Winter Tires</a><a>Summer / Performance</a><a>Truck &amp; SUV Tires</a><a>Steel &amp; Alloy Wheels</a></div></div>';
     To   = '<div class="footer-col"><h3>Shop</h3><div class="footer-links"><a href="#catalog">All-Season Tires</a><a href="#catalog">Winter Tires</a><a href="#catalog">Summer / Performance</a><a href="#catalog">Truck &amp; SUV Tires</a><a href="#catalog">Steel &amp; Alloy Wheels</a></div></div>' },

  @{ Name = "6. Footer Services column";
     From = '<div class="footer-col"><h3>Services</h3><div class="footer-links"><a>Tire Installation</a><a>Mount &amp; Balance</a><a>TPMS Service</a><a>Seasonal Changeover</a><a>Book Appointment</a></div></div>';
     To   = '<div class="footer-col"><h3>Services</h3><div class="footer-links"><a href="#install">Tire Installation</a><a href="#install">Mount &amp; Balance</a><a href="#services">TPMS Service</a><a href="#services">Seasonal Changeover</a><a href="#services">Book Appointment</a></div></div>' },

  @{ Name = "7. Footer Location & Hours";
     From = "<a onclick=`"smoothScroll('#location')`">Location &amp; Hours</a>";
     To   = '<a href="#location">Location &amp; Hours</a>' },

  @{ Name = "8. Footer Privacy/Returns";
     From = '<a href="#">Privacy Policy</a><a href="#">Returns &amp; Warranty</a>';
     To   = '<a href="/privacy.html">Privacy Policy</a><a href="/returns.html">Returns &amp; Warranty</a>' },

  @{ Name = "9. SMS quote link";
     From = '<a id="quoteSmsLink" href="#"';
     To   = '<a id="quoteSmsLink" href="sms:"' },

  @{ Name = "10. Email quote link";
     From = '<a id="quoteEmailLink" href="#"';
     To   = '<a id="quoteEmailLink" href="mailto:"' },

  @{ Name = "11. mm-note Request access";
     From = "<a onclick=`"switchMmTab('request')`">Request access</a>";
     To   = "<a href=`"#`" onclick=`"switchMmTab('request');return false`">Request access</a>" },

  @{ Name = "12. Dynamic 'not sure' anchor";
     From = "<a onclick=`"smoothScroll('#guide')`" style=`"color:var(--yellow);cursor:pointer`">not sure what size you need?</a>";
     To   = "<a href=`"#guide`" onclick=`"smoothScroll('#guide');return false`" style=`"color:var(--yellow);cursor:pointer`">not sure what size you need?</a>" },

  @{ Name = "13. Social: Facebook (a -> disabled button)";
     From = "<a class=`"social-link`" href=`"#`" target=`"_blank`"><span class=`"social-icon`">$book</span> Facebook</a>";
     To   = "<button type=`"button`" class=`"social-link`" disabled style=`"background:var(--card);font:inherit;cursor:default;opacity:0.55`"><span class=`"social-icon`">$book</span> Facebook</button>" },

  @{ Name = "14. Social: Instagram (a -> disabled button)";
     From = "<a class=`"social-link`" href=`"#`" target=`"_blank`"><span class=`"social-icon`">$camera</span> Instagram</a>";
     To   = "<button type=`"button`" class=`"social-link`" disabled style=`"background:var(--card);font:inherit;cursor:default;opacity:0.55`"><span class=`"social-icon`">$camera</span> Instagram</button>" },

  @{ Name = "15. Social: TikTok (a -> disabled button)";
     From = "<a class=`"social-link`" href=`"#`" target=`"_blank`"><span class=`"social-icon`">$play</span> TikTok</a>";
     To   = "<button type=`"button`" class=`"social-link`" disabled style=`"background:var(--card);font:inherit;cursor:default;opacity:0.55`"><span class=`"social-icon`">$play</span> TikTok</button>" }
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

$backup = ".\index.html.bak-anchors-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item -Path $path -Destination $backup
Write-Host "Backup saved: $backup" -ForegroundColor Cyan

[System.IO.File]::WriteAllText((Resolve-Path $path), $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "index.html written successfully." -ForegroundColor Green
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Double-click index.html to open in browser. Click around."
Write-Host "  2. If good, push to test branch:"
Write-Host "       git checkout -b test-anchor-fixes"
Write-Host "       git add index.html"
Write-Host "       git commit -m 'SEO: make site anchors crawlable'"
Write-Host "       git push -u origin test-anchor-fixes"
Write-Host "  3. Cloudflare creates a preview URL. Test there."
Write-Host "  4. When satisfied, merge to main."
Write-Host ""
Write-Host "ROLLBACK: Copy-Item -Force $backup .\index.html" -ForegroundColor Cyan
