# ============================================================
#  PC TIRES - Price-Match / Custom-Price Quote Patch
#  Adds an optional "Final All-In Price" to the Share Quote flow.
#  Customer pays exactly that total (HST backed out, install included),
#  the cart locks to it, and the normal order pipeline runs.
#
#  HOW TO RUN:
#    1. Drop this file in your pctires repo folder (same folder as index.html)
#    2. In PowerShell:  .\patch-pricematch-quotes.ps1
#    3. If it says SUCCESS, deploy:  .\push-pctires.ps1
#  Creates timestamped .bak backups before touching anything.
#  Line endings: each file is normalized to LF for matching, then its
#  ORIGINAL endings are restored on save (index.html=CRLF, quote.js=LF).
# ============================================================

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
$indexPath = Join-Path $root 'index.html'
$quotePath = Join-Path $root 'functions\quote.js'

foreach ($p in @($indexPath,$quotePath)) {
  if (-not (Test-Path $p)) { Write-Host "ABORT: cannot find $p" -ForegroundColor Red; exit 1 }
}

$enc  = New-Object System.Text.UTF8Encoding($false)
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$CRLF = ([string][char]13) + ([string][char]10)
$LF   = ([string][char]10)

function Read-Text($p)  { return [System.IO.File]::ReadAllText($p, $enc) }
function Write-Text($p,$t) { [System.IO.File]::WriteAllText($p, $t, $enc) }

function Apply($content, $old, $new, $expected, $label) {
  $count = ([regex]::Matches($content, [regex]::Escape($old))).Count
  if ($count -ne $expected) {
    Write-Host "ABORT [$label]: expected $expected match(es), found $count. No files changed." -ForegroundColor Red
    Write-Host ("anchor: " + $old.Substring(0, [Math]::Min(80,$old.Length))) -ForegroundColor DarkYellow
    exit 1
  }
  return $content.Replace($old, $new)
}

# ---------- read + normalize to LF ----------
$q = Read-Text $quotePath
$h = Read-Text $indexPath
$qCRLF = $q.Contains($CRLF)
$hCRLF = $h.Contains($CRLF)
$q = $q.Replace($CRLF, $LF)
$h = $h.Replace($CRLF, $LF)

# ---------- functions/quote.js ----------
$q = Apply $q @'
        appliedPromo: body.appliedPromo || null,
        customerName:  (body.customerName  || '').toString().slice(0, 100),
'@ @'
        appliedPromo: body.appliedPromo || null,
        finalTotal: (typeof body.finalTotal === 'number' && body.finalTotal > 0) ? Math.round(body.finalTotal * 100) / 100 : null,
        customerName:  (body.customerName  || '').toString().slice(0, 100),
'@ 1 'quote.js #1'

# ---------- index.html ----------
$h = Apply $h @'
<!-- SHARE QUOTE MODAL (owner only) -->
'@ @'
<style>
.qlocked .qb,.qlocked .ci-remove,.qlocked .ci-pick,.qlocked .inst-toggle{display:none !important;}
.qlocked .qty-row{opacity:.65;}
</style>
<!-- SHARE QUOTE MODAL (owner only) -->
'@ 1 'index.html #1'
$h = Apply $h @'
        <div style="margin-bottom:16px">
          <label style="display:block;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:4px">Personal Note (optional)</label>
'@ @'
        <div style="margin-bottom:12px">
          <label style="display:block;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:4px">Final All-In Price (optional)</label>
          <input type="number" id="quoteFinalTotal" step="0.01" min="0" placeholder="e.g. 1116.00" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--white);padding:10px;font-family:Barlow,sans-serif;font-size:14px" autocomplete="off">
          <div style="font-size:11px;color:var(--muted);margin-top:4px;line-height:1.4">Leave blank for live pricing. If set, this is the total the customer pays &mdash; HST is backed out of it, install is included, and add-ons won&rsquo;t change the price.</div>
        </div>
        <div style="margin-bottom:16px">
          <label style="display:block;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:4px">Personal Note (optional)</label>
'@ 1 'index.html #2'
$h = Apply $h @'
  const note  = document.getElementById('quoteNote').value.trim();
'@ @'
  const note  = document.getElementById('quoteNote').value.trim();
  const finalTotalRaw = parseFloat(document.getElementById('quoteFinalTotal').value);
  const finalTotal = (!isNaN(finalTotalRaw) && finalTotalRaw > 0) ? finalTotalRaw : null;
'@ 1 'index.html #3'
$h = Apply $h @'
        appliedPromo: null,
        customerName: name, customerPhone: phone, note,
'@ @'
        appliedPromo: null,
        finalTotal,
        customerName: name, customerPhone: phone, note,
'@ 1 'index.html #4'
$h = Apply $h @'
    cart = fetched;
    appliedPromo = null;
    saveCartToStorage();
'@ @'
    cart = fetched;
    appliedPromo = null;
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
'@ 1 'index.html #5'
$h = Apply $h @'
    window._activeQuoteCode = code;
    setTimeout(function() { try { openCart(); } catch(e) {} }, 800);
'@ @'
    window._activeQuoteCode = code;
    saveCartToStorage();
    setTimeout(function() { try { openCart(); } catch(e) {} }, 800);
'@ 1 'index.html #6'
$h = Apply $h @'
function getTotals() {
  const baseInst = cart.reduce((s, c) => s + (c.install && c.itemType !== 'wheel' ? TDG.INSTALL_PRICE * c.qty : 0), 0);
'@ @'
function getTotals() {
  // All-in quote override: customer pays a fixed total; HST is backed out of it.
  if (typeof window._quoteFinalTotal === 'number' && window._quoteFinalTotal > 0) {
    const ft = window._quoteFinalTotal;
    const preTax = Math.round((ft / 1.13) * 100) / 100;
    const tax = Math.round((ft - preTax) * 100) / 100;
    return { sub: preTax, inst: 0, ship: 0, tax: tax, total: ft, discount: 0, override: true };
  }
  const baseInst = cart.reduce((s, c) => s + (c.install && c.itemType !== 'wheel' ? TDG.INSTALL_PRICE * c.qty : 0), 0);
'@ 1 'index.html #7'
$h = Apply $h @'
function getAddonTotal() { return ADDONS.filter(a => selectedAddons.has(a.id)).reduce((s,a) => s + a.price, 0); }
'@ @'
function getAddonTotal() { return ADDONS.filter(a => selectedAddons.has(a.id)).reduce((s,a) => s + a.price, 0); }

// Single source of truth for the amount charged. An all-in quote override is
// authoritative: add-ons are NOT added on top of a fixed quoted price.
function payableGrandTotal() {
  if (typeof window._quoteFinalTotal === 'number' && window._quoteFinalTotal > 0) return window._quoteFinalTotal;
  const t = getTotals();
  const addonAmt = (typeof getAddonTotal === 'function') ? getAddonTotal() : 0;
  return t.total + addonAmt;
}
'@ 1 'index.html #8'
$h = Apply $h @'
  const box = document.getElementById('payBox'); if (!box) return;
  const t = getTotals();
  const instTotal = cart.reduce((s, c) => s + (c.install && c.itemType !== 'wheel' ? TDG.INSTALL_PRICE * c.qty : 0), 0);
  const addonAmt = getAddonTotal();
  const grandTotal = t.total + addonAmt;
  const addonLines = ADDONS.filter(a => selectedAddons.has(a.id))
'@ @'
  const box = document.getElementById('payBox'); if (!box) return;
  const t = getTotals();
  const grandTotal = payableGrandTotal();
  if (t.override) {
    box.innerHTML = `
    <div class="ptrow"><span>Items (${cart.reduce((s,c)=>s+c.qty,0)})</span><span>$${t.sub.toFixed(2)}</span></div>
    <div class="ptrow"><span>Tax (HST 13%)</span><span>$${t.tax.toFixed(2)}</span></div>
    <div class="ptrow bold"><span>Total Due Today (quoted, all-in)</span><span>$${grandTotal.toFixed(2)}</span></div>
    `;
    return;
  }
  const instTotal = cart.reduce((s, c) => s + (c.install && c.itemType !== 'wheel' ? TDG.INSTALL_PRICE * c.qty : 0), 0);
  const addonAmt = getAddonTotal();
  const addonLines = ADDONS.filter(a => selectedAddons.has(a.id))
'@ 1 'index.html #9'
$h = Apply $h @'
  const grandTotal = t.total + addonAmt;
'@ @'
  const grandTotal = payableGrandTotal();
'@ 2 'index.html #10'
$h = Apply $h @'
function removeFromCart(itemNumber) { cart = cart.filter(c => c.itemNumber !== itemNumber); updBadge(); renderCart(); }
'@ @'
function quoteLockBlocked() {
  if (window._quoteLocked) {
    if (typeof showToast === 'function') showToast('Fixed quote', 'This is a locked price from Caleb \u2014 call 519-397-4686 to change it.');
    return true;
  }
  return false;
}
function removeFromCart(itemNumber) { if (quoteLockBlocked()) return; cart = cart.filter(c => c.itemNumber !== itemNumber); updBadge(); renderCart(); }
'@ 1 'index.html #11'
$h = Apply $h @'
function chgQty(itemNumber, d) {
  const item = cart.find(c => c.itemNumber === itemNumber); if (!item) return;
'@ @'
function chgQty(itemNumber, d) {
  if (quoteLockBlocked()) return;
  const item = cart.find(c => c.itemNumber === itemNumber); if (!item) return;
'@ 1 'index.html #12'
$h = Apply $h @'
function togInst(itemNumber) {
  const item = cart.find(c => c.itemNumber === itemNumber);
  if (!item) return;
'@ @'
function togInst(itemNumber) {
  if (quoteLockBlocked()) return;
  const item = cart.find(c => c.itemNumber === itemNumber);
  if (!item) return;
'@ 1 'index.html #13'
$h = Apply $h @'
function pickOnlyThis(itemNumber) {
  const picked = cart.find(c => c.itemNumber === itemNumber);
'@ @'
function pickOnlyThis(itemNumber) {
  if (quoteLockBlocked()) return;
  const picked = cart.find(c => c.itemNumber === itemNumber);
'@ 1 'index.html #14'
$h = Apply $h @'
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
      cart, appliedPromo, savedAt: Date.now()
    }));
'@ @'
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
      cart, appliedPromo,
      quoteFinalTotal: (typeof window._quoteFinalTotal === 'number' ? window._quoteFinalTotal : null),
      quoteLocked: !!window._quoteLocked,
      activeQuoteCode: window._activeQuoteCode || null,
      savedAt: Date.now()
    }));
'@ 1 'index.html #15'
$h = Apply $h @'
    if (data.appliedPromo) appliedPromo = data.appliedPromo;
    updBadge();
'@ @'
    if (data.appliedPromo) appliedPromo = data.appliedPromo;
    if (typeof data.quoteFinalTotal === 'number' && data.quoteFinalTotal > 0) {
      window._quoteFinalTotal = data.quoteFinalTotal;
      window._quoteLocked = !!data.quoteLocked;
      window._activeQuoteCode = data.activeQuoteCode || window._activeQuoteCode || null;
      try { document.body.classList.add('qlocked'); } catch(e) {}
    }
    updBadge();
'@ 1 'index.html #16'
$h = Apply $h @'
  cart = []; tdgQuote = null; selectedAddons = new Set(); appliedPromo = null; updBadge();
'@ @'
  cart = []; tdgQuote = null; selectedAddons = new Set(); appliedPromo = null; window._quoteFinalTotal = null; window._quoteLocked = false; try { document.body.classList.remove('qlocked'); } catch(e) {} updBadge();
'@ 1 'index.html #17'
$h = Apply $h @'
  const isComparison = cart.length > 1;
  const reviewMsg = isComparison
    ? 'Caleb sent you <strong>' + cart.length + ' sets</strong> to compare. Tap <strong>&ldquo;Pick this set&rdquo;</strong> on the one you want, or remove items individually. Call 519-397-4686 to discuss.'
    : 'Review your cart and remove any items you don&rsquo;t want before checking out. Call 519-397-4686 if anything needs to change.';
'@ @'
  const isComparison = cart.length > 1;
  let reviewMsg = isComparison
    ? 'Caleb sent you <strong>' + cart.length + ' sets</strong> to compare. Tap <strong>&ldquo;Pick this set&rdquo;</strong> on the one you want, or remove items individually. Call 519-397-4686 to discuss.'
    : 'Review your cart and remove any items you don&rsquo;t want before checking out. Call 519-397-4686 if anything needs to change.';
  if (typeof quote.finalTotal === 'number' && quote.finalTotal > 0) {
    reviewMsg = 'Your all-in price is <strong>$' + quote.finalTotal.toFixed(2) + '</strong> &mdash; HST and installation included. Just complete checkout. Call 519-397-4686 with any questions.';
  }
'@ 1 'index.html #18'

# ---------- restore original EOL ----------
if ($qCRLF) { $q = $q.Replace($LF, $CRLF) }
if ($hCRLF) { $h = $h.Replace($LF, $CRLF) }

# ---------- backup + write ----------
Copy-Item $indexPath ($indexPath + ".bak-pricematch-$stamp")
Copy-Item $quotePath ($quotePath + ".bak-pricematch-$stamp")
Write-Text $quotePath $q
Write-Text $indexPath $h

# ---------- verify (single-line needles, EOL-agnostic) ----------
$h2 = Read-Text $indexPath
$q2 = Read-Text $quotePath
$ok = $true
function Check($txt,$needle,$min,$label){
  $c = ([regex]::Matches($txt,[regex]::Escape($needle))).Count
  if ($c -lt $min) { Write-Host "VERIFY FAIL [$label]: found $c (need >= $min)" -ForegroundColor Red; $script:ok=$false }
  else { Write-Host "  ok  $label ($c)" -ForegroundColor DarkGray }
}
Check $q2 'finalTotal' 1 'quote.js finalTotal stored'
Check $h2 'payableGrandTotal()' 4 'payableGrandTotal helper + 3 call sites'
Check $h2 'quoteLockBlocked()) return' 4 'cart lock guards'
Check $h2 'id="quoteFinalTotal"' 1 'owner price input'
Check $h2 'override: true' 1 'getTotals override branch'
$stale = ([regex]::Matches($h2,[regex]::Escape('t.total + addonAmt'))).Count
if ($stale -ne 1) { Write-Host "VERIFY FAIL: expected exactly 1 't.total + addonAmt' (inside helper), found $stale" -ForegroundColor Red; $ok=$false }
else { Write-Host "  ok  no stale charge math (1)" -ForegroundColor DarkGray }

Write-Host ""
if ($ok) {
  Write-Host "SUCCESS - price-match quotes patched." -ForegroundColor Green
  Write-Host "Backups: *.bak-pricematch-$stamp" -ForegroundColor DarkGray
  Write-Host "Next: run  .\push-pctires.ps1  to deploy." -ForegroundColor Cyan
} else {
  Write-Host "VERIFICATION FAILED - restoring backups." -ForegroundColor Red
  Copy-Item ($indexPath + ".bak-pricematch-$stamp") $indexPath -Force
  Copy-Item ($quotePath + ".bak-pricematch-$stamp") $quotePath -Force
  exit 1
}
