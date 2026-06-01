# add-customer-receipt.ps1
# Replaces functions/send-payment-notification.js with a version that
# also sends a branded receipt email to the customer.
#
# Usage (PowerShell, from the PCtires repo root):
#   .\add-customer-receipt.ps1

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$target   = Join-Path $repoRoot 'functions\send-payment-notification.js'

if (-not (Test-Path $target)) {
  Write-Host "ERROR: $target not found. Run this from the PCtires repo root." -ForegroundColor Red
  exit 1
}

# 1) Backup
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "$target.bak-customer-receipt-$ts"
Copy-Item -Path $target -Destination $backup
Write-Host "Backed up existing file to:" -ForegroundColor Cyan
Write-Host "  $backup"

# 2) Write the new contents
$newContent = @'
/**
 * Cloudflare Pages Function: /functions/send-payment-notification.js
 *
 * Called after a successful invoice payment on /pay.
 * Sends two emails:
 *   1. Internal notification to PC Tires (calebpostma + postmacontracting)
 *   2. Branded receipt to the customer (if customerEmail provided)
 *
 * Environment variable required (already set in Cloudflare):
 *   RESEND_API_KEY - re_...
 */

const FROM_EMAIL    = 'payments@pctires.ca';
const NOTIFY_EMAILS = ['calebpostma@gmail.com', 'postmacontracting@gmail.com'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// --- Internal notification email (to Caleb) -------------------------------
function buildInternalEmail(p) {
  const amt = Number(p.amount).toFixed(2);
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}
  .card{background:#fff;border-radius:6px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
  .header{background:#111;padding:24px 28px}
  .logo{font-size:22px;font-weight:900;letter-spacing:2px;color:#f5c518}
  .header-sub{font-size:12px;color:#888;letter-spacing:1px;text-transform:uppercase;margin-top:2px}
  .body{padding:28px}
  .alert{background:#e7f6ec;border:1px solid #22c55e;border-radius:4px;padding:14px 16px;margin-bottom:22px;font-size:14px;font-weight:600;color:#111}
  table{width:100%;border-collapse:collapse;font-size:14px}
  td{padding:10px 0;border-bottom:1px solid #f0f0f0;vertical-align:top}
  td:first-child{color:#888;width:38%;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.5px}
  td:last-child{color:#111;font-weight:500}
  .amount{font-size:22px;font-weight:800;color:#f5c518;font-family:Arial,sans-serif}
  .footer{background:#f9f9f9;padding:16px 28px;font-size:12px;color:#aaa;border-top:1px solid #eee}
</style></head>
<body>
<div class="card">
  <div class="header">
    <div class="logo">PC TIRES</div>
    <div class="header-sub">Payment Received</div>
  </div>
  <div class="body">
    <div class="alert">&#x1F4B0; ${esc(p.customerName) || 'A customer'} paid $${esc(amt)} via /pay.</div>
    <table>
      <tr><td>Amount</td><td><span class="amount">$${esc(amt)} ${esc(p.currency || 'CAD')}</span></td></tr>
      ${p.invoiceNumber ? `<tr><td>Invoice #</td><td>${esc(p.invoiceNumber)}</td></tr>` : ''}
      <tr><td>Description</td><td>${esc(p.description) || '&mdash;'}</td></tr>
      <tr><td>Customer</td><td>${esc(p.customerName) || '&mdash;'}</td></tr>
      <tr><td>Email</td><td>${p.customerEmail ? `<a href="mailto:${esc(p.customerEmail)}">${esc(p.customerEmail)}</a>` : '&mdash;'}</td></tr>
      <tr><td>Phone</td><td>${p.customerPhone ? `<a href="tel:${esc(p.customerPhone)}">${esc(p.customerPhone)}</a>` : '&mdash;'}</td></tr>
      <tr><td>Stripe Payment</td><td style="font-family:monospace;font-size:12px">${esc(p.paymentIntentId) || '&mdash;'}</td></tr>
      ${p.notes ? `<tr><td>Notes</td><td>${esc(p.notes)}</td></tr>` : ''}
    </table>
  </div>
  <div class="footer">PC Tires &middot; 7144 Grande River Line, Pain Court, ON &middot; 519-397-4686</div>
</div>
</body>
</html>`;
}

// --- Customer receipt email (to customer) ---------------------------------
function buildCustomerReceipt(p) {
  const amt = Number(p.amount).toFixed(2);
  const firstName = (p.customerName || '').split(' ')[0] || 'there';
  const dateStr = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0e0e0e;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#e0e0e0">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">

    <!-- Header -->
    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:4px;padding:28px 32px;margin-bottom:16px;text-align:center">
      <div style="font-size:28px;font-weight:900;letter-spacing:2px;color:#f5c518">PC TIRES</div>
      <div style="font-size:12px;color:#888;letter-spacing:1px;margin-top:4px">CHATHAM-KENT &middot; 519-397-4686</div>
    </div>

    <!-- Confirmation banner -->
    <div style="background:#1a2a1a;border:1px solid #2a4a2a;border-radius:4px;padding:20px 32px;margin-bottom:16px;text-align:center">
      <div style="font-size:32px;margin-bottom:8px">&#x2705;</div>
      <div style="font-size:20px;font-weight:700;color:#4ade80">Payment Received</div>
      <div style="font-size:14px;color:#888;margin-top:6px">Thanks, ${esc(firstName)} &mdash; your payment has been processed.</div>
    </div>

    <!-- Amount -->
    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:4px;padding:24px 32px;margin-bottom:16px;text-align:center">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin-bottom:8px;font-weight:700">Amount Paid</div>
      <div style="font-size:42px;font-weight:900;color:#f5c518;line-height:1">$${esc(amt)} <span style="font-size:18px;color:#888;font-weight:600">${esc(p.currency || 'CAD')}</span></div>
    </div>

    <!-- Details -->
    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:4px;padding:20px 32px;margin-bottom:16px">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a">Date</td>
          <td style="padding:8px 0;text-align:right;color:#e0e0e0;border-bottom:1px solid #2a2a2a">${esc(dateStr)}</td>
        </tr>
        ${p.invoiceNumber ? `<tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a">Reference</td>
          <td style="padding:8px 0;text-align:right;color:#f5c518;font-family:monospace;font-weight:700;border-bottom:1px solid #2a2a2a">${esc(p.invoiceNumber)}</td>
        </tr>` : ''}
        ${p.description ? `<tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a">Description</td>
          <td style="padding:8px 0;text-align:right;color:#e0e0e0;border-bottom:1px solid #2a2a2a">${esc(p.description)}</td>
        </tr>` : ''}
        ${p.customerName ? `<tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a">Paid by</td>
          <td style="padding:8px 0;text-align:right;color:#e0e0e0;border-bottom:1px solid #2a2a2a">${esc(p.customerName)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px">Payment ID</td>
          <td style="padding:8px 0;text-align:right;color:#888;font-family:monospace;font-size:11px">${esc(p.paymentIntentId) || '&mdash;'}</td>
        </tr>
      </table>
    </div>

    <!-- Thank you -->
    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:4px;padding:20px 32px;margin-bottom:24px;text-align:center">
      <div style="font-size:14px;color:#e0e0e0;line-height:1.6">Thanks for your business. Keep this email as your receipt.<br>Questions about the work or your invoice? Just reply or give us a call.</div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;font-size:12px;color:#555;line-height:1.8">
      <div>PC Tires &middot; 7144 Grande River Line, Pain Court, ON N0P 1Z0</div>
      <div>&#x1F4DE; 519-397-4686 &middot; payments@pctires.ca &middot; pctires.ca</div>
    </div>

  </div>
</body>
</html>`;
}

// --- Send via Resend -------------------------------------------------------
async function sendEmail(resendKey, { to, subject, html, replyTo }) {
  const body = { from: FROM_EMAIL, to, subject, html };
  if (replyTo) body.reply_to = replyTo;
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// --- Main handler ----------------------------------------------------------
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST')   return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });

  try {
    const req = await request.json();
    const { amount, customerName, customerEmail, invoiceNumber } = req;

    const resendKey = env.RESEND_API_KEY;
    if (!resendKey) {
      console.warn('RESEND_API_KEY not set');
      return new Response(JSON.stringify({ ok: true, warn: 'Email not sent - API key missing' }), { status: 200, headers: CORS });
    }

    const amtStr = Number(amount).toFixed(2);

    // 1) Internal notification (always)
    const internalSubject = `[PC Tires] Payment Received - $${amtStr} - ${customerName || 'Customer'}`;
    const internalHtml = buildInternalEmail(req);
    const sends = NOTIFY_EMAILS.map(to => sendEmail(resendKey, {
      to, subject: internalSubject, html: internalHtml,
      replyTo: customerEmail || undefined,
    }));

    // 2) Customer receipt (if valid email provided)
    let customerSent = false;
    if (customerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      const customerSubject = `Payment Received${invoiceNumber ? ' - ' + invoiceNumber : ''} - PC Tires`;
      const customerHtml = buildCustomerReceipt(req);
      sends.push(sendEmail(resendKey, {
        to: customerEmail, subject: customerSubject, html: customerHtml,
        replyTo: 'payments@pctires.ca',
      }));
      customerSent = true;
    }

    await Promise.all(sends);

    return new Response(JSON.stringify({ ok: true, customerReceiptSent: customerSent }), { status: 200, headers: CORS });

  } catch (err) {
    console.error('send-payment-notification error:', err.message);
    return new Response(JSON.stringify({ ok: true, warn: err.message }), { status: 200, headers: CORS });
  }
}
'@

# UTF-8 without BOM, LF line endings
$newContent = $newContent -replace "`r`n", "`n"
[System.IO.File]::WriteAllText($target, $newContent, [System.Text.UTF8Encoding]::new($false))

# 3) Verify
$lineCount = (Get-Content $target | Measure-Object -Line).Lines
$size      = (Get-Item $target).Length
Write-Host ""
Write-Host "Wrote new file:" -ForegroundColor Green
Write-Host "  $target"
Write-Host "  Lines: $lineCount"
Write-Host "  Size:  $size bytes"

# 4) Syntax check
Write-Host ""
Write-Host "Running node --check..." -ForegroundColor Cyan
$nodeCheck = & node --check $target 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "  Syntax OK" -ForegroundColor Green
} else {
  Write-Host "  SYNTAX ERROR:" -ForegroundColor Red
  Write-Host $nodeCheck -ForegroundColor Red
  Write-Host ""
  Write-Host "Restoring backup..." -ForegroundColor Yellow
  Copy-Item -Path $backup -Destination $target -Force
  exit 1
}

# 5) Verify key functions are present
Write-Host ""
Write-Host "Checking expected content..." -ForegroundColor Cyan
$content = Get-Content $target -Raw
$checks = @(
  @{ Name = 'buildInternalEmail function'; Pattern = 'function buildInternalEmail' },
  @{ Name = 'buildCustomerReceipt function'; Pattern = 'function buildCustomerReceipt' },
  @{ Name = 'Customer email sender'; Pattern = 'customerReceiptSent' },
  @{ Name = 'Internal notify list';   Pattern = 'calebpostma@gmail.com' }
)
foreach ($c in $checks) {
  if ($content -match $c.Pattern) {
    Write-Host ("  OK  " + $c.Name) -ForegroundColor Green
  } else {
    Write-Host ("  MISSING  " + $c.Name) -ForegroundColor Red
    Write-Host "Restoring backup..." -ForegroundColor Yellow
    Copy-Item -Path $backup -Destination $target -Force
    exit 1
  }
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host " DONE. Now deploy with:  .\push-pctires.ps1" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
