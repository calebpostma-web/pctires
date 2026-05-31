# extract-vehicle-db.ps1 - Moves vehicle/wheel reference data out of index.html
# into /vehicle-db.js, loaded with defer.
#
# What this does:
#   1. Extracts the OEM_BOLT_PATTERNS object (~10KB, ~300 lines)
#   2. Extracts the VD + OEM_SIZES + OEM_ALT_SIZES block (~15KB, ~600 lines)
#   3. Writes both to .\vehicle-db.js with 'const' replaced by 'var' for global scope
#   4. Replaces the extracted blocks in index.html with one-line marker comments
#   5. Adds <script src="/vehicle-db.js" defer></script> before </head>
#
# Net result: index.html drops ~25KB. The data still loads (in parallel with HTML
# parse, via defer), it's just not blocking first paint anymore.
#
# IMPORTANT: This is a bigger change than the anchor fix or LCP fix. After running,
# you MUST test the vehicle lookup feature carefully before pushing:
#   - Open index.html in browser
#   - Find "By Vehicle" tab, pick a Year/Make/Model/Trim, click Search
#   - Find "Shop Wheels" tab, do a vehicle wheel lookup
#   - Try VIN lookup with a real VIN
# If any of those break, rollback (command printed at the end).

$path = ".\index.html"
$content = [System.IO.File]::ReadAllText((Resolve-Path $path), [System.Text.Encoding]::UTF8)
$startLines = ($content -split "`n").Count
$startBytes = $content.Length
Write-Host "Before: $startLines lines, $startBytes chars" -ForegroundColor Cyan
Write-Host ""

# -- Block 1: OEM_BOLT_PATTERNS ---------------------------------------------
$bp_start_anchor = "const OEM_BOLT_PATTERNS = {"
$bp_next_section = "//  PRICING ENGINE"
$bp_startIdx = $content.IndexOf($bp_start_anchor)
if ($bp_startIdx -lt 0) {
  Write-Host "FAIL: could not find '$bp_start_anchor' in index.html" -ForegroundColor Red
  exit 1
}
$bp_nextSecIdx = $content.IndexOf($bp_next_section, $bp_startIdx)
if ($bp_nextSecIdx -lt 0) {
  Write-Host "FAIL: could not find '$bp_next_section' after OEM_BOLT_PATTERNS" -ForegroundColor Red
  exit 1
}
$bp_endIdx = $content.LastIndexOf("};", $bp_nextSecIdx) + 2
$bp_block = $content.Substring($bp_startIdx, $bp_endIdx - $bp_startIdx)
$bp_blockLines = ($bp_block -split "`n").Count
Write-Host "OK    Found OEM_BOLT_PATTERNS: $($bp_block.Length) chars, $bp_blockLines lines" -ForegroundColor Green

# -- Block 2: VD + OEM_SIZES + OEM_ALT_SIZES --------------------------------
$vd_start_anchor = "const VD = {"
$vd_next_section = "//  VIN DECODER"
$vd_startIdx = $content.IndexOf($vd_start_anchor)
if ($vd_startIdx -lt 0) {
  Write-Host "FAIL: could not find '$vd_start_anchor' in index.html" -ForegroundColor Red
  exit 1
}
$vd_nextSecIdx = $content.IndexOf($vd_next_section, $vd_startIdx)
if ($vd_nextSecIdx -lt 0) {
  Write-Host "FAIL: could not find '$vd_next_section' after VD/OEM_SIZES/OEM_ALT_SIZES" -ForegroundColor Red
  exit 1
}
$vd_endIdx = $content.LastIndexOf("};", $vd_nextSecIdx) + 2
$vd_block = $content.Substring($vd_startIdx, $vd_endIdx - $vd_startIdx)
$vd_blockLines = ($vd_block -split "`n").Count
Write-Host "OK    Found VD + OEM_SIZES + OEM_ALT_SIZES: $($vd_block.Length) chars, $vd_blockLines lines" -ForegroundColor Green

# Quick sanity: each block must contain the constant name + at least one closing brace
if (-not $bp_block.Contains("const OEM_BOLT_PATTERNS")) { Write-Host "FAIL: OEM_BOLT_PATTERNS block sanity check" -ForegroundColor Red; exit 1 }
if (-not $vd_block.Contains("const VD")) { Write-Host "FAIL: VD block sanity check" -ForegroundColor Red; exit 1 }
if (-not $vd_block.Contains("const OEM_SIZES")) { Write-Host "FAIL: OEM_SIZES sanity check (block boundary wrong)" -ForegroundColor Red; exit 1 }
if (-not $vd_block.Contains("const OEM_ALT_SIZES")) { Write-Host "FAIL: OEM_ALT_SIZES sanity check (block boundary wrong)" -ForegroundColor Red; exit 1 }

# -- Build vehicle-db.js content --------------------------------------------
# Replace 'const ' with 'var ' so the constants become true globals on window.
# (const at script-top is block-scoped to the script and not accessible to other scripts.)
$bp_global = $bp_block.Replace("const OEM_BOLT_PATTERNS", "var OEM_BOLT_PATTERNS")
$vd_global = $vd_block.Replace("const VD =", "var VD =").Replace("const OEM_SIZES =", "var OEM_SIZES =").Replace("const OEM_ALT_SIZES =", "var OEM_ALT_SIZES =")

$dbHeader = @"
// vehicle-db.js
// Vehicle and wheel reference data, extracted from index.html on $(Get-Date -Format yyyy-MM-dd).
// Loaded with defer so it doesn't block first paint. Variables are global (var) so
// existing references in index.html's inline script resolve correctly.

"@

$dbContent = $dbHeader + $bp_global + "`n`n" + $vd_global + "`n"

# -- Mutate index.html ------------------------------------------------------
$placeholderBp = "// OEM_BOLT_PATTERNS moved to /vehicle-db.js (loaded with defer)"
$placeholderVd = "// VD, OEM_SIZES, OEM_ALT_SIZES moved to /vehicle-db.js (loaded with defer)"

# Important: replace the SECOND block first so the first block's indices stay valid.
# We have the exact strings, so just use .Replace() instead of index-based mutation.
$newContent = $content.Replace($vd_block, $placeholderVd).Replace($bp_block, $placeholderBp)

# Add the script tag right before </head>. Defer means it loads in parallel with
# HTML parse and runs before DOMContentLoaded, so any function that references
# VD/OEM_SIZES/etc. (all called post-DOMContentLoaded) has them available.
$scriptTag = '<script src="/vehicle-db.js" defer></script>'
if (-not $newContent.Contains($scriptTag)) {
  $newContent = $newContent.Replace("</head>", "$scriptTag`n</head>")
  Write-Host "OK    Inserted <script src=`"/vehicle-db.js`" defer> before </head>" -ForegroundColor Green
} else {
  Write-Host "OK    Script tag already present (idempotent re-run)" -ForegroundColor Yellow
}

# -- Sanity checks ----------------------------------------------------------
$endLines = ($newContent -split "`n").Count
$endBytes = $newContent.Length
$lineDelta = $endLines - $startLines
$byteDelta = $endBytes - $startBytes
$hasClosingHtml = $newContent.TrimEnd().EndsWith("</html>")
$hasScriptTag = $newContent.Contains($scriptTag)
$noOrphanedVd = -not $newContent.Contains("const VD = {")
$noOrphanedBp = -not $newContent.Contains("const OEM_BOLT_PATTERNS = {")

Write-Host ""
Write-Host "After:  $endLines lines (delta $lineDelta), $endBytes chars (delta $byteDelta)"
Write-Host "  Ends with </html>:           $hasClosingHtml"
Write-Host "  Script tag inserted:         $hasScriptTag"
Write-Host "  VD constant removed:         $noOrphanedVd"
Write-Host "  OEM_BOLT_PATTERNS removed:   $noOrphanedBp"
Write-Host ""

if (-not $hasClosingHtml) {
  Write-Host "REFUSING TO WRITE: file no longer ends with </html>" -ForegroundColor Red; exit 1
}
if (-not $hasScriptTag) {
  Write-Host "REFUSING TO WRITE: script tag not inserted" -ForegroundColor Red; exit 1
}
if (-not $noOrphanedVd) {
  Write-Host "REFUSING TO WRITE: VD still defined inline" -ForegroundColor Red; exit 1
}
if (-not $noOrphanedBp) {
  Write-Host "REFUSING TO WRITE: OEM_BOLT_PATTERNS still defined inline" -ForegroundColor Red; exit 1
}
# Expect line delta between -1200 and -400 (removing ~900 lines, adding ~3)
if ($lineDelta -gt -400) {
  Write-Host "REFUSING TO WRITE: line delta $lineDelta higher than expected (extraction too small?)" -ForegroundColor Red; exit 1
}
if ($lineDelta -lt -1200) {
  Write-Host "REFUSING TO WRITE: line delta $lineDelta lower than expected (extracted too much?)" -ForegroundColor Red; exit 1
}

# -- Backup, write index.html, write vehicle-db.js --------------------------
$backup = ".\index.html.bak-vehicledb-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item -Path $path -Destination $backup
Write-Host "Backup of index.html: $backup" -ForegroundColor Cyan

[System.IO.File]::WriteAllText((Resolve-Path $path), $newContent, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "index.html written ($endBytes chars, down from $startBytes)" -ForegroundColor Green

$dbPath = ".\vehicle-db.js"
[System.IO.File]::WriteAllText((Join-Path (Get-Location) "vehicle-db.js"), $dbContent, (New-Object System.Text.UTF8Encoding($false)))
$dbBytes = $dbContent.Length
$dbLines = ($dbContent -split "`n").Count
Write-Host "vehicle-db.js written ($dbBytes chars, $dbLines lines)" -ForegroundColor Green
Write-Host ""

Write-Host "WHAT THIS DOES:" -ForegroundColor Yellow
Write-Host "  - HTML is now $byteDelta chars smaller. Browser finishes parsing faster."
Write-Host "  - vehicle-db.js loads in parallel with HTML parse (defer)."
Write-Host "  - All functions that use VD/OEM_SIZES/etc. run on user interaction or"
Write-Host "    DOMContentLoaded - both happen AFTER deferred scripts load."
Write-Host ""
Write-Host "EXPECTED LCP IMPROVEMENT: -0.5 to -1.5 seconds on mobile" -ForegroundColor Yellow
Write-Host "  (Smaller HTML = faster parse = first contentful paint sooner.)"
Write-Host ""
Write-Host "CRITICAL TEST BEFORE PUSH:" -ForegroundColor Red
Write-Host "  1. Open .\index.html in browser"
Write-Host "  2. Vehicle tab: select Year + Make + Model + Trim, click Search."
Write-Host "     If dropdowns are empty or button does nothing, the extraction broke."
Write-Host "  3. Wheels tab > Search by Vehicle: same test."
Write-Host "  4. VIN tab: paste a real VIN, click Decode. Should show vehicle + tire size."
Write-Host "  5. Open Tire Selection Guide (sidebar): try the 'By My Vehicle' path."
Write-Host "  If ANYTHING is broken, rollback both files (commands below)."
Write-Host ""
Write-Host "ROLLBACK (run BOTH lines):" -ForegroundColor Cyan
Write-Host "  Copy-Item -Force $backup .\index.html"
Write-Host "  Remove-Item .\vehicle-db.js"
Write-Host ""
Write-Host "DON'T FORGET when pushing: vehicle-db.js is a NEW file - make sure" -ForegroundColor Yellow
Write-Host "push-pctires.ps1 picks it up (your script should include all *.js files;"
Write-Host "if it filters by name, you may need to add 'vehicle-db.js' explicitly)."
