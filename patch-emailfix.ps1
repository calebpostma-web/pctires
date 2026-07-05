# patch-emailfix.ps1 -- PC Tires checkout email fix (2026-07-05)
#
# BUG (reproduced live against pctires.ca/create-pi):
#   Stripe rejects the ENTIRE PaymentIntent when receipt_email is blank or
#   malformed (e.g. "name@gmail", stray space). Customer sees "Invalid email
#   address: ..." at the payment step and NOTHING appears in Stripe, because
#   the PaymentIntent is never created.
#
# FIX 1: functions/create-pi.js -- attach receipt_email only when it looks
#        valid; otherwise omit it (it is optional on Stripe's side).
# FIX 2: index.html step 1 -- validate email FORMAT before the customer can
#        continue (previously only checked non-empty).
#
# Run:
#   cd C:\Users\Caleb\Documents\Claude\Projects\PCtires
#   .\patch-emailfix.ps1
# Then deploy:
#   .\push-pctires.ps1

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\Caleb\Documents\Claude\Projects\PCtires'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$fail = $false

# ================= FIX 1: functions/create-pi.js =================
$f1 = 'functions\create-pi.js'
$raw1 = [System.IO.File]::ReadAllText((Resolve-Path $f1).Path)
$nl1 = "`n"; if ($raw1.Contains("`r`n")) { $nl1 = "`r`n" }

$old1 = @'
      receipt_email: customerEmail || '',
'@
$old1 = $old1.Trim("`r", "`n")

$anchor1 = @'
    const stripeHeaders = {
'@
$anchor1 = $anchor1.Trim("`r", "`n")

$block1 = @(
  '    // Stripe rejects the ENTIRE PaymentIntent if receipt_email is malformed',
  '    // (a customer typo like "name@gmail" killed checkout and nothing ever',
  '    // reached Stripe). Attach receipt_email only when it looks valid.',
  '    const cleanEmail = (customerEmail || '''').trim();',
  '    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {',
  '      body.set(''receipt_email'', cleanEmail);',
  '    }',
  ''
) -join $nl1

if (-not $raw1.Contains($old1)) {
  Write-Host 'FAIL: create-pi.js receipt_email line not found (already patched?)' -ForegroundColor Red
  $fail = $true
} elseif (-not $raw1.Contains($anchor1)) {
  Write-Host 'FAIL: create-pi.js stripeHeaders anchor not found' -ForegroundColor Red
  $fail = $true
} else {
  Copy-Item $f1 "$f1.bak-emailfix-$stamp"
  $raw1 = $raw1.Replace($old1 + $nl1, '')
  $raw1 = $raw1.Replace($anchor1, $block1 + $anchor1)
  [System.IO.File]::WriteAllText((Resolve-Path $f1).Path, $raw1)
  Write-Host "OK: create-pi.js patched (backup: $f1.bak-emailfix-$stamp)" -ForegroundColor Green
}

# ---- Verify create-pi.js as ESM (.mjs) ----
if (-not $fail) {
  $tmp = Join-Path $env:TEMP 'create-pi-check.mjs'
  Copy-Item $f1 $tmp -Force
  node --check $tmp
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'FAIL: node --check rejected patched create-pi.js -- RESTORING BACKUP' -ForegroundColor Red
    Copy-Item "$f1.bak-emailfix-$stamp" $f1 -Force
    $fail = $true
  } else {
    Write-Host 'OK: node --check passed on create-pi.js (as .mjs)' -ForegroundColor Green
  }
  Remove-Item $tmp -ErrorAction SilentlyContinue
}

# ================= FIX 2: index.html step-1 validation =================
$f2 = 'index.html'
$raw2 = [System.IO.File]::ReadAllText((Resolve-Path $f2).Path)
$linesBefore = ([System.IO.File]::ReadAllLines((Resolve-Path $f2).Path)).Count

$old2 = @'
  if (step === 1 && !document.getElementById('email').value) { alert('Please enter your email address.'); return; }
'@
$old2 = $old2.Trim("`r", "`n")

$new2 = @'
  if (step === 1) { var _em = (document.getElementById('email').value || '').trim(); document.getElementById('email').value = _em; if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(_em)) { alert('Please enter a valid email address (like name@example.com).'); return; } }
'@
$new2 = $new2.Trim("`r", "`n")

$count2 = ([regex]::Matches($raw2, [regex]::Escape($old2))).Count
if ($count2 -ne 1) {
  Write-Host "FAIL: index.html step-1 email line found $count2 times (expected 1)" -ForegroundColor Red
  $fail = $true
} else {
  Copy-Item $f2 "$f2.bak-emailfix-$stamp"
  $raw2 = $raw2.Replace($old2, $new2)
  [System.IO.File]::WriteAllText((Resolve-Path $f2).Path, $raw2)
  $linesAfter = ([System.IO.File]::ReadAllLines((Resolve-Path $f2).Path)).Count
  if ($linesAfter -ne $linesBefore) {
    Write-Host "FAIL: index.html line count changed ($linesBefore -> $linesAfter) -- RESTORING BACKUP" -ForegroundColor Red
    Copy-Item "$f2.bak-emailfix-$stamp" $f2 -Force
    $fail = $true
  } else {
    Write-Host "OK: index.html patched, line count unchanged ($linesAfter)" -ForegroundColor Green
  }
}

# ================= Final structural checks =================
if (-not $fail) {
  $chk1 = [System.IO.File]::ReadAllText((Resolve-Path $f1).Path)
  $chk2 = [System.IO.File]::ReadAllText((Resolve-Path $f2).Path)
  $ok1 = $chk1.Contains('body.set(''receipt_email''') -and (-not $chk1.Contains('receipt_email: customerEmail'))
  $ok2 = $chk2.Contains('valid email address (like name@example.com)')
  if ($ok1 -and $ok2) {
    Write-Host ''
    Write-Host 'ALL CHECKS PASSED. Deploy with: .\push-pctires.ps1' -ForegroundColor Green
  } else {
    Write-Host "FAIL: final content check (create-pi: $ok1, index: $ok2)" -ForegroundColor Red
    $fail = $true
  }
}

if ($fail) { Write-Host 'PATCH DID NOT FULLY APPLY -- see messages above. Backups untouched.' -ForegroundColor Red; exit 1 }
