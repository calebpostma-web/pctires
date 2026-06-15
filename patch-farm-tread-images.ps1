# patch-farm-tread-images.ps1
# Repoints farm-tires.html product-card images from one-photo-per-SKU to
# one reference photo per tread pattern (R-1, R-1W, I-1, F-2, etc.).
# Safe: backs up first, validates with node --check, only writes if valid.
# Run from the PCtires folder:  .\patch-farm-tread-images.ps1

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$File = Join-Path $ScriptDir 'farm-tires.html'
if (-not (Test-Path $File)) {
    Write-Host "ERROR: farm-tires.html not found beside this script." -ForegroundColor Red
    exit 1
}

$enc = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText($File, [System.Text.Encoding]::UTF8)

# --- anchors (must match the file exactly) ---
$SIZEOF = @'
function sizeOf(desc) { return desc.split(' ')[0]; }
'@

$BLOCK = @'
function sizeOf(desc) { return desc.split(' ')[0]; }

// --- Tread-pattern image: one reference image per tread, not per SKU ---
var TREAD_IMG = {
  'R-1':'agr_324-alliance_r-1.jpg','R-1W':'agr_375-agri-star_r-1w.jpg',
  'R-2':'agr_324-alliance_r-1.jpg','R-3':'agr_329-alliance_r-3.jpg',
  'F-1':'agr_drill-rib_f-1.jpg','F-2':'agr_3-rib-hd_tru-trac_f-2.jpg',
  'F-3':'agr_farm-specialist_f-3.jpg','I-1':'agr_euro-rib_i-1.jpg',
  'I-3':'agr_mt63t_i-3.jpg','HF-1':'agr_american-farmer_hf-1.jpg',
  'HF-2':'agr_super-terra-grip_hf-2.jpg','TURF':'ag_regency-turf-implement.jpg',
  'FLOT':'agr_381-flotation.jpg'
};
function treadOf(desc) {
  var u = (desc || '').toUpperCase();
  if (/\bR-?1W\b/.test(u)) return 'R-1W';
  if (/\bR-?4\b/.test(u))  return 'R-4';
  if (/\bR-?3\b/.test(u))  return 'R-3';
  if (/\bR-?2\b/.test(u))  return 'R-2';
  if (/\bR-?1\b/.test(u))  return 'R-1';
  if (/\bHF-?2\b/.test(u)) return 'HF-2';
  if (/\bHF-?1\b/.test(u)) return 'HF-1';
  if (/\bF-?3\b/.test(u))  return 'F-3';
  if (/\bF-?2\b/.test(u))  return 'F-2';
  if (/\bF-?1\b/.test(u))  return 'F-1';
  if (/\bI-?3\b/.test(u))  return 'I-3';
  if (/\bI-?1\b/.test(u))  return 'I-1';
  if (/TURF/.test(u))      return 'TURF';
  if (/FLOT/.test(u))      return 'FLOT';
  return '';
}
function treadImg(p) {
  var t = treadOf(p.desc);
  if (TREAD_IMG[t]) return '/odessa-img/' + TREAD_IMG[t];
  if (p.img) return '/odessa-img/' + p.img;
  return '';
}
'@

$OLD = @'
(p.img ? '<div class="timg"><img loading="lazy" src="/odessa-img/' + esc(p.img) + '"
'@
$NEW = @'
(treadImg(p) ? '<div class="timg"><img loading="lazy" src="' + treadImg(p) + '"
'@

# --- pre-flight checks ---
$nS = ([regex]::Matches($content, [regex]::Escape($SIZEOF))).Count
$nO = ([regex]::Matches($content, [regex]::Escape($OLD))).Count
if ($content.Contains('function treadImg')) {
    Write-Host "ABORT: treadImg already present - patch looks already applied." -ForegroundColor Yellow
    exit 1
}
if ($nS -ne 1) { Write-Host "ABORT: sizeOf anchor found $nS time(s), expected 1." -ForegroundColor Red; exit 1 }
if ($nO -ne 1) { Write-Host "ABORT: image anchor found $nO time(s), expected 1." -ForegroundColor Red; exit 1 }

# --- apply in memory ---
$patched = $content.Replace($SIZEOF, $BLOCK).Replace($OLD, $NEW)

if (-not $patched.Contains('function treadOf')) { Write-Host "ABORT: treadOf missing after patch." -ForegroundColor Red; exit 1 }
if ($patched.Contains($OLD)) { Write-Host "ABORT: old per-SKU image reference still present." -ForegroundColor Red; exit 1 }

# --- validate JS syntax with node (matches your pre-push routine) ---
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $i = $patched.IndexOf('function sizeOf')
    $start = $patched.LastIndexOf('<script>', $i) + 8
    $end = $patched.IndexOf('</script>', $i)
    $js = $patched.Substring($start, $end - $start)
    $tmp = Join-Path $env:TEMP 'farm-block-check.js'
    [System.IO.File]::WriteAllText($tmp, $js, $enc)
    & node --check $tmp
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ABORT: node --check failed (see above). No changes written." -ForegroundColor Red
        Remove-Item $tmp -ErrorAction SilentlyContinue
        exit 1
    }
    Remove-Item $tmp -ErrorAction SilentlyContinue
    Write-Host "node --check: PASS" -ForegroundColor Green
} else {
    Write-Host "NOTE: node not found - skipped JS syntax check." -ForegroundColor Yellow
}

# --- backup + write ---
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bak = "$File.bak-treadimg-$stamp"
Copy-Item $File $bak
[System.IO.File]::WriteAllText($File, $patched, $enc)

Write-Host ""
Write-Host "DONE. farm-tires.html patched." -ForegroundColor Green
Write-Host "Backup: $bak"
Write-Host "Tread patterns mapped: R-1, R-1W, R-2, R-3, F-1, F-2, F-3, I-1, I-3, HF-1, HF-2, Turf, Flotation."
Write-Host "R-4 (backhoe/industrial) has no photo yet - those cards show no image until the backhoe scrape adds one." -ForegroundColor Yellow
Write-Host ""
Write-Host "Next: review locally, then deploy with  .\push-pctires.ps1"
