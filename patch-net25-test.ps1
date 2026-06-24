# ============================================================
#  patch-net25-test.ps1
#  PC Tires - TEST PRICING: net $25 / tire
#
#  Caps every CONSUMER tire at: cost + $25 net (after Stripe + $5 recycle).
#   - Never RAISES a tire (only lowers mid/premium; cheap tires untouched)
#   - Excludes wheels and commercial/semi (22.5"/24.5"/17.5"/19.5")
#   - Turns OFF the 10% member discount while the test runs (a % off would
#     wipe the flat $25 margin)
#   - Al's Lawncare net-$10 code is untouched (separate path)
#
#  REVERSIBLE: to end the test, open index.html and change
#      TEST_NET_TARGET: 25   ->   TEST_NET_TARGET: null
#  then push again. (Or restore the .bak this script makes.)
#
#  Run from the repo folder:   .\patch-net25-test.ps1
#  Then deploy:                .\push-pctires.ps1
# ============================================================

$ErrorActionPreference = 'Stop'

$path = Join-Path $PSScriptRoot 'index.html'
if (-not (Test-Path -LiteralPath $path)) {
  Write-Host "ERROR: index.html not found next to this script:" -ForegroundColor Red
  Write-Host "  $path" -ForegroundColor Red
  exit 1
}

$c = [System.IO.File]::ReadAllText($path)

if ($c.Contains('TEST_NET_TARGET')) {
  Write-Host "Already patched (TEST_NET_TARGET present). No changes made." -ForegroundColor Yellow
  exit 0
}

# match the file's line endings for any inserted lines
$nl = if ($c.Contains("`r`n")) { "`r`n" } else { "`n" }

# ---------- anchors (each must appear exactly once) ----------
$a1 = @'
  SEASON_MAP:   { 1:'summer', 2:'allseason', 3:'allweather', 4:'winter' },
'@
$a2 = '  if (item.map && item.map > price) price = item.map;'
$a3 = 'function memberPrice(item) {'
$a4 = '  const memberOk = currentMember && c.qty >= 4 && c.discEligible === true;'
$a5 = @'
{ if (item && !discountEligible(item)) return '';
'@

# ---------- inserts / replacements ----------
$ins1 = '  TEST_NET_TARGET: 25,   // TEST Jun2026: cap each consumer TIRE at cost+$25 net after Stripe+$5 recycle; never raises; set null to revert'

$ins2 = @(
'  // TEST Jun2026: cap consumer tires at cost + $25 net (after Stripe + $5 recycle). Never raises; excludes wheels + commercial. null = off.',
'  if (TDG.TEST_NET_TARGET != null && !item.boltPattern && !isCommercialTire(item)) {',
'    var _R = 0.029 * 1.13, _ots = 5;',
'    var _n = item.price + (TDG.TEST_NET_TARGET + _ots + _R * item.price) / (1 - _R);',
'    if (_n < price) price = Math.max(_n, item.map || 0);',
'  }'
) -join $nl

$ins3 = '  if (TDG.TEST_NET_TARGET != null) return retailPrice(item);'

$new1 = $ins1 + $nl + $a1
$new2 = $a2 + $nl + $ins2
$new3 = $a3 + $nl + $ins3
$new4 = '  const memberOk = TDG.TEST_NET_TARGET == null && currentMember && c.qty >= 4 && c.discEligible === true;'
$new5 = @'
{ if (TDG.TEST_NET_TARGET != null || (item && !discountEligible(item))) return '';
'@

$edits = @(
  @{ label = '1 add TEST_NET_TARGET toggle';  old = $a1; new = $new1 },
  @{ label = '2 retailPrice net-25 cap';      old = $a2; new = $new2 },
  @{ label = '3 memberPrice no % discount';   old = $a3; new = $new3 },
  @{ label = '4 cart memberOk gate';          old = $a4; new = $new4 },
  @{ label = '5 member badge suppress';       old = $a5; new = $new5 }
)

# ---------- verify ALL anchors before writing anything ----------
$fail = $false
foreach ($e in $edits) {
  $n = ([regex]::Matches($c, [regex]::Escape($e.old))).Count
  if ($n -ne 1) {
    Write-Host ("ANCHOR FAIL [{0}] found {1} times (expected 1)" -f $e.label, $n) -ForegroundColor Red
    $fail = $true
  }
}
if ($fail) {
  Write-Host "Aborted - nothing written. The file may already differ from the expected version." -ForegroundColor Red
  exit 1
}

# ---------- backup (outside the repo folder so it is not deployed) ----------
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bak = Join-Path (Split-Path $PSScriptRoot -Parent) ("index.html.bak-" + $stamp)
[System.IO.File]::Copy($path, $bak, $true)

# ---------- apply ----------
foreach ($e in $edits) { $c = $c.Replace($e.old, $e.new) }
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($path, $c, $utf8NoBom)

# ---------- verify result ----------
$v = [System.IO.File]::ReadAllText($path)
$cnt = ([regex]::Matches($v, 'TEST_NET_TARGET')).Count

Write-Host ""
Write-Host "PATCH APPLIED" -ForegroundColor Green
Write-Host ("  backup saved : {0}" -f $bak)
Write-Host ("  TEST_NET_TARGET references: {0}  (expect 6)" -f $cnt)
$marks = @(
  'TEST_NET_TARGET: 25',
  '!item.boltPattern && !isCommercialTire',
  'TEST_NET_TARGET != null) return retailPrice',
  'memberOk = TDG.TEST_NET_TARGET == null'
)
foreach ($m in $marks) {
  $ok = $v.Contains($m)
  Write-Host ("  [{0}] {1}" -f (@('MISSING','ok')[[int]$ok]), $m)
}
Write-Host ""
Write-Host "Next:  .\push-pctires.ps1   to deploy." -ForegroundColor Cyan
Write-Host "End test later: set TEST_NET_TARGET: 25  ->  null in index.html, then push." -ForegroundColor Cyan
