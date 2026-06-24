# ============================================================
#  patch-order-email-breakdown.ps1
#  Rebuilds the "Customer Charged" section of the internal order email so it
#  itemizes:  Tires / Add-ons / Install / (Discount) / Subtotal / HST / Total
#
#   - Adds the missing INSTALL line (install $ is now sent from checkout)
#   - Lines reconcile: Subtotal + HST = Total
#
#  Edits 2 files:
#    index.html                     -> sends install in the order payload
#    functions/send-order-email.js  -> new line-item layout
#
#  Run from the repo folder:   .\patch-order-email-breakdown.ps1
#  Then deploy:                .\push-pctires.ps1
#  AFTER DEPLOY: confirm Cloudflare Pages > Deployments shows "Success"
#  (this touches a /functions file; a broken one fails the whole build silently).
# ============================================================
$ErrorActionPreference = 'Stop'

$idxPath = Join-Path $PSScriptRoot 'index.html'
$soePath = Join-Path $PSScriptRoot 'functions\send-order-email.js'
foreach ($p in @($idxPath, $soePath)) {
  if (-not (Test-Path -LiteralPath $p)) { Write-Host "ERROR: not found: $p" -ForegroundColor Red; exit 1 }
}

$idx = [System.IO.File]::ReadAllText($idxPath)
$soe = [System.IO.File]::ReadAllText($soePath)

if ($idx.Contains('install: t.inst,') -or $soe.Contains('>Install</td>')) {
  Write-Host "Already patched (install line present). No changes made." -ForegroundColor Yellow
  exit 0
}

$nlIdx = if ($idx.Contains("`r`n")) { "`r`n" } else { "`n" }
$nlSoe = if ($soe.Contains("`r`n")) { "`r`n" } else { "`n" }

# ---- index.html: include install in the order payload ----
$aIdx = '    subtotal: t.sub,'
$cnt = ([regex]::Matches($idx, [regex]::Escape($aIdx))).Count
if ($cnt -ne 1) { Write-Host "ANCHOR FAIL index.html (subtotal line found $cnt, expected 1)" -ForegroundColor Red; exit 1 }
$idxNew = $idx.Replace($aIdx, $aIdx + $nlIdx + '    install: t.inst,')

# ---- send-order-email.js: replace the Customer Charged block ----
$start   = '  <!-- Customer charge breakdown (with HST line item) -->'
$endMark = '    </table>' + $nlSoe + '  </div>'
$s = $soe.IndexOf($start)
if ($s -lt 0) { Write-Host "ANCHOR FAIL: charge-breakdown comment not found" -ForegroundColor Red; exit 1 }
$e = $soe.IndexOf($endMark, $s)
if ($e -lt 0) { Write-Host "ANCHOR FAIL: block end marker not found" -ForegroundColor Red; exit 1 }
$e = $e + $endMark.Length
$oldBlock = $soe.Substring($s, ($e - $s))

$newBlock = @'
  <!-- Customer charge breakdown -->
  <div style="${cardStyle}">
    <div style="${hdrStyle}">Customer Charged</div>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="${rowLbl}">Tires</td><td style="${rowVal}">${money(order.subtotal || 0)}</td></tr>
      <tr><td style="${rowLbl}">Add-ons</td><td style="${rowVal}">${money(order.addonTotal || 0)}</td></tr>
      <tr><td style="${rowLbl}">Install</td><td style="${rowVal}">${money(order.install || 0)}</td></tr>
      ${order.discount && Number(order.discount) > 0 ? `<tr><td style="padding:5px 0;color:#22c55e;font-size:14px">Discount${order.discountCode ? ` (${order.discountCode})` : ''}</td><td style="padding:5px 0;text-align:right;color:#22c55e;font-size:14px">-${money(order.discount)}</td></tr>` : ''}
      <tr><td style="padding:8px 0 5px;border-top:1px solid #2a2a2a;color:#bbb;font-size:14px">Subtotal</td><td style="padding:8px 0 5px;border-top:1px solid #2a2a2a;text-align:right;color:#e0e0e0;font-size:14px">${money((Number(order.subtotal)||0)+(Number(order.addonTotal)||0)+(Number(order.install)||0)-(Number(order.discount)||0))}</td></tr>
      <tr><td style="${rowLbl}">HST (13%)</td><td style="${rowVal}">${money(order.tax || 0)}</td></tr>
      <tr style="border-top:1px solid #2a2a2a">
        <td style="padding:9px 0 0;color:#fff;font-weight:700;font-size:14px">Total Charged</td>
        <td style="padding:9px 0 0;text-align:right;color:#f5c518;font-weight:800;font-size:17px">${money(order.total || 0)} ${order.currency || 'CAD'}</td>
      </tr>
    </table>
  </div>
'@
# normalize the here-string to the file's line endings
$newBlock = $newBlock -replace "`r`n", "`n"
if ($nlSoe -eq "`r`n") { $newBlock = $newBlock -replace "`n", "`r`n" }

$soeNew = $soe.Replace($oldBlock, $newBlock)

# ---- validate patched function as ESM BEFORE writing (build-killer guard) ----
$nodeOk = $null
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  $tmp = Join-Path $env:TEMP ('soe-check-' + (Get-Date -Format 'yyyyMMddHHmmss') + '.mjs')
  [System.IO.File]::WriteAllText($tmp, $soeNew, (New-Object System.Text.UTF8Encoding($false)))
  & node --check $tmp
  $nodeOk = ($LASTEXITCODE -eq 0)
  Remove-Item $tmp -ErrorAction SilentlyContinue
  if (-not $nodeOk) {
    Write-Host "ABORT: patched send-order-email.js failed node --check. Nothing written." -ForegroundColor Red
    exit 1
  }
}

# ---- backup (outside repo) + write both ----
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$par = Split-Path $PSScriptRoot -Parent
[System.IO.File]::Copy($idxPath, (Join-Path $par "index.html.bak-$stamp"), $true)
[System.IO.File]::Copy($soePath, (Join-Path $par "send-order-email.js.bak-$stamp"), $true)
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($idxPath, $idxNew, $utf8)
[System.IO.File]::WriteAllText($soePath, $soeNew, $utf8)

# ---- verify ----
$vi = [System.IO.File]::ReadAllText($idxPath)
$vs = [System.IO.File]::ReadAllText($soePath)
$checkMsg = if ($nodeOk) { 'passed' } else { 'skipped (node not on PATH)' }
Write-Host ""
Write-Host "PATCH APPLIED" -ForegroundColor Green
Write-Host ("  backups in: {0}" -f $par)
Write-Host ("  node --check: {0}" -f $checkMsg)
$okI = if ($vi.Contains('install: t.inst,')) { 'ok' } else { 'MISSING' }
Write-Host "  [$okI] index.html sends install"
foreach ($m in @('>Tires</td>', '>Install</td>', '>Subtotal</td>')) {
  $ok = if ($vs.Contains($m)) { 'ok' } else { 'MISSING' }
  Write-Host "  [$ok] email row $m"
}
Write-Host ""
Write-Host "Next:  .\push-pctires.ps1" -ForegroundColor Cyan
Write-Host "After deploy, confirm Cloudflare Pages > Deployments shows Success." -ForegroundColor Cyan
