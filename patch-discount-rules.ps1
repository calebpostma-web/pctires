# ============================================================
#  patch-discount-rules.ps1
#  PC Tires - 10% discount rules
#
#  RULES THIS ADDS:
#    1. No 10% off on budget items (anything priced by the $20
#       margin floor, i.e. TDG cost under ~$93 - Antares etc.)
#    2. The 10% only applies to a full set of 4+ of the SAME item.
#       Drop a cart line to 2 tires and it snaps back to retail.
#  Applies to BOTH member pricing (postmah&c) and all percent-type
#  promo codes (WELCOME10, EZRA2026, and any future percent codes).
#  Markup / flat / per_tire / free_install codes are untouched.
#
#  Run from the repo folder:
#    .\patch-discount-rules.ps1
#  then deploy:
#    .\push-pctires.ps1
#
#  Verified in sandbox 2026-06-11: all 14 anchors unique, every
#  inline JS block passes node --check, 15/15 pricing tests pass.
# ============================================================

$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot 'index.html'
if (-not (Test-Path $path)) { throw 'index.html not found next to this script. Run from the repo folder.' }

$utf8 = New-Object System.Text.UTF8Encoding($false)
$script:txt = [System.IO.File]::ReadAllText($path, $utf8)
$orig = $script:txt
$nl = if ($script:txt.Contains("`r`n")) { "`r`n" } else { "`n" }
$star = [string][char]0x2605   # the black star character, kept out of this ASCII file

function Fix-NL([string]$s) { return $s.Replace("`r`n", "`n").Replace("`n", $nl) }

function Patch([string]$name, [string]$old, [string]$new) {
  $old = Fix-NL $old; $new = Fix-NL $new
  $first = $script:txt.IndexOf($old, [System.StringComparison]::Ordinal)
  if ($first -lt 0) { throw "ANCHOR NOT FOUND: $name (file changed since patch was written - do not push)" }
  if ($script:txt.IndexOf($old, $first + 1, [System.StringComparison]::Ordinal) -ge 0) { throw "ANCHOR NOT UNIQUE: $name - do not push" }
  $script:txt = $script:txt.Remove($first, $old.Length).Insert($first, $new)
  Write-Host "  OK  $name"
}

function RePatch([string]$name, [string]$pat, [string]$rep, [int]$expect) {
  $m = [regex]::Matches($script:txt, $pat)
  if ($m.Count -ne $expect) { throw "REGEX $name matched $($m.Count) times, expected $expect - do not push" }
  $script:txt = [regex]::Replace($script:txt, $pat, $rep)
  Write-Host "  OK  $name"
}

Write-Host 'Applying discount-rule edits...'

# ---- E1: discountEligible() helper + memberPrice() exclusion ----
$old = @'
function memberPrice(item) { return Math.round(retailPrice(item) * (1 - TDG.MEMBER_DISCOUNT) * 100) / 100; }
'@
$new = @'
function discountEligible(item) {
  // "Lowest end" exclusion: if the $20 margin floor set this item's price
  // (cost x 1.35 would land below the floor), the 10% never applies.
  return (item.price * TDG.MARKUP) >= ((item.price + TDG.MIN_MARGIN) / (1 - TDG.MEMBER_DISCOUNT));
}
function memberPrice(item) {
  if (!discountEligible(item)) return retailPrice(item);
  return Math.round(retailPrice(item) * (1 - TDG.MEMBER_DISCOUNT) * 100) / 100;
}
'@
Patch 'E1 memberPrice + discountEligible' $old $new

# ---- E2: member badge only shows on items that actually get the discount ----
Patch 'E2a priceBadgeHTML signature' 'function priceBadgeHTML() {' 'function priceBadgeHTML(item) {'

$old = ('  if (currentMember && !isOwner()) return ''<div class="member-price-badge">' + $star + ' Member Price</div>'';')
$new = ('  if (currentMember && !isOwner()) { if (item && !discountEligible(item)) return ''''; return ''<div class="member-price-badge">' + $star + ' Member Price</div>''; }')
Patch 'E2b member badge conditional' $old $new

RePatch 'E2c tire card badge calls' 'displayedPrice\(t\);(\s*)const memberBadge = priceBadgeHTML\(\);' 'displayedPrice(t);$1const memberBadge = priceBadgeHTML(t);' 2
RePatch 'E2d wheel card badge call' 'displayedPrice\(w\);(\s*)const memberBadge = priceBadgeHTML\(\);' 'displayedPrice(w);$1const memberBadge = priceBadgeHTML(w);' 1
Patch 'E2e tire detail badge call' '  const badge = priceBadgeHTML();' '  const badge = priceBadgeHTML(t);'

# ---- E3: cart lines remember retail price + eligibility ----
$old = @'
  else cart.push({ ...item, price: priceToCharge, qty: itemType === 'wheel' ? 4 : 4, install: !isCommercialTire(item), itemType: itemType || 'tire' });
'@
$new = @'
  else cart.push({ ...item, price: priceToCharge, retailEach: retailPrice(item), discEligible: discountEligible(item), qty: itemType === 'wheel' ? 4 : 4, install: !isCommercialTire(item), itemType: itemType || 'tire' });
'@
Patch 'E3 addToCart stores retailEach' $old $new

# ---- E4: live cart repricing (the qty-4 enforcement) ----
$old = @'
function getTotals() {
'@
$new = @'
// -- 10% discount rules: eligibility + set-of-4 repricing --
// The 10% (member pricing and percent promo codes) applies only to items
// above the budget floor (discountEligible) AND only on qty 4+ of the same item.
function repriceCartLine(c) {
  if (typeof c.retailEach !== 'number' || typeof c.discEligible !== 'boolean') {
    const pool = c.itemType === 'wheel'
      ? (typeof allWheels !== 'undefined' ? allWheels : [])
      : (typeof allTires !== 'undefined' ? allTires : []);
    const orig = pool.find(t => t.itemNumber === c.itemNumber);
    if (orig) { c.retailEach = retailPrice(orig); c.discEligible = discountEligible(orig); }
  }
  if (isOwner()) return;
  if (typeof c.retailEach !== 'number') return;
  const memberOk = currentMember && c.qty >= 4 && c.discEligible === true;
  c.price = memberOk
    ? Math.round(c.retailEach * (1 - TDG.MEMBER_DISCOUNT) * 100) / 100
    : c.retailEach;
}
function repriceCart() {
  if (window._quoteLocked) return;
  if (typeof window._quoteFinalTotal === 'number' && window._quoteFinalTotal > 0) return;
  cart.forEach(repriceCartLine);
}

function getTotals() {
'@
Patch 'E4a repriceCart functions' $old $new

$old = @'
  const baseInst = cart.reduce((s, c) => s + (c.install && c.itemType !== 'wheel' ? TDG.INSTALL_PRICE * c.qty : 0), 0);
'@
$new = @'
  repriceCart();
  const baseInst = cart.reduce((s, c) => s + (c.install && c.itemType !== 'wheel' ? TDG.INSTALL_PRICE * c.qty : 0), 0);
'@
Patch 'E4b getTotals reprice hook' $old $new

$old = @'
  const body = document.getElementById('cartBody'), foot = document.getElementById('cartFoot');
'@
$new = @'
  repriceCart();
  const body = document.getElementById('cartBody'), foot = document.getElementById('cartFoot');
'@
Patch 'E4c renderCart reprice hook' $old $new

# ---- E5: cart line note so the price change is never a mystery ----
$old = @'
    const commercial = isCommercialTire(item);
'@
$new = @'
    const commercial = isCommercialTire(item);
    let memberNote = '';
    if (currentMember && !isOwner() && item.discEligible === true && item.qty < 4) {
      memberNote = '<div style="font-size:11px;color:var(--yellow);margin-top:3px">Member 10% applies on a full set of 4+</div>';
    } else if (currentMember && !isOwner() && item.discEligible === false) {
      memberNote = '<div style="font-size:11px;color:var(--muted);margin-top:3px">Member discount not available on this item</div>';
    }
'@
Patch 'E5a cart member note' $old $new

$old = @'
        ${rebateNote}
'@
$new = @'
        ${rebateNote}${memberNote}
'@
Patch 'E5b cart member note render' $old $new

# ---- E6: percent promo codes follow the same rules ----
$old = @'
    case 'percent':      return { sub: sub * (def.value / 100), inst: 0 };
'@
$new = @'
    case 'percent': {
      // Percent codes follow the same rules as member pricing:
      // only items above the budget floor, only on qty 4+ of the same item.
      let elig = 0;
      for (const c of cartItems) {
        const ok = (typeof c.discEligible === 'boolean') ? c.discEligible : true;
        if (c.qty >= 4 && ok) elig += c.price * c.qty;
      }
      return { sub: Math.min(elig, sub) * (def.value / 100), inst: 0 };
    }
'@
Patch 'E6 percent promo restriction' $old $new

# ---- E7: clear error when a percent code has nothing to apply to ----
$old = @'
  return { ok: true, code: actualKey, def };
'@
$new = @'
  if (def.type === 'percent' && cart.length) {
    if (typeof repriceCart === 'function') repriceCart();
    const anyElig = cart.some(c => c.qty >= 4 && (typeof c.discEligible === 'boolean' ? c.discEligible : true));
    if (!anyElig) return { ok: false, error: 'This code applies to full sets of 4 or more (select budget items excluded).' };
  }
  return { ok: true, code: actualKey, def };
'@
Patch 'E7 percent code validation' $old $new

# ---- Post-checks ----
foreach ($marker in @('function discountEligible(item)', 'function repriceCart()', 'memberNote', "case 'percent': {", 'retailEach: retailPrice(item)')) {
  if (-not $script:txt.Contains($marker)) { throw "POST-CHECK FAILED: '$marker' missing from patched file - do not push" }
}

# ---- Backup, then write ----
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bak = Join-Path $PSScriptRoot ("index.html.bak-" + $stamp)
[System.IO.File]::WriteAllText($bak, $orig, $utf8)
[System.IO.File]::WriteAllText($path, $script:txt, $utf8)

Write-Host ''
Write-Host '============================================='
Write-Host ' ALL 14 EDITS APPLIED + POST-CHECKS PASSED'
Write-Host " Backup saved: $bak"
Write-Host ''
Write-Host ' Deploy with:  .\push-pctires.ps1'
Write-Host '============================================='
