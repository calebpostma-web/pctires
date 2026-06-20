# fix-techsync.ps1
# Repairs functions/tech-sync.js, which was TRUNCATED mid-statement (ends at "} catch (er").
# That broken file has been failing EVERY Cloudflare Pages build for ~a week, freezing the
# live site. This restores the missing catch block + onRequestOptions export.
# Backs up the file first. Safe to read before running.

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
Set-Location $root
[Environment]::CurrentDirectory = $root

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$utf8  = New-Object System.Text.UTF8Encoding($false)
$path  = Join-Path $root "functions\tech-sync.js"

if (-not (Test-Path $path)) { throw "Cannot find functions\tech-sync.js under $root" }

$t = [System.IO.File]::ReadAllText($path)

$marker = "} catch (er"
$idx = $t.LastIndexOf($marker)

if ($idx -lt 0) {
    Write-Host "Marker not found. File may already be fixed - verifying syntax only." -ForegroundColor Yellow
} else {
    $tail = $t.Substring($idx)
    if ($tail -ne "} catch (er") {
        throw "Unexpected content after the truncation point. Aborting so nothing is damaged. Found tail: '$tail'"
    }

    $ending = @'
} catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
'@

    Copy-Item $path "$path.bak-truncation-$stamp"
    $t = $t.Substring(0, $idx) + $ending
    [System.IO.File]::WriteAllText($path, $t, $utf8)
    Write-Host "OK: restored the catch block + onRequestOptions (backup: tech-sync.js.bak-truncation-$stamp)" -ForegroundColor Green
}

# --- Verify: must parse as an ES module (the check that actually catches truncation) ---
Write-Host ""
Write-Host "--- Verification ---"
$ok = $true
$after = [System.IO.File]::ReadAllText($path)

if ($after.TrimEnd().EndsWith("}") -and $after -match "onRequestOptions") {
    Write-Host "  ends correctly with onRequestOptions   [PASS]" -ForegroundColor Green
} else {
    Write-Host "  file does not end correctly             [FAIL]" -ForegroundColor Red; $ok=$false
}

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $tmp = Join-Path $env:TEMP "techsync-check-$stamp.mjs"
    Copy-Item $path $tmp
    & node --check $tmp
    if ($LASTEXITCODE -eq 0) { Write-Host "  node --check (ES module)                [PASS]" -ForegroundColor Green }
    else { Write-Host "  node --check (ES module)                [FAIL]" -ForegroundColor Red; $ok=$false }
    Remove-Item $tmp -ErrorAction SilentlyContinue
} else {
    Write-Host "  (node not found - skipped syntax check)" -ForegroundColor Yellow
}

Write-Host ""
if ($ok) {
    Write-Host "FIXED. Now deploy with:  .\push-pctires.ps1" -ForegroundColor Cyan
    Write-Host "This unblocks the build - your promo code, the removed 10% bar, and everything" -ForegroundColor Cyan
    Write-Host "else pushed in the last week will all go live in the same deployment." -ForegroundColor Cyan
} else {
    Write-Host "VERIFICATION FAILED - do NOT push. Tell Claude. Backup is in functions\." -ForegroundColor Red
}
