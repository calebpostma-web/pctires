# patch-swap-pricing.ps1
# Aligns service pricing across index.html, swap.html, seasonal-changeover.html
#   - Seasonal swap: $15/tire ($60/set) everywhere (was $20 on index/changeover, $17.50 on swap.html)
#   - swap.html flat repair: plug @ $25/20min -> proper patch @ $45/45min (matches index policy)
#   - swap.html valve stems: $15/20min -> $25/30min (matches index)
#   - swap.html customer-supplied mount: $25/tire -> $40/tire (matches index)
# Run from the PCtires repo root:  .\patch-swap-pricing.ps1
# Then deploy with:                .\push-pctires.ps1

$ErrorActionPreference = "Stop"
$em = [string][char]0x2014   # em dash
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$failed = $false

function Get-Count([string]$hay, [string]$needle) {
    if ($needle.Length -eq 0) { return 0 }
    return ([regex]::Matches($hay, [regex]::Escape($needle))).Count
}

# ============ FILE 1: index.html ============
$f1 = Join-Path $PSScriptRoot "index.html"
$c1 = [System.IO.File]::ReadAllText($f1)
$r1 = @(
    @{ old = 'duration:60, price:20, unit:''per tire'''; new = 'duration:60, price:15, unit:''per tire''' },
    @{ old = 'price:''$20'',   unit:''per tire'', duration:45'; new = 'price:''$15'',   unit:''per tire'', duration:45' }
)

# ============ FILE 2: swap.html ============
$f2 = Join-Path $PSScriptRoot "swap.html"
$c2 = [System.IO.File]::ReadAllText($f2)
$nl2 = "`n"; if ($c2.Contains("`r`n")) { $nl2 = "`r`n" }
$r2 = @(
    @{ old = 'price: ''$17.50/tire'','; new = 'price: ''$15/tire'',' },
    @{ old = '$17.50/tire or $70/set'; new = '$15/tire or $60/set' },
    @{ old = 'name: ''Flat Repair / Plug'','; new = ('name: ''Flat Repair ' + $em + ' Proper Patch'',') },
    @{ old = 'sub: ''Quick plug for a tread puncture. <strong>Includes remount and balance. 20 minutes.</strong>'','; new = ('sub: ''Tire dismounted and internally patched ' + $em + ' the safe, long-term fix. <strong>Includes remount and balance. 45 minutes.</strong>'',') },
    @{ old = ('price: ''$25'',' + $nl2 + '    duration: 20,'); new = ('price: ''$45'',' + $nl2 + '    duration: 45,') },
    @{ old = 'Flat tire repair at PC Tires in Pain Court. $25, 20 minutes including remount and balance.'; new = 'Flat tire repair at PC Tires in Pain Court. $45, 45 minutes including dismount, internal patch, remount and balance.' },
    @{ old = '<strong>$15 per stem, 20 minutes.</strong>'; new = '<strong>$25 per stem, 30 minutes.</strong>' },
    @{ old = ('price: ''$15/stem'',' + $nl2 + '    duration: 20,'); new = ('price: ''$25/stem'',' + $nl2 + '    duration: 30,') },
    @{ old = 'Valve stem replacement at PC Tires in Pain Court. $15 per stem, 20 minutes.'; new = 'Valve stem replacement at PC Tires in Pain Court. $25 per stem, 30 minutes.' },
    @{ old = 'price: ''$25/tire'','; new = 'price: ''$40/tire'',' },
    @{ old = 'Tire mount and balance at PC Tires in Pain Court. $25/tire, includes TPMS reset and disposal.'; new = 'Tire mount and balance at PC Tires in Pain Court. $40/tire, includes TPMS reset and disposal.' }
)

# ============ FILE 3: seasonal-changeover.html ============
$f3 = Join-Path $PSScriptRoot "seasonal-changeover.html"
$c3 = [System.IO.File]::ReadAllText($f3)
# multi-occurrence replacements (count checked dynamically)
$r3multi = @(
    @{ old = '$20/Tire'; new = '$15/Tire' },
    @{ old = '$20/tire'; new = '$15/tire' },
    @{ old = '$20 per tire'; new = '$15 per tire' }
)
$r3single = @(
    @{ old = '<div>$20</div>'; new = '<div>$15</div>' },
    @{ old = '<div>$80</div>'; new = '<div>$60</div>' },
    @{ old = 'Each subsequent winter swap: $80.'; new = 'Each subsequent winter swap: $60.' }
)

# ---------- Pre-checks ----------
foreach ($r in $r1) {
    $n = Get-Count $c1 $r.old
    if ($n -ne 1) { Write-Host "PRECHECK FAIL index.html ($n found): $($r.old)" -ForegroundColor Red; $failed = $true }
}
foreach ($r in $r2) {
    $n = Get-Count $c2 $r.old
    if ($n -ne 1) { Write-Host "PRECHECK FAIL swap.html ($n found): $($r.old)" -ForegroundColor Red; $failed = $true }
}
$multiTotal = 0
foreach ($r in $r3multi) {
    $n = Get-Count $c3 $r.old
    $multiTotal += $n
    if ($n -lt 1) { Write-Host "PRECHECK FAIL seasonal-changeover.html (0 found): $($r.old)" -ForegroundColor Red; $failed = $true }
}
if ($multiTotal -ne 10) { Write-Host "PRECHECK FAIL seasonal-changeover.html: expected 10 total `$20 swap references, found $multiTotal" -ForegroundColor Red; $failed = $true }
foreach ($r in $r3single) {
    $n = Get-Count $c3 $r.old
    if ($n -ne 1) { Write-Host "PRECHECK FAIL seasonal-changeover.html ($n found): $($r.old)" -ForegroundColor Red; $failed = $true }
}
if ($failed) { Write-Host "No files modified." -ForegroundColor Yellow; exit 1 }
Write-Host "Pre-checks passed on all 3 files." -ForegroundColor Green

# ---------- Backups ----------
foreach ($f in @($f1, $f2, $f3)) {
    $bak = "$f.bak-swapprice-$stamp"
    Copy-Item $f $bak
    Write-Host "Backup: $bak"
}

# ---------- Apply ----------
foreach ($r in $r1) { $c1 = $c1.Replace([string]$r.old, [string]$r.new) }
foreach ($r in $r2) { $c2 = $c2.Replace([string]$r.old, [string]$r.new) }
foreach ($r in ($r3multi + $r3single)) { $c3 = $c3.Replace([string]$r.old, [string]$r.new) }

# ---------- Verify ----------
$checks = @(
    @{ c = $c1; f = 'index.html';               bad = @('price:''$20'',   unit:''per tire''', 'price:20, unit:''per tire''') },
    @{ c = $c2; f = 'swap.html';                bad = @('$17.50', '$70/set', 'Flat Repair / Plug', 'Quick plug', '$15/stem', '$15 per stem', '''$25/tire''') },
    @{ c = $c3; f = 'seasonal-changeover.html'; bad = @('$20/Tire', '$20/tire', '$20 per tire', '<div>$20</div>', '<div>$80</div>', 'swap: $80') }
)
foreach ($chk in $checks) {
    foreach ($b in $chk.bad) {
        if ((Get-Count $chk.c $b) -gt 0) { Write-Host "VERIFY FAIL $($chk.f): stale string remains: $b" -ForegroundColor Red; $failed = $true }
    }
}
if ((Get-Count $c2 '$15/tire or $60/set') -ne 1) { Write-Host "VERIFY FAIL swap.html: new swap price text missing" -ForegroundColor Red; $failed = $true }
if ((Get-Count $c3 '$15/tire') -lt 1) { Write-Host "VERIFY FAIL seasonal-changeover.html: new price missing" -ForegroundColor Red; $failed = $true }

if ($failed) { Write-Host "Verification failed - NO files written. Originals untouched." -ForegroundColor Yellow; exit 1 }

[System.IO.File]::WriteAllText($f1, $c1)
[System.IO.File]::WriteAllText($f2, $c2)
[System.IO.File]::WriteAllText($f3, $c3)

Write-Host ""
Write-Host "All 3 files patched OK:" -ForegroundColor Green
Write-Host "  Seasonal swap is now `$15/tire (`$60/set) on index.html, swap.html, seasonal-changeover.html"
Write-Host "  swap.html flat repair is now Proper Patch `$45 / 45 min (no more `$25 plug)"
Write-Host "  swap.html valve stems now `$25/stem / 30 min"
Write-Host "  swap.html customer-supplied mount now `$40/tire"
Write-Host ""
Write-Host "Deploy with .\push-pctires.ps1" -ForegroundColor Cyan
