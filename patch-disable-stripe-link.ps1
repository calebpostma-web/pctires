# patch-disable-stripe-link.ps1 -- strip Stripe Link + postal code off the card field (2026-07-08)
#
# WHY (issue 1): Caleb walked a customer through payment on /pay and it
# "asked them to sign up for a linkpay thing" -- that's Stripe's own "Link"
# feature. Stripe auto-enables Link on every Card Element with zero code
# changes on our end: it shows a "Link" button in the card field, and if a
# customer isn't already signed up, clicking it (or Stripe auto-surfacing
# it) asks for their email + phone to create a Link account, then verifies
# with an SMS or email code. It's a real Stripe feature meant to speed up
# checkout across ALL Link-enabled merchants, but for a phone-guided tire
# sale it just looks like an unrelated signup wall in the middle of paying.
# Confirmed against Stripe's own docs: "Stripe automatically enables Link
# in the Card Element... set the disableLink parameter to true to disable
# Link in the Card Element." (docs.stripe.com/payments/link/card-element-link)
#
# WHY (issue 2): the same call rang up a customer who also got stuck on a
# postal code field. Stripe's Card Element bundles a ZIP/postal code field
# by default -- Caleb doesn't collect or need a billing address anywhere
# else on the site, so there's nothing to cross-check it against. Setting
# hidePostalCode: true removes it. Trade-off worth knowing: postal code is
# one input into Stripe's AVS fraud check, so removing it means Stripe
# checks slightly less about the cardholder's identity. Given these are
# phone-guided sales to known local customers, that's a reasonable trade.
#
# WHAT THIS DOES: adds disableLink: true AND hidePostalCode: true to the
# Card Element options in both pay.html and index.html. Card payments work
# exactly the same otherwise -- this only removes the Link signup UI and
# the postal code box.
#
# Run:
#   cd C:\Users\Caleb\Documents\Claude\Projects\PCtires
#   .\patch-disable-stripe-link.ps1
# Then deploy:
#   .\push-pctires.ps1

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\Caleb\Documents\Claude\Projects\PCtires'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

function Patch-File($f, $old, $new, $label) {
  $path = (Resolve-Path $f).Path
  $raw = [System.IO.File]::ReadAllText($path)
  $count = ([regex]::Matches($raw, [regex]::Escape($old))).Count
  if ($count -ne 1) {
    Write-Host "FAIL: $label found $count times in $f (expected 1) -- NOT patching" -ForegroundColor Red
    exit 1
  }
  $bak = "$f.bak-disablelink-$stamp"
  Copy-Item $f $bak
  $newRaw = $raw.Replace($old, $new)
  [System.IO.File]::WriteAllText($path, $newRaw)
  $chk = [System.IO.File]::ReadAllText($path)
  if ((-not $chk.Contains($new)) -or ($chk.Contains($old))) {
    Write-Host "FAIL: verification failed for $f -- RESTORING BACKUP" -ForegroundColor Red
    Copy-Item $bak $f -Force
    exit 1
  }
  Write-Host "OK: $label patched in $f (backup $bak)" -ForegroundColor Green
}

# ---- index.html main checkout ----
$oldIdx = @'
    stripeCard = stripeElems.create('card', {
      style: { base: { color: '#f0ece0', fontFamily: 'Barlow, sans-serif', fontSize: '15px', '::placeholder': { color: '#686868' } } }
    });
'@
$oldIdx = $oldIdx.Trim("`r", "`n")

$newIdx = @'
    stripeCard = stripeElems.create('card', {
      style: { base: { color: '#f0ece0', fontFamily: 'Barlow, sans-serif', fontSize: '15px', '::placeholder': { color: '#686868' } } },
      disableLink: true,
      hidePostalCode: true
    });
'@
$newIdx = $newIdx.Trim("`r", "`n")

Patch-File 'index.html' $oldIdx $newIdx 'Card Element (main checkout)'

# ---- pay.html standalone invoice page ----
$oldPay = @'
  cardEl = elements.create('card', {
    style: { base: { color: '#f4f4f4', fontFamily: 'Barlow, sans-serif', fontSize: '15px', '::placeholder': { color: '#888' } } }
  });
'@
$oldPay = $oldPay.Trim("`r", "`n")

$newPay = @'
  cardEl = elements.create('card', {
    style: { base: { color: '#f4f4f4', fontFamily: 'Barlow, sans-serif', fontSize: '15px', '::placeholder': { color: '#888' } } },
    disableLink: true,
    hidePostalCode: true
  });
'@
$newPay = $newPay.Trim("`r", "`n")

Patch-File 'pay.html' $oldPay $newPay 'Card Element (/pay page)'

Write-Host 'ALL CHECKS PASSED. Deploy with: .\push-pctires.ps1' -ForegroundColor Green
