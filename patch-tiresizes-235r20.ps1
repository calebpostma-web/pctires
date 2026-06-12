# patch-tiresizes-235r20.ps1
# Adds missing 235-width 20"/21" sizes to TIRE_SIZES in index.html
# Sizes added: 235/40R20, 235/45R20, 235/45R21, 235/50R20, 235/55R20, 235/60R20
# Run from the PCtires folder:  .\patch-tiresizes-235r20.ps1

$ErrorActionPreference = "Stop"
$file = Join-Path $PSScriptRoot "index.html"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$file.bak-tiresizes-$stamp"

# --- Backup ---
Copy-Item $file $backup
Write-Host "Backup created: $backup"

$content = Get-Content $file -Raw -Encoding UTF8
$origLen = $content.Length

# --- Replacements (exact substring, applied once each) ---
$pairs = @(
    @("'235/40R19','235/45R15'", "'235/40R19','235/40R20','235/45R15'"),
    @("'235/45R19','235/50R13'", "'235/45R19','235/45R20','235/45R21','235/50R13'"),
    @("'235/50R19','235/55R13'", "'235/50R19','235/50R20','235/55R13'"),
    @("'235/55R19','235/60R13'", "'235/55R19','235/55R20','235/60R13'"),
    @("'235/60R19','235/65R13'", "'235/60R19','235/60R20','235/65R13'")
)

foreach ($p in $pairs) {
    $old = $p[0]; $new = $p[1]
    $count = ([regex]::Matches($content, [regex]::Escape($old))).Count
    if ($count -ne 1) {
        Write-Host "FAIL: expected 1 match for [$old], found $count. Aborting, no changes written." -ForegroundColor Red
        exit 1
    }
    $content = $content.Replace($old, $new)
}

# --- Write ---
[System.IO.File]::WriteAllText($file, $content, (New-Object System.Text.UTF8Encoding $false))

# --- Verify ---
$check = Get-Content $file -Raw -Encoding UTF8
$fail = $false
foreach ($sz in @("235/40R20","235/45R20","235/45R21","235/50R20","235/55R20","235/60R20")) {
    $n = ([regex]::Matches($check, [regex]::Escape("'$sz'"))).Count
    if ($n -ne 1) { Write-Host "VERIFY FAIL: '$sz' appears $n times (expected 1)" -ForegroundColor Red; $fail = $true }
    else { Write-Host "OK: '$sz' present" }
}

$grew = $check.Length - $origLen
Write-Host "File grew by $grew chars (expected 72)"
if ($grew -ne 72) { Write-Host "VERIFY FAIL: unexpected size change" -ForegroundColor Red; $fail = $true }

if ($fail) {
    Copy-Item $backup $file -Force
    Write-Host "Restored from backup. No changes kept." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "PATCH OK. Deploy with:  .\push-pctires.ps1" -ForegroundColor Green
