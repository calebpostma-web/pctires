# =============================================
#  patch-stripe-ready.ps1
#  Prevents the "Element not mounted / not ready" payment error
#  (Seth Burgoone, 2026-07-10): customer taps Pay before Stripe's
#  card form finishes loading on a slow mobile connection.
#
#  Two small changes to index.html:
#   1. Track Stripe's 'ready' event on the card element
#      (window._stripeReady flag).
#   2. Guard at the top of processPayment: if the form is not ready
#      yet, show a friendly "still loading - tap again in a second"
#      message and stop. No Stripe error, no failed-checkout alert,
#      no lost sale.
#
#  Safe to run before OR after patch-deposit-option.ps1 - the two
#  patches touch different lines.
#
#  RUN:
#    cd C:\Users\Caleb\Documents\Claude\Projects\PCtires
#    .\patch-stripe-ready.ps1
#  Then deploy with .\push-pctires.ps1
# =============================================

$dest = "C:\Users\Caleb\Documents\Claude\Projects\PCtires"
$indexPath = Join-Path $dest "index.html"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$bakDir = "C:\Users\Caleb\Documents\PCtires-quarantine\stripeready-backup-$stamp"

New-Item -ItemType Directory -Path $bakDir -Force | Out-Null
Copy-Item $indexPath (Join-Path $bakDir "index.html")
Write-Host "Backup saved to $bakDir" -ForegroundColor DarkGray

$failures = @()
function Replace-Once {
    param([string]$content, [string]$old, [string]$new, [string]$label)
    $old = $old.Replace("`r`n", "`n")
    $new = $new.Replace("`r`n", "`n")
    $count = ([regex]::Matches($content, [regex]::Escape($old))).Count
    if ($count -ne 1) {
        $script:failures += "$label (expected 1 match, found $count)"
        return $content
    }
    return $content.Replace($old, $new)
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$html = [IO.File]::ReadAllText($indexPath).Replace("`r`n", "`n")

# S1: track the card element's ready event
$old = @'
    stripeCard.mount('#stripeElements');
'@
$new = @'
    stripeCard.mount('#stripeElements');
    window._stripeReady = false;
    stripeCard.on('ready', function() {
      window._stripeReady = true;
      var _se = document.getElementById('stripeError');
      if (_se && _se.getAttribute('data-wait-msg') === '1') {
        _se.style.display = 'none'; _se.textContent = ''; _se.setAttribute('data-wait-msg', '');
      }
    });
'@
$html = Replace-Once $html $old $new "S1 ready listener"

# S2: guard in processPayment before the in-flight lock engages
$old = @'
  if (window._paymentInFlight) return;
  window._paymentInFlight = true;
'@
$new = @'
  if (window._paymentInFlight) return;
  if (!window._stripeReady) {
    var _se = document.getElementById('stripeError');
    if (_se) {
      _se.textContent = 'The secure payment form is still loading - give it a second and tap Pay again. If this does not clear, your browser may be blocking the payment connection: call 519-397-4686 and we will take your order by phone.';
      _se.style.display = 'block';
      _se.setAttribute('data-wait-msg', '1');
    }
    return;
  }
  window._paymentInFlight = true;
'@
$html = Replace-Once $html $old $new "S2 processPayment guard"

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "PATCH ABORTED - no files were changed. Anchor problems:" -ForegroundColor Red
    $failures | ForEach-Object { Write-Host "  ! $_" -ForegroundColor Red }
    Read-Host "Press Enter to close"
    exit 1
}

[IO.File]::WriteAllText($indexPath, $html, $utf8NoBom)
Write-Host "index.html written." -ForegroundColor Green

# Verify
$vFail = $false
$checks = @(
    @{ n = "_stripeReady references"; c = ([regex]::Matches($html, "_stripeReady")).Count; e = 3 },
    @{ n = "data-wait-msg refs";      c = ([regex]::Matches($html, "data-wait-msg")).Count; e = 3 }
)
foreach ($ch in $checks) {
    if ($ch.c -eq $ch.e) { Write-Host ("  OK  " + $ch.n + " = " + $ch.c) -ForegroundColor Green }
    else { Write-Host ("  BAD " + $ch.n + " = " + $ch.c + " (expected " + $ch.e + ")") -ForegroundColor Red; $vFail = $true }
}

if ($vFail) {
    Write-Host "VERIFICATION FAILED - restoring backup." -ForegroundColor Red
    Copy-Item (Join-Path $bakDir "index.html") $indexPath -Force
    Write-Host "Original restored. Nothing deployed." -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "PATCH APPLIED." -ForegroundColor Cyan
Write-Host "Deploy with .\push-pctires.ps1 (run patch-deposit-option.ps1" -ForegroundColor White
Write-Host "first if you have not already - order does not matter)." -ForegroundColor White
Write-Host "Test: open checkout on your phone, get to the payment step" -ForegroundColor White
Write-Host "and tap Pay INSTANTLY - you should see the friendly loading" -ForegroundColor White
Write-Host "message instead of an error, then it works a second later." -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Cyan
Read-Host "Press Enter to close"
