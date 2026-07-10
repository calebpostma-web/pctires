# =============================================
#  patch-deposit-option.ps1
#  Adds a flat $50 DEPOSIT option to checkout, alongside full payment.
#
#  Customer picks one of two cards on the Payment step:
#    - Pay in Full  (unchanged, default)
#    - $50 Deposit  (charges $50 now; balance due at installation,
#                    settled in person by e-transfer, card, or cash)
#
#  What happens on a deposit order:
#    - Stripe charges exactly $50 (separate idempotency key so a
#      retry after switching modes can never charge the wrong amount)
#    - TDG order still placed immediately (tires get ordered)
#    - Confirmation screen + customer email show Deposit Paid and
#      Balance Due at Installation
#    - Internal order email is tagged [DEPOSIT - BALANCE OWING] in the
#      subject and shows the balance in red
#    - Deposit option hidden for orders under $100
#
#  Files touched: index.html, functions/send-order-email.js
#  Backups go OUTSIDE the repo (C:\Users\Caleb\Documents\PCtires-quarantine)
#  All edits are all-or-nothing: any anchor mismatch = no changes written.
#
#  RUN:
#    cd C:\Users\Caleb\Documents\Claude\Projects\PCtires
#    .\patch-deposit-option.ps1
#  Then test locally if desired, and deploy with .\push-pctires.ps1
# =============================================

$dest = "C:\Users\Caleb\Documents\Claude\Projects\PCtires"
$indexPath = Join-Path $dest "index.html"
$emailPath = Join-Path $dest "functions\send-order-email.js"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$bakDir = "C:\Users\Caleb\Documents\PCtires-quarantine\deposit-backup-$stamp"

New-Item -ItemType Directory -Path $bakDir -Force | Out-Null
Copy-Item $indexPath (Join-Path $bakDir "index.html")
Copy-Item $emailPath (Join-Path $bakDir "send-order-email.js")
Write-Host "Backups saved to $bakDir" -ForegroundColor DarkGray

$failures = @()
function Replace-Once {
    param([string]$content, [string]$old, [string]$new, [string]$label)
    # Normalize anchor line endings to LF (content is normalized to LF at read)
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
# Normalize file content to LF so multi-line anchors match regardless of
# CRLF/LF history. HTML/JS behaviour is unaffected.
$html = [IO.File]::ReadAllText($indexPath).Replace("`r`n", "`n")
$js   = [IO.File]::ReadAllText($emailPath).Replace("`r`n", "`n")

# ---------------------------------------------------------------
# INDEX.HTML
# ---------------------------------------------------------------

# R1: payment-choice UI above the pay summary box
$old = @'
        <div class="pay-total-box" id="payBox"></div>
'@
$new = @'
        <div id="payChoice" style="display:none;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
          <div id="payOptFull" onclick="setPayMode('full')" style="cursor:pointer;padding:12px 14px;background:var(--raised);border:1px solid var(--yellow);border-radius:2px">
            <div style="font-weight:700;font-size:14px">Pay in Full</div>
            <div style="font-size:12px;color:var(--muted);margin-top:3px">All settled today. Nothing owing at pickup.</div>
          </div>
          <div id="payOptDeposit" onclick="setPayMode('deposit')" style="cursor:pointer;padding:12px 14px;background:var(--raised);border:1px solid var(--border);border-radius:2px">
            <div style="font-weight:700;font-size:14px">$50 Deposit</div>
            <div style="font-size:12px;color:var(--muted);margin-top:3px">Holds your booking and orders your tires. Balance due at installation.</div>
          </div>
        </div>
        <div class="pay-total-box" id="payBox"></div>
'@
$html = Replace-Once $html $old $new "R1 payChoice UI"

# R2: deposit helper functions (inserted before getOrCreateOrderId)
$old = @'
function getOrCreateOrderId() {
'@
$new = @'
// == DEPOSIT OPTION ==
var DEPOSIT_AMOUNT = 50;
var DEPOSIT_MIN_ORDER = 100;
window._payMode = 'full';
function depositEligible() {
  try { return payableGrandTotal() >= DEPOSIT_MIN_ORDER; } catch (e) { return false; }
}
function payModeStyles() {
  var f = document.getElementById('payOptFull'), d = document.getElementById('payOptDeposit');
  if (!f || !d) return;
  f.style.borderColor = (window._payMode === 'full') ? 'var(--yellow)' : 'var(--border)';
  f.style.background  = (window._payMode === 'full') ? 'rgba(245,197,24,0.08)' : 'var(--raised)';
  d.style.borderColor = (window._payMode === 'deposit') ? 'var(--yellow)' : 'var(--border)';
  d.style.background  = (window._payMode === 'deposit') ? 'rgba(245,197,24,0.08)' : 'var(--raised)';
}
function setPayMode(m) {
  window._payMode = (m === 'deposit' && depositEligible()) ? 'deposit' : 'full';
  payModeStyles();
  try { buildPaymentSummary(); } catch (e) {}
  var btn = document.getElementById('nextBtn');
  if (btn && !window._paymentInFlight && typeof nLabels !== 'undefined') {
    btn.textContent = (window._payMode === 'deposit') ? 'Pay $' + DEPOSIT_AMOUNT + ' Deposit' : nLabels[4];
  }
}
function depositRowsHtml(g) {
  if (window._payMode !== 'deposit' || !depositEligible()) return '';
  return '<div class="ptrow" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border)"><span>Due today (deposit)</span><span style="color:var(--yellow);font-weight:800">$' + DEPOSIT_AMOUNT.toFixed(2) + '</span></div>'
       + '<div class="ptrow"><span>Balance at installation (e-transfer, card, or cash)</span><span>$' + (g - DEPOSIT_AMOUNT).toFixed(2) + '</span></div>';
}
function getOrCreateOrderId() {
'@
$html = Replace-Once $html $old $new "R2 deposit functions"

# R3: show/hide the choice + keep visuals in sync when summary rebuilds
$old = @'
  const box = document.getElementById('payBox'); if (!box) return;
'@
$new = @'
  const box = document.getElementById('payBox'); if (!box) return;
  var _pc = document.getElementById('payChoice');
  if (_pc) { _pc.style.display = depositEligible() ? 'grid' : 'none'; }
  if (!depositEligible()) { window._payMode = 'full'; }
  payModeStyles();
  var _nb = document.getElementById('nextBtn');
  if (_nb && !window._paymentInFlight && window._payMode === 'deposit') { _nb.textContent = 'Pay $' + DEPOSIT_AMOUNT + ' Deposit'; }
'@
$html = Replace-Once $html $old $new "R3 buildPaymentSummary hook"

# R4: totals row label + deposit rows (quote-override branch)
$old = @'
    <div class="ptrow bold"><span>Total Due Today (quoted, all-in)</span><span>$${grandTotal.toFixed(2)}</span></div>
'@
$new = @'
    <div class="ptrow bold"><span>${window._payMode === 'deposit' ? 'Order Total (quoted, all-in)' : 'Total Due Today (quoted, all-in)'}</span><span>$${grandTotal.toFixed(2)}</span></div>${depositRowsHtml(grandTotal)}
'@
$html = Replace-Once $html $old $new "R4 override totals row"

# R5: totals row label + deposit rows (normal branch)
$old = @'
    <div class="ptrow bold"><span>Total Due Today</span><span>$${grandTotal.toFixed(2)}</span></div>
'@
$new = @'
    <div class="ptrow bold"><span>${window._payMode === 'deposit' ? 'Order Total' : 'Total Due Today'}</span><span>$${grandTotal.toFixed(2)}</span></div>${depositRowsHtml(grandTotal)}
'@
$html = Replace-Once $html $old $new "R5 normal totals row"

# R6: charge amount = $50 in deposit mode
$old = @'
    const amountCents = Math.round(grandTotal * 100);
'@
$new = @'
    const chargeTotal = (window._payMode === 'deposit' && depositEligible()) ? DEPOSIT_AMOUNT : grandTotal;
    window._lastChargedAmount = chargeTotal;
    const amountCents = Math.round(chargeTotal * 100);
'@
$html = Replace-Once $html $old $new "R6 charge amount"

# R7: separate Stripe idempotency key per mode (retry safety)
$old = @'
      body: JSON.stringify({ amountCents, orderNumber: orderId, customerEmail: email }),
'@
$new = @'
      body: JSON.stringify({ amountCents, orderNumber: orderId + (window._payMode === 'deposit' && depositEligible() ? '-DEP' : ''), customerEmail: email }),
'@
$html = Replace-Once $html $old $new "R7 idempotency key"

# R8: confirmation screen shows deposit + balance
$old = @'
    <div class="cd-row"><span class="cd-label">Total Charged</span><span class="cd-val y">$${grandTotal.toFixed(2)} CAD</span></div>
'@
$new = @'
    ${(window._lastChargedAmount && window._lastChargedAmount < grandTotal) ? `<div class="cd-row"><span class="cd-label">Order Total</span><span class="cd-val">$${grandTotal.toFixed(2)} CAD</span></div><div class="cd-row"><span class="cd-label">Deposit Paid</span><span class="cd-val y">$${window._lastChargedAmount.toFixed(2)} CAD</span></div><div class="cd-row"><span class="cd-label">Balance at Install</span><span class="cd-val">$${(grandTotal - window._lastChargedAmount).toFixed(2)} CAD (e-transfer, card, or cash)</span></div>` : `<div class="cd-row"><span class="cd-label">Total Charged</span><span class="cd-val y">$${grandTotal.toFixed(2)} CAD</span></div>`}
'@
$html = Replace-Once $html $old $new "R8 confirmation rows"

# R9: order payload carries depositPaid / balanceDue
$old = @'
    total: grandTotal,
  };
'@
$new = @'
    total: grandTotal,
    depositPaid: (window._lastChargedAmount && window._lastChargedAmount < grandTotal) ? window._lastChargedAmount : 0,
    balanceDue: (window._lastChargedAmount && window._lastChargedAmount < grandTotal) ? Math.round((grandTotal - window._lastChargedAmount) * 100) / 100 : 0,
  };
'@
$html = Replace-Once $html $old $new "R9 order payload"

# R10: reset deposit state after a successful order
$old = @'
    window._pendingOrderId = null;
'@
$new = @'
    window._pendingOrderId = null;
    window._lastChargedAmount = null;
    window._payMode = 'full';
'@
$html = Replace-Once $html $old $new "R10 state reset"

# R11: keep button label right after a failed attempt in deposit mode
$old = @'
    btn.textContent = 'Pay Securely';
'@
$new = @'
    btn.textContent = (window._payMode === 'deposit') ? 'Pay $' + DEPOSIT_AMOUNT + ' Deposit' : 'Pay Securely';
'@
$html = Replace-Once $html $old $new "R11 error-path label"

# ---------------------------------------------------------------
# FUNCTIONS/SEND-ORDER-EMAIL.JS
# ---------------------------------------------------------------

# E1: customer email totals block
$old = @'
        <tr style="border-top:1px solid #2a2a2a">
          <td style="padding:10px 0 4px;font-weight:700;font-size:15px;color:#fff">Total Charged</td>
          <td style="padding:10px 0 4px;text-align:right;font-weight:900;font-size:18px;color:#f5c518">$${order.total?.toFixed(2)} CAD</td>
        </tr>
'@
$new = @'
        <tr style="border-top:1px solid #2a2a2a">
          <td style="padding:10px 0 4px;font-weight:700;font-size:15px;color:#fff">${order.depositPaid > 0 ? 'Order Total' : 'Total Charged'}</td>
          <td style="padding:10px 0 4px;text-align:right;font-weight:900;font-size:18px;color:#f5c518">$${order.total?.toFixed(2)} CAD</td>
        </tr>
        ${order.depositPaid > 0 ? `<tr>
          <td style="padding:6px 0 0;font-weight:700;font-size:14px;color:#22c55e">Deposit Paid Today</td>
          <td style="padding:6px 0 0;text-align:right;font-weight:800;font-size:15px;color:#22c55e">$${Number(order.depositPaid).toFixed(2)} CAD</td>
        </tr>
        <tr>
          <td style="padding:4px 0 0;font-weight:700;font-size:14px;color:#fff">Balance Due at Installation</td>
          <td style="padding:4px 0 0;text-align:right;font-weight:800;font-size:15px;color:#f5c518">$${Number(order.balanceDue).toFixed(2)} CAD</td>
        </tr>
        <tr><td colspan="2" style="padding:6px 0 0;font-size:12px;color:#888">Pay the balance by e-transfer, card, or cash when your tires are installed.</td></tr>` : ''}
'@
$js = Replace-Once $js $old $new "E1 customer email totals"

# E2: internal email totals block
$old = @'
      <tr style="border-top:1px solid #2a2a2a">
        <td style="padding:9px 0 0;color:#fff;font-weight:700;font-size:14px">Total Charged</td>
        <td style="padding:9px 0 0;text-align:right;color:#f5c518;font-weight:800;font-size:17px">${money(order.total || 0)} ${order.currency || 'CAD'}</td>
      </tr>
'@
$new = @'
      <tr style="border-top:1px solid #2a2a2a">
        <td style="padding:9px 0 0;color:#fff;font-weight:700;font-size:14px">${order.depositPaid > 0 ? 'Order Total' : 'Total Charged'}</td>
        <td style="padding:9px 0 0;text-align:right;color:#f5c518;font-weight:800;font-size:17px">${money(order.total || 0)} ${order.currency || 'CAD'}</td>
      </tr>
      ${order.depositPaid > 0 ? `<tr>
        <td style="padding:5px 0 0;color:#22c55e;font-weight:700;font-size:14px">Deposit Paid (Stripe)</td>
        <td style="padding:5px 0 0;text-align:right;color:#22c55e;font-weight:800;font-size:15px">${money(order.depositPaid)}</td>
      </tr>
      <tr>
        <td style="padding:5px 0 0;color:#ef4444;font-weight:800;font-size:15px">BALANCE OWING AT INSTALL</td>
        <td style="padding:5px 0 0;text-align:right;color:#ef4444;font-weight:900;font-size:17px">${money(order.balanceDue)}</td>
      </tr>` : ''}
'@
$js = Replace-Once $js $old $new "E2 internal email totals"

# E3: internal email subject tag
$old = 'New Order ${order.orderNumber}'
$new = 'New Order ${order.orderNumber}${order.depositPaid > 0 ? '' [DEPOSIT - BALANCE OWING]'' : ''''}'
$js = Replace-Once $js $old $new "E3 subject tag"

# ---------------------------------------------------------------
# All-or-nothing write + verification
# ---------------------------------------------------------------
if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "PATCH ABORTED - no files were changed. Anchor problems:" -ForegroundColor Red
    $failures | ForEach-Object { Write-Host "  ! $_" -ForegroundColor Red }
    Read-Host "Press Enter to close"
    exit 1
}

[IO.File]::WriteAllText($indexPath, $html, $utf8NoBom)
[IO.File]::WriteAllText($emailPath, $js, $utf8NoBom)
Write-Host "Both files written." -ForegroundColor Green

# Verify: structural checks on index.html
$checks = @(
    @{ n = "function setPayMode";      c = ([regex]::Matches($html, "function setPayMode")).Count;      e = 1 },
    @{ n = "function depositRowsHtml"; c = ([regex]::Matches($html, "function depositRowsHtml")).Count; e = 1 },
    @{ n = "payOptDeposit id";         c = ([regex]::Matches($html, "id=""payOptDeposit""")).Count;     e = 1 },
    @{ n = "depositRowsHtml calls";    c = ([regex]::Matches($html, "depositRowsHtml\(grandTotal\)")).Count; e = 2 },
    @{ n = "depositPaid in payload";   c = ([regex]::Matches($html, "depositPaid:")).Count;             e = 1 }
)
$vFail = $false
foreach ($ch in $checks) {
    if ($ch.c -eq $ch.e) { Write-Host ("  OK  " + $ch.n + " = " + $ch.c) -ForegroundColor Green }
    else { Write-Host ("  BAD " + $ch.n + " = " + $ch.c + " (expected " + $ch.e + ")") -ForegroundColor Red; $vFail = $true }
}

# Verify: node syntax check on the function (as ESM)
if (Get-Command node -ErrorAction SilentlyContinue) {
    $tmpMjs = Join-Path $env:TEMP "send-order-email-check.mjs"
    Copy-Item $emailPath $tmpMjs -Force
    $nodeOk = $false
    try {
        & node --check $tmpMjs 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $nodeOk = $true }
    } catch {}
    if ($nodeOk) { Write-Host "  OK  node --check send-order-email.js (ESM)" -ForegroundColor Green }
    else { Write-Host "  BAD node --check FAILED on send-order-email.js" -ForegroundColor Red; $vFail = $true }
    Remove-Item $tmpMjs -ErrorAction SilentlyContinue
} else {
    Write-Host "  WARN node not found - syntax check skipped (not treated as failure)" -ForegroundColor Yellow
}

if ($vFail) {
    Write-Host ""
    Write-Host "VERIFICATION FAILED - restoring backups." -ForegroundColor Red
    Copy-Item (Join-Path $bakDir "index.html") $indexPath -Force
    Copy-Item (Join-Path $bakDir "send-order-email.js") $emailPath -Force
    Write-Host "Original files restored. Nothing deployed." -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "PATCH APPLIED. Next steps:" -ForegroundColor Cyan
Write-Host "  1. Deploy: .\push-pctires.ps1" -ForegroundColor White
Write-Host "  2. Test on the live site (use a cheap item + your own card," -ForegroundColor White
Write-Host "     or just walk to the payment step and eyeball it):" -ForegroundColor White
Write-Host "     - Payment step shows two cards: Pay in Full / `$50 Deposit" -ForegroundColor White
Write-Host "     - Selecting Deposit: summary shows Due today `$50.00 +" -ForegroundColor White
Write-Host "       Balance at installation; button says Pay `$50 Deposit" -ForegroundColor White
Write-Host "     - A real deposit order: Stripe shows a `$50.00 charge," -ForegroundColor White
Write-Host "       both emails show the balance owing, TDG order placed" -ForegroundColor White
Write-Host "  3. Refund the test from the Stripe dashboard if you charged one" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Cyan
Read-Host "Press Enter to close"
