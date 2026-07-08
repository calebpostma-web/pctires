# patch-quote-fastcheckout.ps1 -- fast-lane checkout for quote links + always-visible price (2026-07-08)
#
# WHY: Caleb sends customers a quote link after building their cart on the
# phone. They already told him what tires + install they want, but the
# checkout still made them click through Contact -> Schedule -> Add-ons ->
# Payment. Caleb: "when I send them a quote, it should be click here, put
# your card in, paid." Customers were also asking "how much is it?" after
# getting the link because the price was hidden behind the cart icon unless
# Caleb had typed a fixed all-in total.
#
# WHAT THIS DOES (quote-link checkouts only -- normal shoppers are unaffected):
#   1. The quote banner always shows a big, real dollar total up front (live
#      cart total if no fixed price was set, or the all-in price if it was),
#      plus a one-tap "Pay Now" button (hidden when the quote has multiple
#      items to compare, since they need to pick one first).
#   2. Name + phone from the quote pre-fill the checkout Contact step.
#   3. After entering just their email, quote checkouts skip straight from
#      Contact to Payment -- no Schedule or Add-ons steps. Install status per
#      item is already baked into the quote's cart; Caleb arranges the
#      appointment by phone same as when someone clicks "Skip" today.
#   4. Fast-lane state resets after a successful order so it doesn't bleed
#      into an unrelated later cart.
#
# Run:
#   cd C:\Users\Caleb\Documents\Claude\Projects\PCtires
#   .\patch-quote-fastcheckout.ps1
# Then deploy:
#   .\push-pctires.ps1

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\Caleb\Documents\Claude\Projects\PCtires'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

$f = 'index.html'
$path = (Resolve-Path $f).Path
$raw = [System.IO.File]::ReadAllText($path)
$linesBefore = ([System.IO.File]::ReadAllLines($path)).Count

function Check-One($raw, $needle, $label) {
  $count = ([regex]::Matches($raw, [regex]::Escape($needle))).Count
  if ($count -ne 1) {
    Write-Host "FAIL: $label found $count times (expected 1) -- NOT patching" -ForegroundColor Red
    exit 1
  }
}

# ---- Edit A: checkForQuoteInUrl -- capture name/phone + flip on fast-lane flag ----
$oldA = @'
    // All-in price override: if the owner set a fixed total, lock the cart to it.
    if (typeof quote.finalTotal === 'number' && quote.finalTotal > 0) {
      window._quoteFinalTotal = quote.finalTotal;
      window._quoteLocked = true;
      try { document.body.classList.add('qlocked'); } catch(e) {}
    } else {
      window._quoteFinalTotal = null;
      window._quoteLocked = false;
      try { document.body.classList.remove('qlocked'); } catch(e) {}
    }
    saveCartToStorage();
    updBadge();
    renderCart();
    showQuoteBanner(quote);
'@
$oldA = $oldA.Trim("`r", "`n")

$newA = @'
    // All-in price override: if the owner set a fixed total, lock the cart to it.
    if (typeof quote.finalTotal === 'number' && quote.finalTotal > 0) {
      window._quoteFinalTotal = quote.finalTotal;
      window._quoteLocked = true;
      try { document.body.classList.add('qlocked'); } catch(e) {}
    } else {
      window._quoteFinalTotal = null;
      window._quoteLocked = false;
      try { document.body.classList.remove('qlocked'); } catch(e) {}
    }
    // Fast-lane checkout: the customer already gave Caleb their name/phone and
    // tire/install choice by phone when the quote was built -- skip re-asking
    // for it and skip the Schedule/Add-ons steps entirely.
    window._quoteCustomerName = quote.customerName || '';
    window._quoteCustomerPhone = quote.customerPhone || '';
    window._quoteFastLane = true;
    saveCartToStorage();
    updBadge();
    renderCart();
    showQuoteBanner(quote);
'@
$newA = $newA.Trim("`r", "`n")

Check-One $raw $oldA 'checkForQuoteInUrl fast-lane insertion point'

# ---- Edit B: showQuoteBanner -- always show a real total + Pay Now button ----
$oldB = @'
function showQuoteBanner(quote) {
  const existing = document.getElementById('quoteBanner');
  if (existing) existing.remove();
  const firstName = (quote.customerName || '').split(' ')[0] || 'there';
  const noteHtml = quote.note ? '<div style="font-weight:400;font-size:13px;margin-top:4px;line-height:1.4">&ldquo;' + escapeHtml(quote.note) + '&rdquo;</div>' : '';
  // If the cart has multiple items, treat it as a comparison and tell the customer how to pick
  const isComparison = cart.length > 1;
  let reviewMsg = isComparison
    ? 'Caleb sent you <strong>' + cart.length + ' sets</strong> to compare. Tap <strong>&ldquo;Pick this set&rdquo;</strong> on the one you want, or remove items individually. Call 519-397-4686 to discuss.'
    : 'Review your cart and remove any items you don&rsquo;t want before checking out. Call 519-397-4686 if anything needs to change.';
  if (typeof quote.finalTotal === 'number' && quote.finalTotal > 0) {
    reviewMsg = 'Your all-in price is <strong>$' + quote.finalTotal.toFixed(2) + '</strong> &mdash; HST and installation included. Just complete checkout. Call 519-397-4686 with any questions.';
  }
  const banner = document.createElement('div');
  banner.id = 'quoteBanner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:var(--yellow);color:#111;padding:14px 50px 14px 20px;text-align:center;font-family:Barlow,sans-serif;box-shadow:0 2px 12px rgba(0,0,0,.25);font-size:14px';
  banner.innerHTML = '<strong style="font-size:15px">&#9889; Hi ' + escapeHtml(firstName) + ' &mdash; quote from Caleb at PC Tires.</strong>' + noteHtml + '<div style="font-size:12px;margin-top:6px;opacity:.85">' + reviewMsg + '</div><button onclick="document.getElementById(\'quoteBanner\').remove()" style="position:absolute;right:10px;top:10px;background:rgba(0,0,0,.12);border:none;width:30px;height:30px;cursor:pointer;border-radius:2px;font-size:16px;font-weight:700">&times;</button>';
  document.body.appendChild(banner);
}
'@
$oldB = $oldB.Trim("`r", "`n")

$newB = @'
function showQuoteBanner(quote) {
  const existing = document.getElementById('quoteBanner');
  if (existing) existing.remove();
  const firstName = (quote.customerName || '').split(' ')[0] || 'there';
  const noteHtml = quote.note ? '<div style="font-weight:400;font-size:13px;margin-top:4px;line-height:1.4">&ldquo;' + escapeHtml(quote.note) + '&rdquo;</div>' : '';
  // If the cart has multiple items, treat it as a comparison and tell the customer how to pick
  const isComparison = cart.length > 1;
  let reviewMsg = isComparison
    ? 'Caleb sent you <strong>' + cart.length + ' sets</strong> to compare. Tap <strong>&ldquo;Pick this set&rdquo;</strong> on the one you want, or remove items individually. Call 519-397-4686 to discuss.'
    : 'Call 519-397-4686 if anything needs to change.';
  // Always show a real dollar number up front -- customers kept asking "how much
  // is it?" after getting a quote link because the price was hidden behind the
  // cart icon unless Caleb had typed a fixed all-in total.
  let totalLine = '';
  try {
    const t = getTotals();
    if (t && t.total > 0) {
      const totalLabel = window._quoteFinalTotal ? 'All-in price (HST + install included)' : 'Total (HST included)';
      totalLine = '<div style="margin-top:8px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;opacity:.75">' + totalLabel + '</div><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:34px;font-weight:900;line-height:1.1">$' + t.total.toFixed(2) + '</div></div>';
    }
  } catch(e) {}
  const payNowBtn = !isComparison ? '<button onclick="document.getElementById(\'quoteBanner\').remove();openCheckout()" style="margin-top:10px;background:#111;color:var(--yellow);border:none;padding:10px 22px;font-family:Barlow,sans-serif;font-weight:700;font-size:14px;border-radius:2px;cursor:pointer">Pay Now &rarr;</button>' : '';
  const banner = document.createElement('div');
  banner.id = 'quoteBanner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:var(--yellow);color:#111;padding:14px 50px 14px 20px;text-align:center;font-family:Barlow,sans-serif;box-shadow:0 2px 12px rgba(0,0,0,.25);font-size:14px';
  banner.innerHTML = '<strong style="font-size:15px">&#9889; Hi ' + escapeHtml(firstName) + ' &mdash; quote from Caleb at PC Tires.</strong>' + noteHtml + totalLine + '<div style="font-size:12px;margin-top:6px;opacity:.85">' + reviewMsg + '</div>' + payNowBtn + '<button onclick="document.getElementById(\'quoteBanner\').remove()" style="position:absolute;right:10px;top:10px;background:rgba(0,0,0,.12);border:none;width:30px;height:30px;cursor:pointer;border-radius:2px;font-size:16px;font-weight:700">&times;</button>';
  document.body.appendChild(banner);
}
'@
$newB = $newB.Trim("`r", "`n")

Check-One $raw $oldB 'showQuoteBanner function'

# ---- Edit C: openCheckout -- pre-fill name/phone for fast-lane ----
$oldC = @'
function openCheckout() { closeCart(); step = 1; selectedAddons = new Set(); _calAutoPickPending = true; updSteps(); document.getElementById('checkoutOverlay').classList.add('show'); }
'@
$oldC = $oldC.Trim("`r", "`n")

$newC = @'
function openCheckout() {
  closeCart(); step = 1; selectedAddons = new Set(); _calAutoPickPending = true;
  // Fast-lane: pre-fill name/phone the customer already gave Caleb on the phone.
  if (window._quoteFastLane) {
    const nameParts = (window._quoteCustomerName || '').trim().split(/\s+/).filter(Boolean);
    document.getElementById('fName').value = nameParts.shift() || '';
    document.getElementById('lName').value = nameParts.join(' ');
    document.getElementById('phone').value = window._quoteCustomerPhone || '';
  }
  updSteps();
  document.getElementById('checkoutOverlay').classList.add('show');
}
'@
$newC = $newC.Trim("`r", "`n")

Check-One $raw $oldC 'openCheckout function'

# ---- Edit D: nextStep/prevStep -- skip Schedule + Add-ons for fast-lane ----
$oldD = @'
async function nextStep() {
  if (step === 1) { var _em = (document.getElementById('email').value || '').trim(); document.getElementById('email').value = _em; if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(_em)) { alert('Please enter a valid email address (like name@example.com).'); return; } }
  if (step === 2) {
    if (!selectedService) { alert('Please select a service type, or click Skip to arrange later.'); return; }
    if (!selDate || !selTime) { alert('Please select a date and time, or click Skip to arrange later.'); return; }
  }
  if (step === 4) { await processPayment(); return; }
  step++; updSteps();
}
function prevStep() { if (step > 1) { step--; updSteps(); } }
'@
$oldD = $oldD.Trim("`r", "`n")

$newD = @'
async function nextStep() {
  if (step === 1) {
    var _em = (document.getElementById('email').value || '').trim(); document.getElementById('email').value = _em;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(_em)) { alert('Please enter a valid email address (like name@example.com).'); return; }
    if (window._quoteFastLane) { step = 4; updSteps(); return; }
  }
  if (step === 2) {
    if (!selectedService) { alert('Please select a service type, or click Skip to arrange later.'); return; }
    if (!selDate || !selTime) { alert('Please select a date and time, or click Skip to arrange later.'); return; }
  }
  if (step === 4) { await processPayment(); return; }
  step++; updSteps();
}
function prevStep() {
  if (window._quoteFastLane && step === 4) { step = 1; updSteps(); return; }
  if (step > 1) { step--; updSteps(); }
}
'@
$newD = $newD.Trim("`r", "`n")

Check-One $raw $oldD 'nextStep/prevStep functions'

# ---- Edit E: reset fast-lane state after a successful order ----
$oldE = @'
  cart = []; tdgQuote = null; selectedAddons = new Set(); appliedPromo = null; window._quoteFinalTotal = null; window._quoteLocked = false; try { document.body.classList.remove('qlocked'); } catch(e) {} updBadge();
'@
$oldE = $oldE.Trim("`r", "`n")

$newE = @'
  cart = []; tdgQuote = null; selectedAddons = new Set(); appliedPromo = null; window._quoteFinalTotal = null; window._quoteLocked = false; window._quoteFastLane = false; window._quoteCustomerName = ''; window._quoteCustomerPhone = ''; window._activeQuoteCode = null; try { document.body.classList.remove('qlocked'); } catch(e) {} updBadge();
'@
$newE = $newE.Trim("`r", "`n")

Check-One $raw $oldE 'post-order cart reset line'

# ---- Apply all edits ----
Copy-Item $f "$f.bak-fastquote-$stamp"
$raw = $raw.Replace($oldA, $newA)
$raw = $raw.Replace($oldB, $newB)
$raw = $raw.Replace($oldC, $newC)
$raw = $raw.Replace($oldD, $newD)
$raw = $raw.Replace($oldE, $newE)
[System.IO.File]::WriteAllText($path, $raw)

$linesAfter = ([System.IO.File]::ReadAllLines($path)).Count
$chk = [System.IO.File]::ReadAllText($path)
$okA = $chk.Contains($newA) -and (-not $chk.Contains($oldA))
$okB = $chk.Contains($newB) -and (-not $chk.Contains($oldB))
$okC = $chk.Contains($newC) -and (-not $chk.Contains($oldC))
$okD = $chk.Contains($newD) -and (-not $chk.Contains($oldD))
$okE = $chk.Contains($newE) -and (-not $chk.Contains($oldE))

if ((-not $okA) -or (-not $okB) -or (-not $okC) -or (-not $okD) -or (-not $okE)) {
  Write-Host "FAIL: verification (A:$okA B:$okB C:$okC D:$okD E:$okE) -- RESTORING BACKUP" -ForegroundColor Red
  Copy-Item "$f.bak-fastquote-$stamp" $f -Force
  exit 1
}

Write-Host "Lines before: $linesBefore  after: $linesAfter" -ForegroundColor Cyan
Write-Host "OK: quote fast-lane checkout + always-visible price patched (backup $f.bak-fastquote-$stamp)" -ForegroundColor Green
Write-Host 'ALL CHECKS PASSED. Deploy with: .\push-pctires.ps1' -ForegroundColor Green
