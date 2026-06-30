# patch-fix-phone.ps1
# Replaces the OLD phone number (519-380-5104 / 5193805104) with the correct
# 519-397-4686 / 5193974686 across every .html and .js file in the repo.
# Safe: backs up each changed file, verifies the old number is gone before saving.
# Run:  .\patch-fix-phone.ps1    then deploy with  .\push-pctires.ps1

$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot
$enc = New-Object System.Text.UTF8Encoding($false)
$changed = 0

Get-ChildItem -Path $dir -Recurse -Include *.html,*.js | ForEach-Object {
    $p = $_.FullName
    $t = [System.IO.File]::ReadAllText($p)
    if ($t.Contains('5193805104') -or $t.Contains('519-380-5104')) {
        Copy-Item $p "$p.bak-phone-$(Get-Date -Format yyyyMMdd-HHmmss)"
        $t = $t.Replace('5193805104','5193974686').Replace('519-380-5104','519-397-4686')
        if ($t.Contains('5193805104') -or $t.Contains('519-380-5104')) {
            Write-Host "ERROR: old number still present in $($_.Name) - NOT saved" -ForegroundColor Red
        } else {
            [System.IO.File]::WriteAllText($p, $t, $enc)
            Write-Host "FIXED: $($_.Name)" -ForegroundColor Green
            $changed++
        }
    }
}

if ($changed -eq 0) { Write-Host 'No files contained the old number - nothing to do.' -ForegroundColor Yellow }
else { Write-Host "Done. $changed file(s) updated. Deploy with  .\push-pctires.ps1" -ForegroundColor Cyan }
