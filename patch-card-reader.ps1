# patch-card-reader.ps1  (PC Tires, Nov 5 2026)
# Card reader phase 1 - edits to EXISTING files only:
#   functions/order-core.js : "Take payment at reader - $X owing" button in the internal order email
#   index.html              : "Prefer debit? Pay the balance by debit in store." on the $50 deposit option
# New files (already in the folder, pushed as-is): functions/terminal.js, functions/reader-core.js, reader.html
#
# All-or-nothing: every anchor must be found exactly once in every file before anything is written.
# Backups go OUTSIDE the repo to C:\Users\Caleb\Documents\PCtires-quarantine.
# Find/replace text is base64 (UTF-8) so quotes, backticks and $ survive PowerShell untouched.

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bakDir = "C:\Users\Caleb\Documents\PCtires-quarantine\card-reader-backup-$stamp"
$utf8 = New-Object System.Text.UTF8Encoding($false)
function D([string]$s) { return $utf8.GetString([Convert]::FromBase64String($s)) }

$rows = @(
    'functions/order-core.js|import-reader-core|aW1wb3J0IHsgZmluZEx1ZyB9IGZyb20gJy4vdGVjaC1sdWdudXQtZGIuanMnOw==|aW1wb3J0IHsgZmluZEx1ZyB9IGZyb20gJy4vdGVjaC1sdWdudXQtZGIuanMnOwppbXBvcnQgeyBwcmVwYXJlUmVhZGVyTGluayB9IGZyb20gJy4vcmVhZGVyLWNvcmUuanMnOw=='
    'functions/order-core.js|email-signature|ZnVuY3Rpb24gYnVpbGRJbnRlcm5hbEVtYWlsKG9yZGVyLCB0ZGdPcmRlciwgdGRnRXJyb3IsIGZlZUluZm8pIHs=|ZnVuY3Rpb24gYnVpbGRJbnRlcm5hbEVtYWlsKG9yZGVyLCB0ZGdPcmRlciwgdGRnRXJyb3IsIGZlZUluZm8sIHJlYWRlckxpbmspIHs='
    'functions/order-core.js|email-button|ICAke2Nvc3QgPyBgCiAgPCEtLSBQQyBUaXJlcyBjb3N0IChUREcpIC0tPg==|ICAke3JlYWRlckxpbmsgPyByZWFkZXJMaW5rLmh0bWwgOiAnJ30KCiAgJHtjb3N0ID8gYAogIDwhLS0gUEMgVGlyZXMgY29zdCAoVERHKSAtLT4='
    'functions/order-core.js|build-link|ICBjb25zdCBmZWVJbmZvID0gYXdhaXQgZ2V0U3RyaXBlRmVlKG9yZGVyLCBlbnYpOw==|ICBjb25zdCBmZWVJbmZvID0gYXdhaXQgZ2V0U3RyaXBlRmVlKG9yZGVyLCBlbnYpOwogIC8vIENhcmQgcmVhZGVyOiAiVGFrZSBwYXltZW50IGF0IHJlYWRlciIgYnV0dG9uIGZvciBhbnl0aGluZyBzdGlsbCBvd2luZy4KICBjb25zdCByZWFkZXJMaW5rID0gYXdhaXQgcHJlcGFyZVJlYWRlckxpbmsob3JkZXIsIGVudiwgcGF5U3RhdGUob3JkZXIpKTs='
    'functions/order-core.js|pass-link|aHRtbDogYnVpbGRJbnRlcm5hbEVtYWlsKG9yZGVyLCB0ZGdPcmRlciwgdGRnRXJyb3IsIGZlZUluZm8pLA==|aHRtbDogYnVpbGRJbnRlcm5hbEVtYWlsKG9yZGVyLCB0ZGdPcmRlciwgdGRnRXJyb3IsIGZlZUluZm8sIHJlYWRlckxpbmspLA=='
    'index.html|debit-line|SG9sZHMgeW91ciBib29raW5nIGFuZCBvcmRlcnMgeW91ciB0aXJlcy4gQmFsYW5jZSBkdWUgYXQgaW5zdGFsbGF0aW9uLjwvZGl2Pg==|SG9sZHMgeW91ciBib29raW5nIGFuZCBvcmRlcnMgeW91ciB0aXJlcy4gQmFsYW5jZSBkdWUgYXQgaW5zdGFsbGF0aW9uLiBQcmVmZXIgZGViaXQ/IFBheSB0aGUgYmFsYW5jZSBieSBkZWJpdCBpbiBzdG9yZS48L2Rpdj4='
)

foreach ($nf in @('functions\terminal.js', 'functions\reader-core.js', 'reader.html')) {
    if (-not (Test-Path (Join-Path $repo $nf))) { throw "Missing new file $nf - stop, tell Claude." }
}

# 1. Load each file once and check every anchor BEFORE writing anything
$text = @{}; $orig = @{}
foreach ($row in $rows) {
    $p = $row.Split('|')
    $path = Join-Path $repo $p[0]
    if (-not $text.ContainsKey($p[0])) { $orig[$p[0]] = [IO.File]::ReadAllText($path, $utf8); $text[$p[0]] = $orig[$p[0]] }
    $find = D $p[2]; $rep = D $p[3]
    if ($text[$p[0]].Contains($rep)) { throw "$($p[1]): already applied - nothing written." }
    $n = ([regex]::Matches($text[$p[0]], [regex]::Escape($find))).Count
    if ($n -ne 1) { throw "$($p[1]): anchor found $n times in $($p[0]) (expected 1) - nothing written." }
}
# 2. Apply in memory
foreach ($row in $rows) {
    $p = $row.Split('|')
    $text[$p[0]] = $text[$p[0]].Replace((D $p[2]), (D $p[3]))
}
# 3. Sanity checks
foreach ($k in $text.Keys) {
    $delta = ($text[$k].Split("`n").Count) - ($orig[$k].Split("`n").Count)
    if ($delta -lt 0 -or $delta -gt 6) { throw "$k line change $delta looks wrong - nothing written." }
}
if (-not $text['index.html'].TrimEnd().EndsWith('</html>')) { throw "index.html no longer ends with </html> - nothing written." }
# 4. Back up, then write
New-Item -ItemType Directory -Force -Path $bakDir | Out-Null
foreach ($k in $text.Keys) {
    $src = Join-Path $repo $k
    Copy-Item $src (Join-Path $bakDir ($k -replace '[\\/]', '__'))
    [IO.File]::WriteAllText($src, $text[$k], $utf8)
}
Write-Host ""
Write-Host "Card reader patch applied." -ForegroundColor Green
Write-Host "  order-core.js : reader button added to internal order email"
Write-Host "  index.html    : 'Prefer debit?' line on the deposit option"
Write-Host "Backups: $bakDir"
Write-Host ""
Write-Host "Next: .\push-pctires.ps1"
Write-Host "Undo (before pushing): Copy-Item '$bakDir\functions__order-core.js' '$repo\functions\order-core.js'; Copy-Item '$bakDir\index.html' '$repo\index.html'"
