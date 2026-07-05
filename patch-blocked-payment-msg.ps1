# patch-blocked-payment-msg.ps1 -- friendly message when a customer's device
# blocks Stripe (2026-07-05)
#
# WHY: Customer saw Stripe's raw "We are experiencing issues connecting to our
# payments provider" -- a dead end caused by HER device (ad blocker / VPN /
# private DNS), not the site. Instead of a wall, show a way to buy.
#
# WHAT: In processPayment's catch block, when the error is Stripe's
# connectivity failure (or "Payment form not ready", same root cause), show:
#   "...blocking our payment connection... Call us at 519-397-4686 and we
#    will take your order by phone or e-transfer."
# with a tap-to-call link (92% of traffic is mobile). All other errors are
# shown unchanged. The alert-email beacon still reports the RAW error.
#
# Run:
#   cd C:\Users\Caleb\Documents\Claude\Projects\PCtires
#   .\patch-blocked-payment-msg.ps1
# Then deploy:
#   .\push-pctires.ps1

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\Caleb\Documents\Claude\Projects\PCtires'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$fail = $false

$f = 'index.html'
$raw = [System.IO.File]::ReadAllText((Resolve-Path $f).Path)
$nl = "`n"; if ($raw.Contains("`r`n")) { $nl = "`r`n" }
$linesBefore = ([System.IO.File]::ReadAllLines((Resolve-Path $f).Path)).Count

$oldIf = @'
    if (errEl) { errEl.textContent = e.message; errEl.style.display = 'block'; }
'@
$oldIf = $oldIf.Trim("`r", "`n")

$oldElse = @'
    else alert('Payment failed: ' + e.message);
'@
$oldElse = $oldElse.Trim("`r", "`n")

$newBlock = @(
  '    var _blockedMsg = ''It looks like your device or browser is blocking our payment connection (usually an ad blocker, VPN, or privacy setting). Call us at 519-397-4686 and we will take your order by phone or e-transfer.'';',
  '    var _isBlocked = /issues? connecting|payment form not ready/i.test(String(e.message || ''''));',
  '    if (errEl) {',
  '      if (_isBlocked) { errEl.innerHTML = _blockedMsg.replace(''519-397-4686'', ''<a href="tel:5193974686" style="color:inherit;font-weight:700;text-decoration:underline">519-397-4686</a>''); }',
  '      else { errEl.textContent = e.message; }',
  '      errEl.style.display = ''block'';',
  '    } else {',
  '      alert(''Payment failed: '' + (_isBlocked ? _blockedMsg : e.message));',
  '    }'
) -join $nl

$cIf   = ([regex]::Matches($raw, [regex]::Escape($oldIf))).Count
$cElse = ([regex]::Matches($raw, [regex]::Escape($oldElse))).Count

if ($cIf -ne 1 -or $cElse -ne 1) {
  Write-Host "FAIL: anchors not unique (if-line: $cIf, else-line: $cElse; both must be 1) -- NOT patching" -ForegroundColor Red
  $fail = $true
} else {
  Copy-Item $f "$f.bak-blockedmsg-$stamp"
  $raw = $raw.Replace($oldElse + $nl, '')
  $raw = $raw.Replace($oldIf, $newBlock)
  [System.IO.File]::WriteAllText((Resolve-Path $f).Path, $raw)

  $linesAfter = ([System.IO.File]::ReadAllLines((Resolve-Path $f).Path)).Count
  $chk = [System.IO.File]::ReadAllText((Resolve-Path $f).Path)
  $okNew = ([regex]::Matches($chk, [regex]::Escape('_isBlocked'))).Count -eq 3
  $okOldGone = -not $chk.Contains($oldElse)

  if ((($linesAfter - $linesBefore) -ne 7) -or (-not $okNew) -or (-not $okOldGone)) {
    Write-Host "FAIL: verification (delta $($linesAfter - $linesBefore) expected +7, newCode: $okNew, oldGone: $okOldGone) -- RESTORING BACKUP" -ForegroundColor Red
    Copy-Item "$f.bak-blockedmsg-$stamp" $f -Force
    $fail = $true
  } else {
    Write-Host "OK: index.html patched (+7 lines, $linesAfter total; backup $f.bak-blockedmsg-$stamp)" -ForegroundColor Green
    Write-Host ''
    Write-Host 'ALL CHECKS PASSED. Deploy with: .\push-pctires.ps1' -ForegroundColor Green
  }
}

if ($fail) { Write-Host 'PATCH DID NOT FULLY APPLY -- see messages above.' -ForegroundColor Red; exit 1 }
