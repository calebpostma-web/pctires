# ============================================================
#  PC TIRES - Mobile Polish Patch (index.html)
#  Two small mobile-only fixes after the call-first launch:
#    1. Hide the duplicate "Find the Right Tire or Wheel" headline
#       on mobile (the call-first banner already says it). Desktop
#       keeps it, since the call banner is hidden there.
#    2. Stop the two-line logo from clipping in the compact mobile nav.
#  CSS is mobile-only; nothing changes on desktop.
#
#  HOW TO RUN:
#    1. This file lives in your pctires repo folder (same as index.html)
#    2. In PowerShell:  .\patch-mobile-polish.ps1
#    3. If it says SUCCESS, deploy:  .\push-pctires.ps1
#  Creates a timestamped .bak backup before touching anything.
# ============================================================

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
$indexPath = Join-Path $root 'index.html'
if (-not (Test-Path $indexPath)) { Write-Host "ABORT: cannot find $indexPath" -ForegroundColor Red; exit 1 }

$enc   = New-Object System.Text.UTF8Encoding($false)
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$CRLF  = ([string][char]13) + ([string][char]10)
$LF    = ([string][char]10)
function Read-Text($p)     { return [System.IO.File]::ReadAllText($p, $enc) }
function Write-Text($p,$t) { [System.IO.File]::WriteAllText($p, $t, $enc) }
function Apply($content, $old, $new, $expected, $label) {
  $count = ([regex]::Matches($content, [regex]::Escape($old))).Count
  if ($count -ne $expected) {
    Write-Host "ABORT [$label]: expected $expected match(es), found $count. No files changed." -ForegroundColor Red
    Write-Host ("anchor: " + $old.Substring(0, [Math]::Min(80,$old.Length))) -ForegroundColor DarkYellow
    exit 1
  }
  return $content.Replace($old, $new)
}

$h = Read-Text $indexPath
$hCRLF = $h.Contains($CRLF)
$h = $h.Replace($CRLF, $LF)

if ($h.Contains('pc-polish-css')) {
  Write-Host "ALREADY PATCHED: polish CSS already present. No changes made." -ForegroundColor Yellow
  exit 0
}

# ---------- 1) tag the duplicate hero headline so we can hide it on mobile ----------
$h = Apply $h @'
    <div style="margin-bottom:24px">
      <h1 class="section-title" style="font-size:clamp(26px,4vw,38px);margin-bottom:6px">Find the Right Tire or Wheel</h1>
'@ @'
    <div class="pc-hide-mobile" style="margin-bottom:24px">
      <h1 class="section-title" style="font-size:clamp(26px,4vw,38px);margin-bottom:6px">Find the Right Tire or Wheel</h1>
'@ 1 'tag-headline'

# ---------- 2) inject the mobile-only polish CSS before </head> ----------
$css = @'
<style id="pc-polish-css">
@media(max-width:600px){
  /* duplicate hero headline hidden on mobile (call-first banner covers it) */
  .pc-hide-mobile{display:none !important}
  /* keep the two-line logo from clipping in the compact mobile nav */
  .logo{font-size:20px !important;line-height:1.15 !important}
}
</style>
'@
$h = Apply $h "</head>" ($css + "`n</head>") 1 'polish-css'

# ---------- verify ----------
$ok = $true
if (-not $h.Contains('pc-polish-css'))   { Write-Host "VERIFY FAIL: polish css missing" -ForegroundColor Red; $ok = $false }
if (-not $h.Contains('class="pc-hide-mobile" style="margin-bottom:24px"')) { Write-Host "VERIFY FAIL: headline class not added" -ForegroundColor Red; $ok = $false }
if (-not $ok) { Write-Host "No files changed." -ForegroundColor Red; exit 1 }

$backup = "$indexPath.$stamp.bak"
Copy-Item $indexPath $backup -Force
if ($hCRLF) { $h = $h.Replace($LF, $CRLF) }
Write-Text $indexPath $h

Write-Host ""
Write-Host "SUCCESS - mobile polish applied (headline hidden on mobile + logo fix)." -ForegroundColor Green
Write-Host "Backup saved: $backup" -ForegroundColor DarkGray
Write-Host ""
Write-Host "NEXT:  .\push-pctires.ps1   then re-check on your phone." -ForegroundColor Cyan
