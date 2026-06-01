# improve-internal-email.ps1
# Rewrites the buildInternalEmail function in functions/send-order-email.js
# to:
#   1. Show the customer charge breakdown including HST line item
#   2. Replace the Raw TDG Response JSON dump with a clean labeled
#      cost breakdown (subtotal, shipping, fees, HST, total, gross margin)
#   3. Use a card-based layout that matches the customer email styling
#
# Usage (PowerShell, from the PCtires repo root):
#   .\improve-internal-email.ps1

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$target   = Join-Path $repoRoot 'functions\send-order-email.js'

if (-not (Test-Path $target)) {
  Write-Host "ERROR: $target not found. Run this from the PCtires repo root." -ForegroundColor Red
  exit 1
}

# 1) Backup
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "$target.bak-internal-email-$ts"
Copy-Item -Path $target -Destination $backup
Write-Host "Backed up to: $backup" -ForegroundColor Cyan

# 2) Read existing file
$content = [System.IO.File]::ReadAllText($target)

# 3) Define the new buildInternalEmail function (pure ASCII; emoji as HTML entities)
$newFunction = @'
function buildInternalEmail(order, tdgOrder, tdgError) {
  const tdgRef = extractTDGRef(tdgOrder) || 'NOT FOUND';
  const tdgStatus = tdgError
    ? `&#x274C; TDG ORDER FAILED: ${JSON.stringify(tdgError)}`
    : tdgOrder?.skipped
    ? `&#x26A0;&#xFE0F; SKIPPED: ${tdgOrder.reason}`
    : `&#x2705; TDG Order: ${tdgRef}`;

  // TDG cost breakdown -- replaces the old Raw TDG Response JSON dump
  const t = (!tdgError && tdgOrder && !tdgOrder.skipped) ? tdgOrder : null;
  const cost = t ? {
    subtotal: Number(t.subtotal || 0),
    shipping: Number(t.shipping || 0),
    fees:     Number(t.fees || 0),
    tax:      Number(t.tax || 0),
    total:    Number(t.total || 0),
    currency: t.currency || 'CAD',
    orderNum: t.orderNumber || '-',
    ref:      t.reference || '-',
  } : null;

  // Gross margin = customer total - TDG total (both incl. tax/fees)
  const margin = (cost && order.total) ? (Number(order.total) - cost.total) : null;
  const marginPct = (margin !== null && order.total) ? Math.round((margin / Number(order.total)) * 100) : null;

  const money = n => `$${Number(n).toFixed(2)}`;

  const itemsHtml = (order.tires || [])
    .map(t => `${t.qty}&times; ${t.brand} ${t.name} <span style="color:#888">(${t.size || (t.diameter + '\"')})</span>`)
    .join('<br>');

  const phoneDigits = String(order.customerPhone || '').replace(/\D/g, '');

  const cardStyle = 'background:#161616;border:1px solid #2a2a2a;border-radius:4px;padding:16px 20px;margin-bottom:14px';
  const hdrStyle  = 'font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:10px;font-weight:700';
  const rowLbl    = 'padding:5px 0;color:#888;width:55%;font-size:14px';
  const rowVal    = 'padding:5px 0;text-align:right;color:#e0e0e0;font-size:14px';

  return `<!DOCTYPE html>
<html>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#0e0e0e;color:#e0e0e0;padding:24px;margin:0">
<div style="max-width:640px;margin:0 auto">

  <h2 style="color:#f5c518;margin:0 0 6px;font-size:22px;font-weight:800">&#x1F6DE; New Order &mdash; ${order.orderNumber}</h2>
  <p style="margin:0 0 18px;color:${tdgError ? '#ef4444' : tdgOrder?.skipped ? '#f5c518' : '#4ade80'};font-size:14px">${tdgStatus}</p>

  <!-- Customer -->
  <div style="${cardStyle}">
    <div style="${hdrStyle}">Customer</div>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="${rowLbl}">Name</td><td style="${rowVal}">${order.customerName || '-'}</td></tr>
      <tr><td style="${rowLbl}">Email</td><td style="${rowVal}">${order.customerEmail ? `<a href="mailto:${order.customerEmail}" style="color:#f5c518;text-decoration:none">${order.customerEmail}</a>` : '-'}</td></tr>
      <tr><td style="${rowLbl}">Phone</td><td style="${rowVal}">${order.customerPhone ? `<a href="tel:${phoneDigits}" style="color:#f5c518;text-decoration:none">${order.customerPhone}</a>` : '-'}</td></tr>
      <tr><td style="${rowLbl}">Vehicle</td><td style="${rowVal}">${order.vehicle || '-'}</td></tr>
    </table>
  </div>

  <!-- Items -->
  <div style="${cardStyle}">
    <div style="${hdrStyle}">Items</div>
    <div style="font-size:14px;line-height:1.7">${itemsHtml || '-'}</div>
    <div style="margin-top:10px;font-size:13px;color:#888">Add-ons: <span style="color:#e0e0e0">${order.addons || 'None'}</span></div>
  </div>

  <!-- Customer charge breakdown (with HST line item) -->
  <div style="${cardStyle}">
    <div style="${hdrStyle}">Customer Charged</div>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="${rowLbl}">Subtotal (tires)</td><td style="${rowVal}">${money(order.subtotal || 0)}</td></tr>
      ${order.discount && Number(order.discount) > 0 ? `<tr><td style="padding:5px 0;color:#22c55e;font-size:14px">Discount${order.discountCode ? ` (${order.discountCode})` : ''}</td><td style="padding:5px 0;text-align:right;color:#22c55e;font-size:14px">-${money(order.discount)}</td></tr>` : ''}
      ${order.addonTotal > 0 ? `<tr><td style="${rowLbl}">Add-ons</td><td style="${rowVal}">${money(order.addonTotal)}</td></tr>` : ''}
      <tr><td style="${rowLbl}">HST (13%)</td><td style="${rowVal}">${money(order.tax || 0)}</td></tr>
      <tr style="border-top:1px solid #2a2a2a">
        <td style="padding:9px 0 0;color:#fff;font-weight:700;font-size:14px">Total Charged</td>
        <td style="padding:9px 0 0;text-align:right;color:#f5c518;font-weight:800;font-size:17px">${money(order.total || 0)} ${order.currency || 'CAD'}</td>
      </tr>
    </table>
  </div>

  ${cost ? `
  <!-- PC Tires cost (TDG) -- formatted, no more raw JSON -->
  <div style="${cardStyle}">
    <div style="${hdrStyle}">PC Tires Cost (TDG)</div>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="${rowLbl}">TDG Order #</td><td style="${rowVal};font-family:monospace;font-size:13px">${cost.orderNum}</td></tr>
      <tr><td style="${rowLbl}">Reference</td><td style="${rowVal};font-family:monospace;font-size:13px">${cost.ref}</td></tr>
      <tr><td style="${rowLbl}">Subtotal</td><td style="${rowVal}">${money(cost.subtotal)}</td></tr>
      ${cost.shipping > 0 ? `<tr><td style="${rowLbl}">Shipping</td><td style="${rowVal}">${money(cost.shipping)}</td></tr>` : ''}
      ${cost.fees > 0 ? `<tr><td style="${rowLbl}">Fees</td><td style="${rowVal}">${money(cost.fees)}</td></tr>` : ''}
      <tr><td style="${rowLbl}">HST (TDG paid)</td><td style="${rowVal}">${money(cost.tax)}</td></tr>
      <tr style="border-top:1px solid #2a2a2a">
        <td style="padding:9px 0 0;color:#fff;font-weight:700;font-size:14px">Total Cost</td>
        <td style="padding:9px 0 0;text-align:right;color:#fff;font-weight:800;font-size:15px">${money(cost.total)} ${cost.currency}</td>
      </tr>
      ${margin !== null ? `<tr>
        <td style="padding:5px 0 0;color:#4ade80;font-weight:700;font-size:14px">Gross Margin</td>
        <td style="padding:5px 0 0;text-align:right;color:#4ade80;font-weight:800;font-size:17px">${money(margin)}${marginPct !== null ? ` <span style="color:#888;font-weight:500;font-size:12px">(${marginPct}%)</span>` : ''}</td>
      </tr>` : ''}
    </table>
    <div style="font-size:11px;color:#666;margin-top:8px;line-height:1.4">Margin = Customer Total &minus; TDG Total. Both include HST and fees. Net margin after HST reconciliation will differ.</div>
  </div>` : ''}

  <!-- Install + source -->
  <div style="${cardStyle}">
    <div style="${hdrStyle}">Install &amp; Source</div>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="${rowLbl}">Install</td><td style="${rowVal}">${order.appointmentDate ? `${order.appointmentDate} at ${order.appointmentTime} &mdash; ${order.serviceName}` : 'Not booked'}</td></tr>
      <tr><td style="${rowLbl}">Search Method</td><td style="${rowVal}">${order.searchMethod || '-'}</td></tr>
      <tr><td style="${rowLbl}">CASL Opt-in</td><td style="${rowVal}">${order.caslOptIn ? 'Yes' : 'No'}</td></tr>
    </table>
  </div>

</div>
</body>
</html>`;
}
'@

# 4) Replace the old function via regex
# Match: from "function buildInternalEmail(" through the closing brace,
# stopping just before "async function sendEmail" (the next named function)
$pattern = '(?s)function buildInternalEmail\(order, tdgOrder, tdgError\) \{.*?\n\}\n(?=\n// -)'
# Use a more forgiving pattern in case the box-drawing comment differs slightly.
# Try matching up to "async function sendEmail" instead -- that is robust.
$pattern = '(?s)function buildInternalEmail\(order, tdgOrder, tdgError\) \{.*?(?=\nasync function sendEmail)'

if ($content -notmatch $pattern) {
  Write-Host "ERROR: buildInternalEmail function block not found in expected shape." -ForegroundColor Red
  Write-Host "Restoring backup..." -ForegroundColor Yellow
  Copy-Item -Path $backup -Destination $target -Force
  exit 1
}

# Make sure there is exactly one match
$matches = [regex]::Matches($content, $pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
if ($matches.Count -ne 1) {
  Write-Host ("ERROR: Expected exactly 1 match for buildInternalEmail, got " + $matches.Count) -ForegroundColor Red
  Copy-Item -Path $backup -Destination $target -Force
  exit 1
}

$newContent = [regex]::Replace($content, $pattern, [System.Text.RegularExpressions.Regex]::Escape($newFunction).Replace('\$','$').Replace('\','\\'), [System.Text.RegularExpressions.RegexOptions]::Singleline)

# The escape dance above is fragile. Use a literal substitution instead via MatchEvaluator.
$evaluator = [System.Text.RegularExpressions.MatchEvaluator]{ param($m) return $newFunction }
$newContent = [regex]::Replace($content, $pattern, $evaluator, [System.Text.RegularExpressions.RegexOptions]::Singleline)

# 5) Write with UTF-8 (no BOM), LF endings
$newContent = $newContent -replace "`r`n", "`n"
[System.IO.File]::WriteAllText($target, $newContent, [System.Text.UTF8Encoding]::new($false))

# 6) Verify line count, size
$size = (Get-Item $target).Length
$lineCount = (Get-Content $target | Measure-Object -Line).Lines
Write-Host ""
Write-Host "Wrote new file:" -ForegroundColor Green
Write-Host "  Lines: $lineCount"
Write-Host "  Size:  $size bytes"

# 7) Syntax check
Write-Host ""
Write-Host "Running node --check..." -ForegroundColor Cyan
$nodeCheck = & node --check $target 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "  Syntax OK" -ForegroundColor Green
} else {
  Write-Host "  SYNTAX ERROR:" -ForegroundColor Red
  Write-Host $nodeCheck -ForegroundColor Red
  Write-Host "Restoring backup..." -ForegroundColor Yellow
  Copy-Item -Path $backup -Destination $target -Force
  exit 1
}

# 8) Verify expected markers
Write-Host ""
Write-Host "Checking expected content..." -ForegroundColor Cyan
$check = Get-Content $target -Raw
$checks = @(
  @{ Name = 'New function present';     Pattern = 'function buildInternalEmail\(order, tdgOrder, tdgError\)' },
  @{ Name = 'HST line in customer charge'; Pattern = 'HST \(13%\)' },
  @{ Name = 'TDG cost breakdown card';  Pattern = 'PC Tires Cost \(TDG\)' },
  @{ Name = 'Gross Margin row';         Pattern = 'Gross Margin' },
  @{ Name = 'Old JSON dump removed';    Pattern = 'JSON.stringify\(tdgOrder, null, 2\)'; ShouldNotMatch = $true },
  @{ Name = 'sendEmail function intact'; Pattern = 'async function sendEmail' }
)
$failures = 0
foreach ($c in $checks) {
  $found = $check -match $c.Pattern
  $shouldNot = $c.ContainsKey('ShouldNotMatch') -and $c.ShouldNotMatch
  $ok = if ($shouldNot) { -not $found } else { $found }
  if ($ok) {
    Write-Host ("  OK  " + $c.Name) -ForegroundColor Green
  } else {
    Write-Host ("  FAIL  " + $c.Name) -ForegroundColor Red
    $failures++
  }
}

if ($failures -gt 0) {
  Write-Host ""
  Write-Host "Verification failed. Restoring backup..." -ForegroundColor Yellow
  Copy-Item -Path $backup -Destination $target -Force
  exit 1
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host " DONE. Now deploy with:  .\push-pctires.ps1" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
