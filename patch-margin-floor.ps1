# patch-margin-floor.ps1
# Adds a $20 minimum profit floor per tire/wheel that survives the 10% member discount.
# New retail = max(cost * 1.35, (cost + 20) / 0.9). MAP override still applies if higher.
# Run from the PCtires repo root:  .\patch-margin-floor.ps1
# Then deploy with:                .\push-pctires.ps1

$ErrorActionPreference = "Stop"
$file = Join-Path $PSScriptRoot "index.html"

if (-not (Test-Path $file)) { Write-Host "ERROR: index.html not found next to this script." -ForegroundColor Red; exit 1 }

$content = [System.IO.File]::ReadAllText($file)
$origLen = $content.Length

# Detect newline style
$nl = "`n"
if ($content.Contains("`r`n")) { $nl = "`r`n" }

# ---------- Pre-checks ----------
$anchor1 = "  MEMBER_DISCOUNT: 0.10,"
$anchor2 = "  let price = item.price * TDG.MARKUP;"
$anchor3 = "  return Math.max(cost * TDG.MARKUP, w.map || 0);"

foreach ($a in @($anchor1, $anchor2, $anchor3)) {
    $count = ([regex]::Matches($content, [regex]::Escape($a))).Count
    if ($count -ne 1) {
        Write-Host "ERROR: expected exactly 1 occurrence of anchor, found $count :" -ForegroundColor Red
        Write-Host "  $a"
        Write-Host "File NOT modified." -ForegroundColor Yellow
        exit 1
    }
}
if ($content.Contains("MIN_MARGIN")) {
    Write-Host "ERROR: MIN_MARGIN already present - patch appears to be applied. File NOT modified." -ForegroundColor Red
    exit 1
}
Write-Host "Pre-checks passed (all 3 anchors found exactly once)." -ForegroundColor Green

# ---------- Backup ----------
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $PSScriptRoot ("index.html.bak-marginfloor-" + $stamp)
[System.IO.File]::WriteAllText($backup, $content)
Write-Host "Backup written: $backup" -ForegroundColor Green

# ---------- Patch 1: add MIN_MARGIN to TDG config ----------
$new1 = $anchor1 + $nl + "  MIN_MARGIN:      20,   // minimum dollars kept per tire/wheel, survives member discount"
$content = $content.Replace($anchor1, $new1)

# ---------- Patch 2: tire/wheel retailPrice() floor ----------
$new2 = $anchor2 + $nl + `
        "  const _floor = (item.price + TDG.MIN_MARGIN) / (1 - TDG.MEMBER_DISCOUNT);" + $nl + `
        "  if (_floor > price) price = _floor;"
$content = $content.Replace($anchor2, $new2)

# ---------- Patch 3: wheelRetailPrice() floor (used for filter/sort consistency) ----------
$new3 = "  return Math.max(cost * TDG.MARKUP, (cost + TDG.MIN_MARGIN) / (1 - TDG.MEMBER_DISCOUNT), w.map || 0);"
$content = $content.Replace($anchor3, $new3)

# ---------- Verify ----------
$ok = $true
if (([regex]::Matches($content, "MIN_MARGIN")).Count -ne 3) { $ok = $false; Write-Host "VERIFY FAIL: expected 3 MIN_MARGIN references." -ForegroundColor Red }
if ($content.Contains($anchor3)) { $ok = $false; Write-Host "VERIFY FAIL: old wheelRetailPrice line still present." -ForegroundColor Red }
if (-not $content.Contains("if (_floor > price) price = _floor;")) { $ok = $false; Write-Host "VERIFY FAIL: retailPrice floor not inserted." -ForegroundColor Red }
if ([Math]::Abs($content.Length - $origLen) -gt 600) { $ok = $false; Write-Host "VERIFY FAIL: file size changed too much - aborting." -ForegroundColor Red }

if (-not $ok) {
    Write-Host "File NOT modified. Original is untouched, backup also at $backup" -ForegroundColor Yellow
    exit 1
}

[System.IO.File]::WriteAllText($file, $content)
Write-Host "index.html patched OK." -ForegroundColor Green

# ---------- Sanity math printout ----------
Write-Host ""
Write-Host "Price floor examples (cost -> sticker -> member pays -> you keep):" -ForegroundColor Cyan
foreach ($cost in @(55, 68.89, 80, 93, 111, 148)) {
    $old = [Math]::Round($cost * 1.35, 2)
    $floor = [Math]::Round(($cost + 20) / 0.9, 2)
    $sticker = [Math]::Max($old, $floor)
    $member = [Math]::Round($sticker * 0.9, 2)
    $keep = [Math]::Round($member - $cost, 2)
    $changed = ""
    if ($floor -gt $old) { $changed = "  (was $old)" }
    Write-Host ("  cost {0,7:N2} -> sticker {1,7:N2} -> member {2,7:N2} -> keep {3,6:N2}{4}" -f $cost, $sticker, $member, $keep, $changed)
}
Write-Host ""
Write-Host "Done. Review, then deploy with .\push-pctires.ps1" -ForegroundColor Cyan
