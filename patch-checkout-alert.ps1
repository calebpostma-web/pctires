# patch-checkout-alert.ps1 -- PC Tires failed-checkout alert (2026-07-05)
#
# WHY: Two blind checkout failures in one day. When a customer hits a payment
# error, nobody is notified -- the sale silently dies unless the customer
# phones in. This adds an internal alert email on every payment failure.
#
# WHAT:
#   1. NEW /functions/checkout-alert.js -- receives failure details, emails
#      both internal addresses via Resend (same pattern as send-service-request).
#   2. index.html -- fire-and-forget beacon in processPayment's catch block.
#      Cannot affect the customer's flow: wrapped in try/catch, no await.
#
# Run:
#   cd C:\Users\Caleb\Documents\Claude\Projects\PCtires
#   .\patch-checkout-alert.ps1
# Then deploy:
#   .\push-pctires.ps1

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\Caleb\Documents\Claude\Projects\PCtires'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$fail = $false

# ================= PART 1: new functions/checkout-alert.js =================
$fnPath = 'functions\checkout-alert.js'

$fnContent = @'
/**
 * Cloudflare Pages Function: /functions/checkout-alert.js
 *
 * Fired by the frontend when a checkout payment attempt FAILS.
 * Sends an internal alert email via Resend so failed checkouts are
 * visible to the shop instead of dying silently.
 *
 * Environment variable required (already set): RESEND_API_KEY
 */

const FROM_EMAIL    = 'alerts@pctires.ca';
const NOTIFY_EMAILS = ['calebpostma@gmail.com', 'postmacontracting@gmail.com'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function esc(s) {
  return String(s == null ? '' : s).slice(0, 600).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });
  }

  try {
    const b = await request.json();
    const resendKey = env.RESEND_API_KEY;
    if (!resendKey) {
      return new Response(JSON.stringify({ ok: true, warn: 'RESEND_API_KEY missing' }), { status: 200, headers: CORS });
    }

    const who = b.name || b.email || b.phone || 'unknown customer';
    const subject = '[PC Tires] FAILED CHECKOUT - ' + who;

    const phoneLink = b.phone
      ? '<a href="tel:' + esc(b.phone) + '">' + esc(b.phone) + '</a>'
      : '-';

    const html =
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
      'body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}' +
      '.card{background:#fff;border-radius:6px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}' +
      '.header{background:#111;padding:24px 28px}' +
      '.logo{font-size:22px;font-weight:900;letter-spacing:2px;color:#f5c518}' +
      '.header-sub{font-size:12px;color:#888;letter-spacing:1px;text-transform:uppercase;margin-top:2px}' +
      '.body{padding:28px}' +
      '.alert{background:#fdecea;border:1px solid #ef4444;border-radius:4px;padding:14px 16px;margin-bottom:22px;font-size:14px;font-weight:600;color:#111}' +
      'table{width:100%;border-collapse:collapse;font-size:14px}' +
      'td{padding:10px 0;border-bottom:1px solid #f0f0f0;vertical-align:top}' +
      'td:first-child{color:#888;width:32%;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.5px}' +
      'td:last-child{color:#111;font-weight:500}' +
      '.err{font-family:monospace;background:#f9f9f9;padding:8px;border-radius:3px;display:block;word-break:break-word}' +
      '.footer{background:#f9f9f9;padding:16px 28px;font-size:12px;color:#aaa;border-top:1px solid #eee}' +
      '</style></head><body><div class="card">' +
      '<div class="header"><div class="logo">PC TIRES</div>' +
      '<div class="header-sub">Failed Checkout Alert</div></div>' +
      '<div class="body">' +
      '<div class="alert">A customer just hit a payment error. Call them back - the sale is probably still alive.</div>' +
      '<table>' +
      '<tr><td>Error</td><td><span class="err">' + esc(b.error || 'unknown') + '</span></td></tr>' +
      '<tr><td>Customer</td><td>' + esc(b.name || '-') + '</td></tr>' +
      '<tr><td>Phone</td><td>' + phoneLink + '</td></tr>' +
      '<tr><td>Email</td><td>' + esc(b.email || '-') + '</td></tr>' +
      '<tr><td>Cart</td><td>' + esc(b.cart || '-') + '</td></tr>' +
      '<tr><td>Total</td><td>$' + esc(b.total || '?') + '</td></tr>' +
      '<tr><td>Order ID</td><td>' + esc(b.orderId || '-') + '</td></tr>' +
      '<tr><td>Browser</td><td>' + esc(b.userAgent || '-') + '</td></tr>' +
      '<tr><td>Time</td><td>' + new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' }) + ' (shop time)</td></tr>' +
      '</table></div>' +
      '<div class="footer">PC Tires checkout monitor - fired from processPayment catch block</div>' +
      '</div></body></html>';

    await Promise.all(NOTIFY_EMAILS.map(function (to) {
      return fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_EMAIL, to: to, subject: subject, html: html }),
      });
    }));

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });

  } catch (err) {
    // Never break anything downstream -- this is a passive alert.
    return new Response(JSON.stringify({ ok: true, warn: err.message }), { status: 200, headers: CORS });
  }
}
'@

if (Test-Path $fnPath) {
  Write-Host "NOTE: $fnPath already exists -- backing up before overwrite" -ForegroundColor Yellow
  Copy-Item $fnPath "$fnPath.bak-alert-$stamp"
}
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $fnPath), $fnContent)

# Verify the new function: full content written + valid ESM syntax
$chk = [System.IO.File]::ReadAllText((Resolve-Path $fnPath).Path)
if (-not ($chk.Contains('export async function onRequest') -and $chk.Contains('Failed Checkout Alert') -and $chk.TrimEnd().EndsWith('}'))) {
  Write-Host 'FAIL: checkout-alert.js content incomplete after write' -ForegroundColor Red
  $fail = $true
} else {
  $tmp = Join-Path $env:TEMP 'checkout-alert-check.mjs'
  Copy-Item $fnPath $tmp -Force
  node --check $tmp
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'FAIL: node --check rejected checkout-alert.js -- DELETING so it cannot break the Pages build' -ForegroundColor Red
    Remove-Item $fnPath -Force
    $fail = $true
  } else {
    Write-Host 'OK: checkout-alert.js written and node --check passed (as .mjs)' -ForegroundColor Green
  }
  Remove-Item $tmp -ErrorAction SilentlyContinue
}

# ================= PART 2: beacon in index.html catch block =================
$f2 = 'index.html'
$raw2 = [System.IO.File]::ReadAllText((Resolve-Path $f2).Path)
$nl = "`n"; if ($raw2.Contains("`r`n")) { $nl = "`r`n" }

$anchor = @'
    if (errEl) { errEl.textContent = e.message; errEl.style.display = 'block'; }
'@
$anchor = $anchor.Trim("`r", "`n")

$beacon = @(
  '    // Failed-checkout alert: fire-and-forget, can never affect the customer flow.',
  '    try {',
  '      var _ca = {',
  '        error: String((e && e.message) || e).slice(0, 500),',
  '        stage: ''payment'',',
  '        name: (((document.getElementById(''fName'') || {}).value || '''') + '' '' + ((document.getElementById(''lName'') || {}).value || '''')).trim(),',
  '        email: (document.getElementById(''email'') || {}).value || '''',',
  '        phone: (document.getElementById(''phone'') || {}).value || '''',',
  '        orderId: window._pendingOrderId || '''',',
  '        total: (typeof payableGrandTotal === ''function'') ? payableGrandTotal().toFixed(2) : '''',',
  '        cart: (typeof cart !== ''undefined'' && cart && cart.map) ? cart.map(function (i) { return (i.qty || 1) + ''x '' + (i.brand || '''') + '' '' + (i.name || '''') + '' '' + (i.size || ''''); }).join(''; '') : '''',',
  '        userAgent: navigator.userAgent',
  '      };',
  '      fetch(''/checkout-alert'', { method: ''POST'', headers: { ''Content-Type'': ''application/json'' }, body: JSON.stringify(_ca) }).catch(function () {});',
  '    } catch (_beaconErr) {}'
) -join $nl

$count = ([regex]::Matches($raw2, [regex]::Escape($anchor))).Count
if ($count -ne 1) {
  Write-Host "FAIL: index.html catch-block anchor found $count times (expected 1) -- NOT patching" -ForegroundColor Red
  $fail = $true
} else {
  $linesBefore = ([System.IO.File]::ReadAllLines((Resolve-Path $f2).Path)).Count
  Copy-Item $f2 "$f2.bak-alert-$stamp"
  $raw2 = $raw2.Replace($anchor, $beacon + $nl + $anchor)
  [System.IO.File]::WriteAllText((Resolve-Path $f2).Path, $raw2)
  $linesAfter = ([System.IO.File]::ReadAllLines((Resolve-Path $f2).Path)).Count
  if (($linesAfter - $linesBefore) -ne 15) {
    Write-Host "FAIL: index.html line delta wrong ($linesBefore -> $linesAfter, expected +15) -- RESTORING BACKUP" -ForegroundColor Red
    Copy-Item "$f2.bak-alert-$stamp" $f2 -Force
    $fail = $true
  } else {
    Write-Host "OK: index.html beacon inserted (+15 lines, $linesAfter total)" -ForegroundColor Green
  }
}

# ================= Final checks =================
if (-not $fail) {
  $c2 = [System.IO.File]::ReadAllText((Resolve-Path $f2).Path)
  $okA = $c2.Contains('/checkout-alert')
  $okB = (Test-Path $fnPath)
  if ($okA -and $okB) {
    Write-Host ''
    Write-Host 'ALL CHECKS PASSED. Deploy with: .\push-pctires.ps1' -ForegroundColor Green
    Write-Host 'After deploy, alerts go to calebpostma@ and postmacontracting@ from alerts@pctires.ca' -ForegroundColor Green
  } else {
    Write-Host "FAIL: final check (beacon in index: $okA, function file: $okB)" -ForegroundColor Red
    $fail = $true
  }
}

if ($fail) { Write-Host 'PATCH DID NOT FULLY APPLY -- see messages above.' -ForegroundColor Red; exit 1 }
