# =============================================
#  patch-email-install-line.ps1
#  Adds an "Installation" dollar line to the INTERNAL order email
#  (the one Caleb gets), so the breakdown reads:
#    Subtotal (tires)  $x
#    Installation      $x     <- NEW (was buried in the total)
#    Add-ons           $x     (only when present)
#    Discount         -$x     (only when present)
#    HST (13%)         $x
#    Total             $x
#
#  Root cause: the order payload never carried the install amount.
#  This patch adds installTotal to the payload (index.html) and the
#  row to the internal email (functions/send-order-email.js).
#  Old orders without the field simply do not show the row.
#
#  RUN:
#    cd C:\Users\Caleb\Documents\Claude\Projects\PCtires
#    .\patch-email-install-line.ps1
#  Then deploy with .\push-pctires.ps1
# =============================================

$dest = "C:\Users\Caleb\Documents\Claude\Projects\PCtires"
$indexPath = Join-Path $dest "index.html"
$emailPath = Join-Path $dest "functions\send-order-email.js"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$bakDir = "C:\Users\Caleb\Documents\PCtires-quarantine\emailinstall-backup-$stamp"

New-Item -ItemType Directory -Path $bakDir -Force | Out-Null
Copy-Item $indexPath (Join-Path $bakDir "index.html")
Copy-Item $emailPath (Join-Path $bakDir "send-order-email.js")
Write-Host "Backups saved to $bakDir" -ForegroundColor DarkGray

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
$js   = [IO.File]::ReadAllText($emailPath).Replace("`r`n", "`n")

# R1: order payload carries the install dollars
$old = @'
    subtotal: t.sub,
'@
$new = @'
    subtotal: t.sub,
    installTotal: t.inst,
'@
$html = Replace-Once $html $old $new "R1 payload installTotal"

# E1: Installation row in the internal email, right under Subtotal (tires)
$old = @'
      <tr><td style="${rowLbl}">Subtotal (tires)</td><td style="${rowVal}">${money(order.subtotal || 0)}</td></tr>
'@
$new = @'
      <tr><td style="${rowLbl}">Subtotal (tires)</td><td style="${rowVal}">${money(order.subtotal || 0)}</td></tr>
      ${order.installTotal > 0 ? `<tr><td style="${rowLbl}">Installation</td><td style="${rowVal}">${money(order.installTotal)}</td></tr>` : ''}
'@
$js = Replace-Once $js $old $new "E1 internal install row"

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

# Verify
$vFail = $false
if (([regex]::Matches($html, "installTotal: t\.inst,")).Count -eq 1) {
    Write-Host "  OK  installTotal in payload" -ForegroundColor Green
} else { Write-Host "  BAD installTotal in payload" -ForegroundColor Red; $vFail = $true }
if (([regex]::Matches($js, "order\.installTotal")).Count -eq 2) {
    Write-Host "  OK  install row in internal email" -ForegroundColor Green
} else { Write-Host "  BAD install row references" -ForegroundColor Red; $vFail = $true }

if (Get-Command node -ErrorAction SilentlyContinue) {
    $tmpMjs = Join-Path $env:TEMP "send-order-email-check.mjs"
    Copy-Item $emailPath $tmpMjs -Force
    $nodeOk = $false
    try {
        & node --check $tmpMjs 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $nodeOk = $true }
    } catch {}
    if ($nodeOk) { Write-Host "  OK  node --check send-order-email.js (ESM)" -ForegroundColor Green }
    else { Write-Host "  BAD node --check FAILED" -ForegroundColor Red; $vFail = $true }
    Remove-Item $tmpMjs -ErrorAction SilentlyContinue
} else {
    Write-Host "  WARN node not found - syntax check skipped" -ForegroundColor Yellow
}

if ($vFail) {
    Write-Host "VERIFICATION FAILED - restoring backups." -ForegroundColor Red
    Copy-Item (Join-Path $bakDir "index.html") $indexPath -Force
    Copy-Item (Join-Path $bakDir "send-order-email.js") $emailPath -Force
    Write-Host "Originals restored. Nothing deployed." -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host ""
Write-Host "PATCH APPLIED. Deploy with .\push-pctires.ps1" -ForegroundColor Cyan
Write-Host "Next real order email will show: Subtotal (tires) / Installation /" -ForegroundColor White
Write-Host "HST / Total. Orders placed before this deploy won't have the row." -ForegroundColor White
Read-Host "Press Enter to close"
