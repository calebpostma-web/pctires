# ============================================================================
#  PC Tires - Tire calculator tools  (patch-tire-tools.ps1)   2026-10-22
#  Run from:  C:\Users\Caleb\Documents\Claude\Projects\PCtires
#
#  1. Checks the 4 new files are present (Claude wrote them to this folder):
#     tire-calc.js, tire-size-calculator.html, plus-sizing-calculator.html,
#     tread-depth-calculator.html
#  2. Patches index.html footer (Tire Guides column) with 3 tool links
#  3. Patches sitemap.xml with the 3 new URLs
#  Every patch is anchor-checked (must match exactly once) BEFORE anything is
#  written; backups are taken with a timestamp; rollback command printed.
#  Then deploy as usual:  .\push-pctires.ps1
# ============================================================================
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot; if (-not $root) { $root = (Get-Location).Path }
Set-Location $root
if (-not (Test-Path (Join-Path $root 'index.html'))) { throw "index.html not found in $root - run this from the PCtires folder." }
$utf8 = New-Object System.Text.UTF8Encoding($false)
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bak = Join-Path $root '_backups'; if (-not (Test-Path $bak)) { New-Item -ItemType Directory -Path $bak | Out-Null }
function D($b) { return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b)) }

# ---- 1. new files (already written to this folder by Claude) ---------------
$files = @('tire-calc.js','tire-size-calculator.html','plus-sizing-calculator.html','tread-depth-calculator.html')
foreach ($f in $files) { if (-not (Test-Path (Join-Path $root $f))) { throw "Missing $f - the 4 tool files should already be in this folder." } }
Write-Host '  4 tool files present' -ForegroundColor Green
# ---- 2. patches ------------------------------------------------------------
$patches = @(
  @('index.html', 'PGEgaHJlZj0iL3RpcmUtdGVybXMtZXhwbGFpbmVkIj5UaXJlIFRlcm1zIEV4cGxhaW5lZDwvYT48L2Rpdj48L2Rpdj48ZGl2IGNsYXNzPSJmb290ZXItY29sIj48aDM+VGlyZXMgYnkgTW9kZWw8L2gzPg==', 'PGEgaHJlZj0iL3RpcmUtdGVybXMtZXhwbGFpbmVkIj5UaXJlIFRlcm1zIEV4cGxhaW5lZDwvYT48YSBocmVmPSIvdGlyZS1zaXplLWNhbGN1bGF0b3IiPlRpcmUgU2l6ZSBDYWxjdWxhdG9yPC9hPjxhIGhyZWY9Ii9wbHVzLXNpemluZy1jYWxjdWxhdG9yIj5QbHVzICZhbXA7IE1pbnVzIFNpemluZzwvYT48YSBocmVmPSIvdHJlYWQtZGVwdGgtY2FsY3VsYXRvciI+VHJlYWQgRGVwdGggQ2FsY3VsYXRvcjwvYT48L2Rpdj48L2Rpdj48ZGl2IGNsYXNzPSJmb290ZXItY29sIj48aDM+VGlyZXMgYnkgTW9kZWw8L2gzPg=='),
  @('sitemap.xml', 'PC91cmxzZXQ+', 'ICA8dXJsPgogICAgPGxvYz5odHRwczovL3BjdGlyZXMuY2EvdGlyZS1zaXplLWNhbGN1bGF0b3I8L2xvYz4KICAgIDxsYXN0bW9kPjIwMjYtMTAtMjI8L2xhc3Rtb2Q+CiAgICA8Y2hhbmdlZnJlcT5tb250aGx5PC9jaGFuZ2VmcmVxPgogICAgPHByaW9yaXR5PjAuNzwvcHJpb3JpdHk+CiAgPC91cmw+CiAgPHVybD4KICAgIDxsb2M+aHR0cHM6Ly9wY3RpcmVzLmNhL3BsdXMtc2l6aW5nLWNhbGN1bGF0b3I8L2xvYz4KICAgIDxsYXN0bW9kPjIwMjYtMTAtMjI8L2xhc3Rtb2Q+CiAgICA8Y2hhbmdlZnJlcT5tb250aGx5PC9jaGFuZ2VmcmVxPgogICAgPHByaW9yaXR5PjAuNzwvcHJpb3JpdHk+CiAgPC91cmw+CiAgPHVybD4KICAgIDxsb2M+aHR0cHM6Ly9wY3RpcmVzLmNhL3RyZWFkLWRlcHRoLWNhbGN1bGF0b3I8L2xvYz4KICAgIDxsYXN0bW9kPjIwMjYtMTAtMjI8L2xhc3Rtb2Q+CiAgICA8Y2hhbmdlZnJlcT5tb250aGx5PC9jaGFuZ2VmcmVxPgogICAgPHByaW9yaXR5PjAuNzwvcHJpb3JpdHk+CiAgPC91cmw+CjwvdXJsc2V0Pg==')
)

# ---- pre-flight: every anchor must match exactly once -----------------------
$plan = @()
foreach ($p in $patches) {
  $path = Join-Path $root $p[0]
  if (-not (Test-Path $path)) { throw "Missing $($p[0])" }
  $txt = [System.IO.File]::ReadAllText($path, $utf8)
  if ($txt.Contains('tire-size-calculator')) { Write-Host "  $($p[0]) already contains the tool links - skipping patch" -ForegroundColor Yellow; continue }
  $old = D $p[1]; $new = D $p[2]
  $n = ([regex]::Matches($txt, [regex]::Escape($old))).Count
  if ($n -ne 1) { throw "ABORT: anchor for $($p[0]) found $n times (expected 1). Nothing written." }
  $plan += ,@($path, $txt, $txt.Replace($old, $new))
}

# ---- apply patches with sanity checks ---------------------------------------
foreach ($x in $plan) {
  $path = $x[0]; $before = $x[1]; $after = $x[2]
  $lb = ([regex]::Matches($before, "`n")).Count; $la = ([regex]::Matches($after, "`n")).Count
  if (($la - $lb) -gt 20 -or ($la - $lb) -lt 0) { throw "ABORT: line delta $($la-$lb) on $path looks wrong." }
  if ($path -like '*index.html' -and -not $after.TrimEnd().EndsWith('</html>')) { throw 'ABORT: index.html would not end with </html>' }
  if ($path -like '*sitemap.xml') { [xml]$chk = $after }   # throws if not well-formed
  Copy-Item $path (Join-Path $bak "$(Split-Path $path -Leaf).bak-$stamp")
  [System.IO.File]::WriteAllText($path, $after, $utf8)
  Write-Host "  patched $(Split-Path $path -Leaf)  (+$($la-$lb) lines)" -ForegroundColor Green
}
Write-Host ''
Write-Host 'Done. Test locally, then deploy with:  .\push-pctires.ps1' -ForegroundColor Cyan
Write-Host "Rollback:  Copy-Item _backups\index.html.bak-$stamp index.html -Force; Copy-Item _backups\sitemap.xml.bak-$stamp sitemap.xml -Force; Remove-Item tire-calc.js,tire-size-calculator.html,plus-sizing-calculator.html,tread-depth-calculator.html" -ForegroundColor DarkGray
