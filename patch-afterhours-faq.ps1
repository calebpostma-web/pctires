# patch-afterhours-faq.ps1
# Adds after-hours emergency service messaging to the site (case-by-case, no
# rate published, per Caleb's decision 2026-07-04). Does NOT touch the posted
# Hours widget or the JSON-LD openingHoursSpecification - those stay Mon-Sat
# 8am-6pm exactly as-is, so the "openness" ranking signal stays accurate.
#
# Adds:
#   1. A short note under the Hours widget in the Location & Hours section
#   2. A new FAQ entry (crawlable Q&A text, helps it surface in search)
#
# Run from the PCtires folder:  .\patch-afterhours-faq.ps1

$ErrorActionPreference = "Stop"
$file = Join-Path $PSScriptRoot "index.html"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

if (-not (Test-Path $file)) {
    Write-Host "FAIL: index.html not found in $PSScriptRoot" -ForegroundColor Red
    exit 1
}

$backup = "$file.bak-afterhours-$stamp"
Copy-Item $file $backup
Write-Host "Backup created: $backup"

$content = Get-Content $file -Raw -Encoding UTF8
$origLen = $content.Length

$pin   = [char]::ConvertFromUtf32(0x1F4CD)   # the pin emoji already used on "Get Directions"
$mdash = [char]0x2014                        # em dash

# --- 1) Location & Hours section: after-hours note ---
$oldLoc = @"
      </div>
      <a href="https://maps.google.com/?q=7144+Grande+River+Line+Pain+Court+Ontario+N0P+1Z0" target="_blank" class="map-btn">$pin Get Directions</a>
"@
$newLoc = @"
      </div>
      <div class="loc-note" style="font-size:12px;color:var(--muted);margin-top:8px">Stuck after hours? Call us $mdash emergency visits available, case-by-case, after-hours rate applies.</div>
      <a href="https://maps.google.com/?q=7144+Grande+River+Line+Pain+Court+Ontario+N0P+1Z0" target="_blank" class="map-btn">$pin Get Directions</a>
"@

$countLoc = ([regex]::Matches($content, [regex]::Escape($oldLoc))).Count
if ($countLoc -ne 1) {
    Write-Host "FAIL: expected 1 match for the Location/Hours anchor, found $countLoc. Aborting, no changes written." -ForegroundColor Red
    exit 1
}
$content = $content.Replace($oldLoc, $newLoc)

# --- 2) FAQS array: new after-hours entry ---
$oldFaq = @"
  {q:"Do you price match?",a:"We aim to have competitive prices. If you find the exact same tire cheaper at a local or online retailer, contact us and we'll do our best to match it."},
];
"@
$newFaq = @"
  {q:"Do you price match?",a:"We aim to have competitive prices. If you find the exact same tire cheaper at a local or online retailer, contact us and we'll do our best to match it."},
  {q:"Do you offer after-hours or emergency tire service?",a:"If you're stuck with a flat outside our posted hours, give us a call $mdash we handle emergency after-hours visits case-by-case and bill at an after-hours rate."},
];
"@

$countFaq = ([regex]::Matches($content, [regex]::Escape($oldFaq))).Count
if ($countFaq -ne 1) {
    Write-Host "FAIL: expected 1 match for the FAQ anchor, found $countFaq. Aborting, no changes written." -ForegroundColor Red
    exit 1
}
$content = $content.Replace($oldFaq, $newFaq)

# --- Write ---
[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

# --- Verify ---
$check = Get-Content $file -Raw -Encoding UTF8
$fail = $false

if (([regex]::Matches($check, [regex]::Escape("loc-note"))).Count -ne 1) {
    Write-Host "VERIFY FAIL: loc-note div not found" -ForegroundColor Red; $fail = $true
} else { Write-Host "OK: after-hours note present in Location & Hours section" }

if (([regex]::Matches($check, [regex]::Escape("Do you offer after-hours or emergency tire service?"))).Count -ne 1) {
    Write-Host "VERIFY FAIL: after-hours FAQ entry not found" -ForegroundColor Red; $fail = $true
} else { Write-Host "OK: after-hours FAQ entry present" }

$grew = $check.Length - $origLen
Write-Host "File grew by $grew chars"
if ($grew -le 0) { Write-Host "VERIFY FAIL: file did not grow as expected" -ForegroundColor Red; $fail = $true }

if (-not $check.TrimEnd().EndsWith("</html>")) {
    Write-Host "VERIFY FAIL: file no longer ends with </html>" -ForegroundColor Red; $fail = $true
}

if ($fail) {
    Copy-Item $backup $file -Force
    Write-Host "Restored from backup. No changes kept." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "PATCH OK." -ForegroundColor Green
Write-Host "Test locally, then deploy with:  .\push-pctires.ps1" -ForegroundColor Green
