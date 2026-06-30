# patch-remove-tdgkey-client.ps1
# Removes the unused (and exposed) TDG API_KEY line from the client-side TDG config
# in index.html. The front-end authenticates through /tdg-proxy, so this line is dead
# code - removing it stops the live site from serving the key in page source.
# Safe: backs up first, verifies the key is gone and the TDG object is intact.
# Run:  .\patch-remove-tdgkey-client.ps1    then deploy with  .\push-pctires.ps1

$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot
$path = Join-Path $dir 'index.html'
if (-not (Test-Path $path)) { Write-Host 'ERROR: index.html not found' -ForegroundColor Red; exit 1 }

$t = [System.IO.File]::ReadAllText($path)

if ($t -notmatch "(?m)^\s*API_KEY:\s*'rst") {
    Write-Host "OK: no TDG API_KEY line found in index.html (already removed?)." -ForegroundColor Yellow
    exit 0
}

Copy-Item $path "$path.bak-tdgkey-$(Get-Date -Format yyyyMMdd-HHmmss)"

# Remove the entire "API_KEY: 'rst...'," line
$new = [regex]::Replace($t, "(?m)^\s*API_KEY:\s*'rst[^']*',\s*\r?\n", "")

# Safety checks: key gone, but the TDG config object still intact
if ($new -match "rst715") { Write-Host 'ERROR: TDG key still present after edit - NOT saved.' -ForegroundColor Red; exit 1 }
if ($new -notmatch 'const TDG' -or $new -notmatch 'BASE_URL' -or $new -notmatch 'STRIPE_PK') {
    Write-Host 'ERROR: TDG config object looks damaged - NOT saved. Restore from backup.' -ForegroundColor Red; exit 1
}
if ($new.Length -ge $t.Length) { Write-Host 'ERROR: nothing was removed - NOT saved.' -ForegroundColor Red; exit 1 }

$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($path, $new, $enc)
Write-Host 'SUCCESS: removed the TDG API_KEY line from index.html (search + checkout unaffected).' -ForegroundColor Green
Write-Host 'Next: make the GitHub repo private, then deploy with  .\push-pctires.ps1'
