# patch-sliding-markup.ps1
# 1) Replaces the flat 35% markup (TDG.MARKUP) with a LINEAR sliding scale:
#    35% up to $75 cost, shave 1 point per $10 of cost above $75, floor 18%.
#    (The existing $20 margin floor still applies on top, untouched.)
# 2) Retires the WELCOME10 promo: removes the code from promo-codes.js and
#    stops the "Save 10%" promo bar from showing.
# Safe: backs up both files, verifies anchors, validates JS, only writes if clean.
# Run from the PCtires folder:  .\patch-sliding-markup.ps1

$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$indexFile = Join-Path $dir 'index.html'
$promoFile = Join-Path $dir 'promo-codes.js'
foreach ($f in @($indexFile, $promoFile)) {
    if (-not (Test-Path $f)) { Write-Host "ERROR: missing $f" -ForegroundColor Red; exit 1 }
}
$enc = New-Object System.Text.UTF8Encoding($false)

function ReplaceOnce([string]$text, [string]$old, [string]$new, [string]$desc) {
    $n = ([regex]::Matches($text, [regex]::Escape($old))).Count
    if ($n -ne 1) { Write-Host "ABORT: '$desc' anchor found $n time(s), expected 1. No changes written." -ForegroundColor Red; exit 1 }
    return $text.Replace($old, $new)
}

# ---------- index.html ----------
$html = [System.IO.File]::ReadAllText($indexFile, [System.Text.Encoding]::UTF8)
if ($html.Contains('function markupMult')) {
    Write-Host "ABORT: markupMult already present - patch looks already applied." -ForegroundColor Yellow; exit 1
}

$insertNew = @'
function markupMult(cost){ var f = 0.35 - 0.001*((+cost||0)-75); if(f>0.35)f=0.35; if(f<0.18)f=0.18; return 1+f; }
function retailPrice(item) {
'@

$html = ReplaceOnce $html 'function retailPrice(item) {' $insertNew 'markupMult insert'
$html = ReplaceOnce $html 'let price = item.price * TDG.MARKUP;' 'let price = item.price * markupMult(item.price);' 'retailPrice calc'
$html = ReplaceOnce $html 'return (item.price * TDG.MARKUP) >= ((item.price + TDG.MIN_MARGIN) / (1 - TDG.MEMBER_DISCOUNT));' 'return (item.price * markupMult(item.price)) >= ((item.price + TDG.MIN_MARGIN) / (1 - TDG.MEMBER_DISCOUNT));' 'discountEligible calc'
$html = ReplaceOnce $html 'Math.max(cost * TDG.MARKUP, (cost + TDG.MIN_MARGIN) / (1 - TDG.MEMBER_DISCOUNT), w.map || 0);' 'Math.max(cost * markupMult(cost), (cost + TDG.MIN_MARGIN) / (1 - TDG.MEMBER_DISCOUNT), w.map || 0);' 'wheel calc'
$html = ReplaceOnce $html "if(sessionStorage.getItem('pcPromoBarDismissed')!=='1'){" "if(false){ /* promo bar retired: discount baked into pricing */" 'promo bar show condition'
$html = ReplaceOnce $html "}catch(e){ document.body.classList.add('with-promo-bar'); }" "}catch(e){ }" 'promo bar catch'

# post-checks (index.html)
if (-not $html.Contains('function markupMult')) { Write-Host "ABORT: markupMult missing after patch." -ForegroundColor Red; exit 1 }
if ($html.Contains('* TDG.MARKUP'))             { Write-Host "ABORT: a flat TDG.MARKUP price calc still remains." -ForegroundColor Red; exit 1 }

# ---------- promo-codes.js ----------
$js = [System.IO.File]::ReadAllText($promoFile, [System.Text.Encoding]::UTF8)
$js2 = [regex]::Replace($js, "(?m)^[ \t]*'WELCOME10':.*\r?\n", "")
if ($js2 -eq $js) { Write-Host "ABORT: WELCOME10 line not found in promo-codes.js." -ForegroundColor Red; exit 1 }
if ($js2.Contains('WELCOME10'))       { Write-Host "ABORT: WELCOME10 still present after removal." -ForegroundColor Red; exit 1 }
if (-not $js2.Contains('MULTI2026'))  { Write-Host "ABORT: other promo codes went missing - aborting." -ForegroundColor Red; exit 1 }

# ---------- validate JS syntax with node ----------
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $tmpPromo = Join-Path $env:TEMP 'pc-promo-check.js'
    [System.IO.File]::WriteAllText($tmpPromo, $js2, $enc)
    & node --check $tmpPromo
    if ($LASTEXITCODE -ne 0) { Write-Host "ABORT: node --check failed on promo-codes.js. No changes written." -ForegroundColor Red; Remove-Item $tmpPromo -ErrorAction SilentlyContinue; exit 1 }
    Remove-Item $tmpPromo -ErrorAction SilentlyContinue

    $tmpMk = Join-Path $env:TEMP 'pc-markup-check.js'
    [System.IO.File]::WriteAllText($tmpMk, 'function markupMult(cost){ var f = 0.35 - 0.001*((+cost||0)-75); if(f>0.35)f=0.35; if(f<0.18)f=0.18; return 1+f; }', $enc)
    & node --check $tmpMk
    if ($LASTEXITCODE -ne 0) { Write-Host "ABORT: node --check failed on markupMult snippet." -ForegroundColor Red; Remove-Item $tmpMk -ErrorAction SilentlyContinue; exit 1 }
    Remove-Item $tmpMk -ErrorAction SilentlyContinue
    Write-Host "node --check: PASS" -ForegroundColor Green
} else {
    Write-Host "NOTE: node not found - skipped JS syntax check." -ForegroundColor Yellow
}

# ---------- backup + write ----------
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Copy-Item $indexFile "$indexFile.bak-markup-$stamp"
Copy-Item $promoFile "$promoFile.bak-markup-$stamp"
[System.IO.File]::WriteAllText($indexFile, $html, $enc)
[System.IO.File]::WriteAllText($promoFile, $js2, $enc)

Write-Host ""
Write-Host "DONE." -ForegroundColor Green
Write-Host "  - index.html: flat 35% markup replaced with linear sliding scale (35% to 18%)."
Write-Host "  - index.html: WELCOME10 promo bar no longer shows."
Write-Host "  - promo-codes.js: WELCOME10 code removed (other codes kept)."
Write-Host "  Backups: *.bak-markup-$stamp"
Write-Host ""
Write-Host "Next: review locally, then deploy with  .\push-pctires.ps1"
