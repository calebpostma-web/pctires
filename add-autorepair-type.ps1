# add-autorepair-type.ps1
# Updates the homepage's main JSON-LD schema from
#   "@type": "AutoPartsStore"
# to:
#   "@type": ["AutoPartsStore", "AutoRepair"]
#
# Why: PC Tires both SELLS auto parts (tires) and PERFORMS auto service
# (installation, TPMS, changeover). Multi-type tells Google both things,
# expanding the queries you can rank for.

$path = ".\index.html"

if (-not (Test-Path $path)) {
  Write-Host "FAIL: $path not found" -ForegroundColor Red
  exit 1
}

$content = [System.IO.File]::ReadAllText((Resolve-Path $path), [System.Text.Encoding]::UTF8)
$startBytes = $content.Length
$startLines = ($content -split "`n").Count
Write-Host "Before: $startLines lines, $startBytes chars" -ForegroundColor Cyan
Write-Host ""

# Single-line pattern - works regardless of CRLF or LF line endings
$old = '"@type": "AutoPartsStore",'
$new = '"@type": ["AutoPartsStore", "AutoRepair"],'

$count = ([regex]::Matches($content, [regex]::Escape($old))).Count

if ($count -eq 0) {
  Write-Host "FAIL: did not find the pattern (already patched? or schema changed?)" -ForegroundColor Red
  Write-Host "Looking for: $old" -ForegroundColor Yellow
  exit 1
}
if ($count -gt 1) {
  Write-Host "FAIL: expected exactly 1 occurrence, found $count" -ForegroundColor Red
  Write-Host "Refusing to patch (too risky). Inspect manually first." -ForegroundColor Yellow
  exit 1
}

$content = $content.Replace($old, $new)
Write-Host "OK    @type now: [AutoPartsStore, AutoRepair]" -ForegroundColor Green

$endBytes = $content.Length
$endLines = ($content -split "`n").Count
$lineDelta = $endLines - $startLines
$byteDelta = $endBytes - $startBytes
$hasClosingHtml = $content.TrimEnd().EndsWith("</html>")
$expectedDelta = $new.Length - $old.Length

Write-Host ""
Write-Host "After:  $endLines lines (delta $lineDelta), $endBytes chars (delta $byteDelta)"
Write-Host "Ends with </html>: $hasClosingHtml"
Write-Host ""

if (-not $hasClosingHtml) {
  Write-Host "REFUSING TO WRITE: file no longer ends with </html>" -ForegroundColor Red
  exit 1
}
if ($lineDelta -ne 0) {
  Write-Host "REFUSING TO WRITE: line count changed unexpectedly" -ForegroundColor Red
  exit 1
}
if ($byteDelta -ne $expectedDelta) {
  Write-Host "REFUSING TO WRITE: byte delta unexpected (got $byteDelta, expected $expectedDelta)" -ForegroundColor Red
  exit 1
}

$backup = ".\index.html.bak-autorepair-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item -Path $path -Destination $backup
Write-Host "Backup: $backup" -ForegroundColor Cyan

[System.IO.File]::WriteAllText((Resolve-Path $path), $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "index.html written successfully." -ForegroundColor Green
Write-Host ""
Write-Host "Push when ready:" -ForegroundColor Yellow
Write-Host "  .\push-pctires.ps1"
Write-Host ""
Write-Host "ROLLBACK: Copy-Item -Force $backup .\index.html" -ForegroundColor Cyan
