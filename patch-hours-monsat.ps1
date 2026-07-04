# patch-hours-monsat.ps1
# Updates store hours everywhere to Monday-Saturday 8am-6pm, Sunday closed.
# Fixes the inconsistency between pages (some said 5:30, some said 4pm Saturday close).
# Touches: index.html (JSON-LD schema + visible hours widget), returns.html,
#          swap.html, farm-tires.html, trailer-tires.html, used-tires.html
# Run from the PCtires folder:  .\patch-hours-monsat.ps1

$ErrorActionPreference = "Stop"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

function Patch-File {
    param(
        [string]$FileName,
        [string[]]$OldStrings,
        [string[]]$NewStrings
    )

    $file = Join-Path $PSScriptRoot $FileName
    if (-not (Test-Path $file)) {
        Write-Host "SKIP: $FileName not found" -ForegroundColor Yellow
        return $true
    }

    $backup = "$file.bak-hours-$stamp"
    Copy-Item $file $backup
    Write-Host "Backup created: $backup"

    $content = Get-Content $file -Raw -Encoding UTF8

    for ($i = 0; $i -lt $OldStrings.Count; $i++) {
        $old = $OldStrings[$i]
        $new = $NewStrings[$i]
        $count = ([regex]::Matches($content, [regex]::Escape($old))).Count
        if ($count -ne 1) {
            Write-Host "FAIL ($FileName): expected 1 match, found $count for:" -ForegroundColor Red
            Write-Host "  $old" -ForegroundColor Red
            Write-Host "Aborting this file, no changes written." -ForegroundColor Red
            return $false
        }
        $content = $content.Replace($old, $new)
    }

    [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

    # Verify: new strings should now be present, old strings gone
    $check = Get-Content $file -Raw -Encoding UTF8
    $fail = $false
    foreach ($new in $NewStrings) {
        $n = ([regex]::Matches($check, [regex]::Escape($new))).Count
        if ($n -lt 1) { Write-Host "VERIFY FAIL ($FileName): expected text not found: $new" -ForegroundColor Red; $fail = $true }
    }
    foreach ($old in $OldStrings) {
        $n = ([regex]::Matches($check, [regex]::Escape($old))).Count
        if ($n -ne 0) { Write-Host "VERIFY FAIL ($FileName): old text still present: $old" -ForegroundColor Red; $fail = $true }
    }

    if ($fail) {
        Copy-Item $backup $file -Force
        Write-Host "Restored $FileName from backup. No changes kept." -ForegroundColor Red
        return $false
    }

    Write-Host "OK: $FileName patched and verified." -ForegroundColor Green
    return $true
}

$dash = [char]0x2013   # en dash "-"
$mid  = [char]0x00B7   # middle dot "."

$allOk = $true

# --- index.html: JSON-LD openingHoursSpecification ---
$oldJsonLd = @"
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday"
      ],
      "opens": "08:00",
      "closes": "18:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Saturday",
      "opens": "08:00",
      "closes": "16:00"
    }
  ],
"@
$newJsonLd = @"
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
      ],
      "opens": "08:00",
      "closes": "18:00"
    }
  ],
"@

# --- index.html: visible hours widget ---
$oldHoursWidget = "          <div class=`"hours-row today`"><span>Mon${dash}Fri</span><span>8am ${dash} 6pm</span></div>`n          <div class=`"hours-row`"><span>Saturday</span><span>8am ${dash} 4pm</span></div>"
$newHoursWidget = "          <div class=`"hours-row today`"><span>Mon${dash}Sat</span><span>8am ${dash} 6pm</span></div>"

$allOk = (Patch-File -FileName "index.html" `
    -OldStrings @($oldJsonLd, $oldHoursWidget) `
    -NewStrings @($newJsonLd, $newHoursWidget)) -and $allOk

# --- returns.html ---
$allOk = (Patch-File -FileName "returns.html" `
    -OldStrings @("Hours: Mon${dash}Fri 8:00${dash}5:30, Sat 8:00${dash}4:00") `
    -NewStrings @("Hours: Mon${dash}Sat 8:00${dash}6:00")) -and $allOk

# --- swap.html ---
$allOk = (Patch-File -FileName "swap.html" `
    -OldStrings @("Mon${dash}Fri 8am${dash}6pm ${mid} Sat 8am${dash}4pm ${mid} Sun Closed") `
    -NewStrings @("Mon${dash}Sat 8am${dash}6pm ${mid} Sun Closed")) -and $allOk

# --- farm-tires.html / trailer-tires.html / used-tires.html (same snippet in all three) ---
$oldFhours = "Mon${dash}Fri 8${dash}5:30 ${mid} Sat 8${dash}4 ${mid} Sun closed"
$newFhours = "Mon${dash}Sat 8${dash}6 ${mid} Sun closed"

foreach ($f in @("farm-tires.html", "trailer-tires.html", "used-tires.html")) {
    $allOk = (Patch-File -FileName $f -OldStrings @($oldFhours) -NewStrings @($newFhours)) -and $allOk
}

Write-Host ""
if ($allOk) {
    Write-Host "ALL FILES PATCHED OK. Hours are now Mon-Sat 8am-6pm, Sunday closed, everywhere." -ForegroundColor Green
    Write-Host "Remember: also update Saturday hours to 8am-6pm in your Google Business Profile dashboard directly - this script only touches the website." -ForegroundColor Yellow
    Write-Host "Deploy with:  .\push-pctires.ps1" -ForegroundColor Green
} else {
    Write-Host "ONE OR MORE FILES FAILED - review messages above. Files that failed were restored from backup; files that succeeded were NOT rolled back." -ForegroundColor Red
}
