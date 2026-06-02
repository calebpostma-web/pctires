# patch-scheduling.ps1 - PC Tires checkout scheduling: London-aware lead time
# Run from C:\Users\Caleb\Documents\Claude\Projects\PCtires
# Backs up index.html with a timestamp, then applies 7 literal edits.

$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot 'index.html'
if (-not (Test-Path $path)) { Write-Host "ERROR: index.html not found at $path" -ForegroundColor Red; exit 1 }

# --- Read file as UTF-8 (no BOM), preserving CRLF ---
$utf8 = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText($path, $utf8)
$origLen = $content.Length
$origLines = ($content -split "`n").Length
Write-Host "Read $origLines lines, $origLen chars."

# --- Backup ---
$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$backup = "$path.bak.$ts"
[System.IO.File]::Copy($path, $backup, $false)
Write-Host "Backup: $backup"

# --- Unicode anchors built at runtime so this script stays pure ASCII ---
$em  = [char]::ConvertFromUtf32(0x2014)   # em-dash
$pkg = [char]::ConvertFromUtf32(0x1F4E6)  # package emoji

# Helper: assert + replace
function Apply-Edit($label, $old, $new) {
  if (-not $script:content.Contains($old)) {
    Write-Host "ABORT: anchor for '$label' not found." -ForegroundColor Red
    Write-Host "Restoring from backup is automatic - nothing was written yet."
    exit 2
  }
  $count = ([regex]::Matches($script:content, [regex]::Escape($old))).Count
  if ($count -gt 1) {
    Write-Host "ABORT: anchor for '$label' matched $count times (expected 1)." -ForegroundColor Red
    exit 3
  }
  $script:content = $script:content.Replace($old, $new)
  Write-Host "  OK  $label"
}

# ===== EDIT 1: replace flat constants line with London-aware constants + helpers =====
$old1 = 'const INSTALL_LEAD_BUSINESS_DAYS = 1;   // earliest install = today + 1 business day'
$new1 = @(
'// London DC (TDG warehouse 6) is our local servicing branch. Order by 1 PM to make todays',
'// outbound truck so tires arrive same afternoon - install always next business day at earliest.',
'// Orangeville and other DCs need an extra business day to transfer to London first.',
'const LONDON_LOCATION_ID          = 6;',
'const LOCAL_LEAD_BUSINESS_DAYS    = 1;   // London stock: install next business day',
'const NONLOCAL_LEAD_BUSINESS_DAYS = 2;   // ships from elsewhere: one extra business day',
'const TRUCK_CUTOFF_HOUR           = 13;  // order by 1 PM to make todays London->shop truck',
'let   _calAutoPickPending = true;        // reset to true each time the checkout opens',
'',
'function isLondonLocation(loc) {',
'  if (!loc) return false;',
"  if (loc.locationId === LONDON_LOCATION_ID) return true;",
"  return /london/i.test(loc.locationName || loc.name || '');",
'}',
'function londonQtyForItem(item) {',
'  const locs = (item && item.locations) || [];',
'  const london = locs.find(isLondonLocation);',
'  return london ? (london.qtyAvailable || 0) : 0;',
'}',
'function cartFullyLocal() {',
'  if (!cart || !cart.length) return true;',
'  return cart.every(function(item) { return londonQtyForItem(item) >= (item.qty || 1); });',
'}'
) -join "`r`n"
Apply-Edit 'constants + London helpers' $old1 $new1

# ===== EDIT 2: rewrite getEarliestInstallDate to be cart-aware =====
$old2 = @(
'function getEarliestInstallDate() {',
'  const today = new Date(); today.setHours(0,0,0,0);',
'  // If it''s already past 2 PM, a same-day TDG order likely won''t ship until tomorrow',
('  // ' + $em + ' push the lead-time clock forward by one day.'),
'  const startFrom = (new Date().getHours() >= 14)',
'    ? (() => { const d = new Date(today); d.setDate(d.getDate()+1); return d; })()',
'    : today;',
'  return addBusinessDays(startFrom, INSTALL_LEAD_BUSINESS_DAYS);',
'}'
) -join "`r`n"

$new2 = @(
'function getEarliestInstallDate() {',
'  const now = new Date();',
'  const today = new Date(now); today.setHours(0,0,0,0);',
'  const dow = now.getDay();          // 0 = Sun, 6 = Sat',
'  const pastCutoff = now.getHours() >= TRUCK_CUTOFF_HOUR;',
'  // Move the start-of-clock forward when TDG cant ship today:',
'  //   - past 1 PM, missed todays last truck',
'   //   - weekend, TDG isn''t shipping',
'  let startFrom = new Date(today);',
'  if (pastCutoff || dow === 0 || dow === 6) {',
'    do { startFrom.setDate(startFrom.getDate() + 1); }',
'    while (startFrom.getDay() === 0 || startFrom.getDay() === 6);',
'  }',
'  const leadDays = cartFullyLocal() ? LOCAL_LEAD_BUSINESS_DAYS : NONLOCAL_LEAD_BUSINESS_DAYS;',
'  return addBusinessDays(startFrom, leadDays);',
'}'
) -join "`r`n"
Apply-Edit 'getEarliestInstallDate (cart-aware)' $old2 $new2

# ===== EDIT 3: calendar disables Sat AND Sun (was Sun only) =====
$old3 = '    const dt = new Date(calY, calMo, d), past = dt < minDate, sun = dt.getDay() === 0, dis = past || sun;'
$new3 = '    const dt = new Date(calY, calMo, d), past = dt < minDate, wknd = (dt.getDay() === 0 || dt.getDay() === 6), dis = past || wknd;'
Apply-Edit 'calendar Sat+Sun disabled' $old3 $new3

# ===== EDIT 4: lead-time note now explains the warehouse situation =====
$old4 = '    leadNote.innerHTML = `<b>' + $pkg + ' Earliest install: ${earliest}</b> ' + $em + ' tires typically arrive by late morning. First-day slots start at ${h12}:00 ${ampm}.`;'
$new4 = @(
"    const _localFlag = cartFullyLocal();",
"    const _reason = _localFlag",
"      ? 'shipping from our local London warehouse'",
"      : 'one or more items ship from outside London (one extra business day for the transfer)';",
"    leadNote.innerHTML = '<b>Earliest install: ' + earliest + '</b> &mdash; ' + _reason + '. First-day slots start at ' + h12 + ':00 ' + ampm + '.';"
) -join "`r`n"
Apply-Edit 'lead-time note copy + cart-aware reason' $old4 $new4

# ===== EDIT 5: auto-pick the earliest valid date when the calendar first opens =====
$old5 = '  const minDate = getEarliestInstallDate();'
$new5 = @(
'  const minDate = getEarliestInstallDate();',
'  // Auto-pick the earliest valid day on initial open (reset by openCheckout/selectService).',
'  if (_calAutoPickPending) {',
'    _calAutoPickPending = false;',
'    if (calY !== minDate.getFullYear() || calMo !== minDate.getMonth()) {',
'      calY = minDate.getFullYear(); calMo = minDate.getMonth();',
"      document.getElementById('calMo').textContent = MONTHS[calMo] + ' ' + calY;",
'    }',
"    selDate = MONTHS[minDate.getMonth()] + ' ' + minDate.getDate() + ', ' + minDate.getFullYear();",
'  }'
) -join "`r`n"
Apply-Edit 'auto-pick earliest date in buildCal' $old5 $new5

# ===== EDIT 6: openCheckout resets the auto-pick flag =====
$old6 = "function openCheckout() { closeCart(); step = 1; selectedAddons = new Set(); updSteps(); document.getElementById('checkoutOverlay').classList.add('show'); }"
$new6 = "function openCheckout() { closeCart(); step = 1; selectedAddons = new Set(); _calAutoPickPending = true; updSteps(); document.getElementById('checkoutOverlay').classList.add('show'); }"
Apply-Edit 'openCheckout resets auto-pick flag' $old6 $new6

# ===== EDIT 7: selectService resets the auto-pick flag too =====
$old7 = '  selDate = null; selTime = null; buildCal();'
$new7 = '  selDate = null; selTime = null; _calAutoPickPending = true; buildCal();'
Apply-Edit 'selectService resets auto-pick flag' $old7 $new7

# --- Sanity checks before writing ---
$newLines = ($content -split "`n").Length
$delta = $newLines - $origLines
Write-Host "Line delta: +$delta lines (expected roughly +35 to +50)."
if ($delta -lt 20 -or $delta -gt 70) {
  Write-Host "ABORT: line delta $delta is outside expected range." -ForegroundColor Red
  exit 4
}
if (-not $content.StartsWith('<!DOCTYPE html>')) {
  Write-Host "ABORT: file no longer starts with <!DOCTYPE html>" -ForegroundColor Red
  exit 5
}
if (-not $content.TrimEnd().EndsWith('</html>')) {
  Write-Host "ABORT: file no longer ends with </html>" -ForegroundColor Red
  exit 6
}
$openScript  = ([regex]::Matches($content, '<script')).Count
$closeScript = ([regex]::Matches($content, '</script>')).Count
if ($openScript -ne $closeScript) {
  Write-Host "ABORT: script tag mismatch ($openScript open, $closeScript close)" -ForegroundColor Red
  exit 7
}

# --- Write back as UTF-8 no BOM, preserving line endings already in $content ---
[System.IO.File]::WriteAllText($path, $content, $utf8)
Write-Host ""
Write-Host "SUCCESS - wrote $($content.Length) chars, $newLines lines." -ForegroundColor Green
Write-Host "Rollback if needed:  Copy-Item '$backup' '$path' -Force"
Write-Host ""
Write-Host "Next:  test the checkout flow locally, then .\push-pctires.ps1"
