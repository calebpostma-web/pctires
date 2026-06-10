# ============================================================
#  PC TIRES - Enhanced Conversions Patch (thank-you.html)
#  Feeds the customer email to the Google tag at purchase time so
#  Google Ads Enhanced Conversions can match the sale to a click.
#  gtag hashes the email (SHA-256) in the browser before it is sent.
#  This is the website half of the fix. You ALSO have to turn on
#  Enhanced Conversions for the Purchase action in the Google Ads
#  account and accept the terms (see the playbook - 2 minutes).
#
#  HOW TO RUN:
#    1. This file lives in your pctires repo folder (same as index.html)
#    2. In PowerShell:  .\patch-enhanced-conversions.ps1
#    3. If it says SUCCESS, deploy:  .\push-pctires.ps1
#  Creates a timestamped .bak backup before touching anything.
# ============================================================

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
$tyPath = Join-Path $root 'thank-you.html'

if (-not (Test-Path $tyPath)) { Write-Host "ABORT: cannot find $tyPath" -ForegroundColor Red; exit 1 }

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

# ---------- read + normalize to LF ----------
$t = Read-Text $tyPath
$tCRLF = $t.Contains($CRLF)
$t = $t.Replace($CRLF, $LF)

# Guard: bail out cleanly if it was already patched
if ($t.Contains('allow_enhanced_conversions')) {
  Write-Host "ALREADY PATCHED: thank-you.html already has enhanced conversions. No changes made." -ForegroundColor Yellow
  exit 0
}

# ---------- 1) enable enhanced conversions on the config ----------
$t = Apply $t @'
gtag('config', 'AW-18156336783');
'@ @'
gtag('config', 'AW-18156336783', { 'allow_enhanced_conversions': true });
'@ 1 'config'

# ---------- 2) hand the email to gtag right before the purchase event ----------
$t = Apply $t @'
if (typeof gtag === 'function' && order && total > 0) {
'@ @'
if (typeof gtag === 'function' && order && total > 0) { if (email) { gtag('set', 'user_data', { 'email': email }); }
'@ 1 'user_data'

# ---------- verify both edits landed ----------
$ok = $true
if (-not $t.Contains("allow_enhanced_conversions': true")) { Write-Host "VERIFY FAIL: config flag missing" -ForegroundColor Red; $ok = $false }
if (-not $t.Contains("gtag('set', 'user_data', { 'email': email })")) { Write-Host "VERIFY FAIL: user_data line missing" -ForegroundColor Red; $ok = $false }
if (-not $ok) { Write-Host "No files changed." -ForegroundColor Red; exit 1 }

# ---------- backup + save (restore original line endings) ----------
$backup = "$tyPath.$stamp.bak"
Copy-Item $tyPath $backup -Force
if ($tCRLF) { $t = $t.Replace($LF, $CRLF) }
Write-Text $tyPath $t

Write-Host ""
Write-Host "SUCCESS - thank-you.html patched for Enhanced Conversions." -ForegroundColor Green
Write-Host "Backup saved: $backup" -ForegroundColor DarkGray
Write-Host ""
Write-Host "NEXT:" -ForegroundColor Cyan
Write-Host "  1. Deploy:  .\push-pctires.ps1"
Write-Host "  2. In Google Ads: Goals > Settings > turn ON Enhanced Conversions"
Write-Host "     for the Purchase action (Google tag method) and accept the terms."
Write-Host "  3. Place one real test order and confirm the Purchase conversion fires."
