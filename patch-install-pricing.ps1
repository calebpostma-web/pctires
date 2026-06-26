# patch-install-pricing.ps1
# Size-based tire install pricing: base $25, rims 20" and up = $30 (per tire).
# Touches cart + checkout math only (charge, tax, totals, payment summary). No marketing copy.
# Safe: backs up index.html, aborts if any anchor count is wrong, verifies result.
$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$file = Join-Path $ScriptDir 'index.html'
if(-not (Test-Path $file)){ Write-Host 'ERROR: index.html not found next to this script.' -ForegroundColor Red; exit 1 }
$enc = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText($file)
$fileNl = if($content.Contains("`r`n")){ "`r`n" } else { "`n" }
function Norm([string]$s){ $t = $s -replace "`r`n","`n"; if($fileNl -eq "`r`n"){ $t = $t -replace "`n","`r`n" }; return $t }
$lines0 = ([regex]::Matches($content, "`n")).Count + 1
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "$file.bak-installprice-$stamp"
[System.IO.File]::WriteAllText($backup, $content, $enc)
Write-Host "Backup written: $backup"

$o1 = @'
  INSTALL_PRICE:   25,
'@
$n1 = @'
  INSTALL_PRICE:   25,
  INSTALL_LARGE:   30,   // per-tire install for big rims (>= INSTALL_LARGE_MIN_DIA inches)
  INSTALL_LARGE_MIN_DIA: 20,   // rim diameter at/above which INSTALL_LARGE applies
'@
$o2 = @'
function tireSizeRimDia(size) {
  if (!size) return null;
  const m = size.match(/R(\d+)/i);
  return m ? parseInt(m[1]) : null;
}
'@
$n2 = @'
function tireSizeRimDia(size) {
  if (!size) return null;
  const m = size.match(/R(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

// Per-tire install price by rim diameter. Wheels are never installed (return 0).
// Base = TDG.INSTALL_PRICE; rims >= TDG.INSTALL_LARGE_MIN_DIA charge TDG.INSTALL_LARGE.
function installPriceEach(item){
  if(!item || item.itemType === 'wheel') return 0;
  var dia = (typeof tireSizeRimDia === 'function') ? tireSizeRimDia(item.size) : null;
  if(dia && TDG.INSTALL_LARGE_MIN_DIA && dia >= TDG.INSTALL_LARGE_MIN_DIA) return TDG.INSTALL_LARGE;
  return TDG.INSTALL_PRICE;
}
'@
$o3 = @'
+$${TDG.INSTALL_PRICE}/tire
'@
$n3 = @'
+$${installPriceEach(item)}/tire
'@
$o4 = @'
(item.install && item.itemType !== 'wheel' ? TDG.INSTALL_PRICE : 0)
'@
$n4 = @'
(item.install ? installPriceEach(item) : 0)
'@
$o5 = @'
(c.install && c.itemType !== 'wheel' ? TDG.INSTALL_PRICE * c.qty : 0)
'@
$n5 = @'
(c.install ? installPriceEach(c) * c.qty : 0)
'@

$pairs = @(
  @{ label='CONFIG large-rim tier';     old=$o1; new=$n1; n=1 },
  @{ label='HELPER installPriceEach';    old=$o2; new=$n2; n=1 },
  @{ label='toggle label';               old=$o3; new=$n3; n=1 },
  @{ label='cart line total';            old=$o4; new=$n4; n=1 },
  @{ label='reduce expr (x2)';           old=$o5; new=$n5; n=2 }
)

foreach($p in $pairs){
  $o = Norm $p.old; $w = Norm $p.new
  $cnt = ([regex]::Matches($content, [regex]::Escape($o))).Count
  if($cnt -ne $p.n){ Write-Host "ABORT: anchor [$($p.label)] found $cnt time(s), expected $($p.n). No changes written." -ForegroundColor Red; exit 1 }
  $content = $content.Replace($o, $w)
  Write-Host "  applied: $($p.label) (x$($p.n))" -ForegroundColor Green
}

foreach($t in @('installPriceEach','INSTALL_LARGE_MIN_DIA','return TDG.INSTALL_LARGE;')){ if(-not $content.Contains($t)){ Write-Host "ABORT: expected token missing: $t" -ForegroundColor Red; exit 1 } }
foreach($o in @((Norm $o3),(Norm $o4),(Norm $o5))){ if($content.Contains($o)){ Write-Host 'ABORT: a flat install reference still remains.' -ForegroundColor Red; exit 1 } }

[System.IO.File]::WriteAllText($file, $content, $enc)
$lines1 = ([regex]::Matches($content, "`n")).Count + 1
Write-Host ""
Write-Host "SUCCESS. Install pricing patched ($lines0 -> $lines1 lines)." -ForegroundColor Cyan
Write-Host "Base $25; rims 20 inch and up = $30. Tune values in the TDG config block." -ForegroundColor Cyan
Write-Host "Review locally, then deploy with:  .\push-pctires.ps1" -ForegroundColor Yellow
