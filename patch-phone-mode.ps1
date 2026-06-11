# patch-phone-mode.ps1 (v2) -- owner-gated "Phone Order Mode" for index.html
#
# What it does:
#   - Badge appears ONLY when signed in as owner (pctowner2026 via Member Login).
#   - Badge is a toggle: "PHONE ORDER: OFF" / "PHONE ORDER: ON". Tap to switch.
#   - When ON: kills browser autofill on checkout name/email/phone/card-name
#     fields and tags the order [PHONE ORDER] in internal email + Sheets log.
#   - Customers never see the badge. ?phone=1 / ?phone=0 still work as shortcuts.
#
# Safe to run whether or not you ran the earlier (v1) version of this patch:
#   - fresh file  -> applies v2
#   - v1 applied  -> upgrades the block to v2
#   - v2 applied  -> exits, no changes
#
# Run from the PCtires folder:   .\patch-phone-mode.ps1
# Then deploy:                   .\push-pctires.ps1

$ErrorActionPreference = 'Stop'
$f = Join-Path $PSScriptRoot 'index.html'
if (-not (Test-Path $f)) { Write-Host 'ERROR: index.html not found next to this script.' -ForegroundColor Red; exit 1 }

$raw = [System.IO.File]::ReadAllText($f)
$origLen = $raw.Length

$anchor = 'function getOrCreateOrderId() {'
$oldSM  = "searchMethod: lastSearchMethod || 'unknown',"
$newSM  = "searchMethod: (lastSearchMethod || 'unknown') + (staffPhoneOrder ? ' [PHONE ORDER]' : ''),"

# ---- v1 block (exact text, for upgrade detection/removal) ------------
$v1block = @'
// -- PHONE ORDER MODE (staff only) -----------------------------------
// Activate: pctires.ca/?phone=1   Exit: click the badge or /?phone=0
// Kills browser autofill on checkout fields and tags the order as a
// phone order in the internal email and order log.
var staffPhoneOrder = false;
(function () {
  try {
    var pm = new URLSearchParams(location.search).get('phone');
    if (pm === '1') sessionStorage.setItem('pcPhoneMode', '1');
    if (pm === '0') sessionStorage.removeItem('pcPhoneMode');
    staffPhoneOrder = sessionStorage.getItem('pcPhoneMode') === '1';
  } catch (e) {}
  if (!staffPhoneOrder) return;
  function applyPhoneMode() {
    ['fName', 'lName', 'email', 'phone', 'cardName'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.setAttribute('autocomplete', 'off');
        el.setAttribute('name', 'pc-x-' + id);
        el.setAttribute('data-lpignore', 'true');
      }
    });
    var b = document.createElement('div');
    b.id = 'phoneModeBadge';
    b.textContent = 'PHONE ORDER MODE - tap to exit';
    b.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:99999;background:#f5c518;color:#0a0a0a;font:700 11px Barlow,sans-serif;letter-spacing:1.5px;padding:4px 14px;border-radius:0 0 2px 2px;cursor:pointer;white-space:nowrap';
    b.onclick = function () {
      try { sessionStorage.removeItem('pcPhoneMode'); } catch (e) {}
      location.href = location.pathname;
    };
    document.body.appendChild(b);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyPhoneMode);
  } else {
    applyPhoneMode();
  }
})();
'@

# ---- v2 block --------------------------------------------------------
$v2block = @'
// -- PHONE ORDER MODE (owner only) -----------------------------------
// Badge appears only when signed in as owner. Tap badge to toggle.
// When ON: kills browser autofill on checkout fields and tags the
// order as [PHONE ORDER] in the internal email and order log.
var staffPhoneOrder = false;
(function () {
  try {
    var pm = new URLSearchParams(location.search).get('phone');
    if (pm === '1') sessionStorage.setItem('pcPhoneMode', '1');
    if (pm === '0') sessionStorage.removeItem('pcPhoneMode');
  } catch (e) {}

  function setAutofill(off) {
    ['fName', 'lName', 'email', 'phone', 'cardName'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (off) {
        el.setAttribute('autocomplete', 'off');
        el.setAttribute('name', 'pc-x-' + id);
        el.setAttribute('data-lpignore', 'true');
      } else {
        el.removeAttribute('autocomplete');
        el.removeAttribute('name');
        el.removeAttribute('data-lpignore');
      }
    });
  }

  function render() {
    var owner = (typeof isOwner === 'function') && isOwner();
    var b = document.getElementById('phoneModeBadge');
    if (!owner) {
      if (staffPhoneOrder) setAutofill(false);
      staffPhoneOrder = false;
      if (b) b.remove();
      return;
    }
    var on = false;
    try { on = sessionStorage.getItem('pcPhoneMode') === '1'; } catch (e) {}
    staffPhoneOrder = on;
    setAutofill(on);
    if (!b) {
      b = document.createElement('div');
      b.id = 'phoneModeBadge';
      b.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:99999;font:700 11px Barlow,sans-serif;letter-spacing:1.5px;padding:4px 14px;border-radius:0 0 2px 2px;cursor:pointer;white-space:nowrap';
      b.onclick = function () {
        try {
          if (sessionStorage.getItem('pcPhoneMode') === '1') sessionStorage.removeItem('pcPhoneMode');
          else sessionStorage.setItem('pcPhoneMode', '1');
        } catch (e) {}
        render();
      };
      document.body.appendChild(b);
    }
    b.textContent = on ? 'PHONE ORDER: ON' : 'PHONE ORDER: OFF';
    b.style.background = on ? '#f5c518' : '#1d1d1d';
    b.style.color = on ? '#0a0a0a' : '#888888';
    b.style.border = on ? 'none' : '1px solid #333333';
  }

  function boot() { render(); setInterval(render, 2000); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
'@

# ---- normalize line endings to match index.html (CRLF) ---------------
$crlf = "`r`n"
$v1block = $v1block -replace "\r?\n", $crlf
$v2block = $v2block -replace "\r?\n", $crlf

# ---- detect state ----------------------------------------------------
if ($raw.Contains('PHONE ORDER MODE (owner only)')) {
  Write-Host 'v2 already applied - nothing to do.' -ForegroundColor Yellow
  exit 0
}

$mode = 'fresh'
if ($raw.Contains('pcPhoneMode')) {
  if ($raw.Contains($v1block)) {
    $mode = 'upgrade'
  } else {
    Write-Host 'ERROR: file contains a modified phone-mode block I do not recognize.' -ForegroundColor Red
    Write-Host 'Restore a pre-phonemode backup first, then re-run.' -ForegroundColor Red
    exit 1
  }
}

if ($mode -eq 'fresh') {
  $cA = ([regex]::Matches($raw, [regex]::Escape($anchor))).Count
  $cS = ([regex]::Matches($raw, [regex]::Escape($oldSM))).Count
  if ($cA -ne 1) { Write-Host "ERROR: expected 1 anchor, found $cA. Aborting, file untouched." -ForegroundColor Red; exit 1 }
  if ($cS -ne 2) { Write-Host "ERROR: expected 2 searchMethod lines, found $cS. Aborting, file untouched." -ForegroundColor Red; exit 1 }
} else {
  $cN = ([regex]::Matches($raw, [regex]::Escape($newSM))).Count
  if ($cN -ne 2) { Write-Host "ERROR: v1 detected but searchMethod tag count is $cN (expected 2). Aborting." -ForegroundColor Red; exit 1 }
}

# ---- syntax-check the v2 block before touching index.html ------------
if (Get-Command node -ErrorAction SilentlyContinue) {
  $tmpJs = Join-Path $env:TEMP 'pm-phone-block2.js'
  [System.IO.File]::WriteAllText($tmpJs, $v2block)
  node --check $tmpJs
  if ($LASTEXITCODE -ne 0) { Write-Host 'ERROR: v2 JS block failed node --check. Aborting, file untouched.' -ForegroundColor Red; exit 1 }
  Remove-Item $tmpJs -ErrorAction SilentlyContinue
  Write-Host 'node --check on v2 JS block: OK'
} else {
  Write-Host 'WARNING: node not found, skipping syntax check.' -ForegroundColor Yellow
}

# ---- backup ----------------------------------------------------------
$bak = "$f.bak-phonemode2-" + (Get-Date -Format 'yyyyMMdd-HHmmss')
Copy-Item $f $bak
Write-Host "Backup: $bak"
Write-Host "Mode: $mode"

# ---- apply -----------------------------------------------------------
if ($mode -eq 'fresh') {
  $raw = $raw.Replace($anchor, $v2block + $crlf + $anchor)
  $raw = $raw.Replace($oldSM, $newSM)
} else {
  $raw = $raw.Replace($v1block, $v2block)
}
[System.IO.File]::WriteAllText($f, $raw, (New-Object System.Text.UTF8Encoding($false)))

# ---- verify ----------------------------------------------------------
$chk = [System.IO.File]::ReadAllText($f)
$ok = $true
if (([regex]::Matches($chk, 'pcPhoneMode')).Count -ne 6)              { $ok = $false; Write-Host 'VERIFY FAIL: pcPhoneMode count wrong (expected 6)' -ForegroundColor Red }
if (([regex]::Matches($chk, [regex]::Escape($newSM))).Count -ne 2)    { $ok = $false; Write-Host 'VERIFY FAIL: searchMethod tag not present twice' -ForegroundColor Red }
if (([regex]::Matches($chk, [regex]::Escape($oldSM))).Count -ne 0)    { $ok = $false; Write-Host 'VERIFY FAIL: old searchMethod line still present' -ForegroundColor Red }
if (-not $chk.Contains('PHONE ORDER MODE (owner only)'))              { $ok = $false; Write-Host 'VERIFY FAIL: v2 block missing' -ForegroundColor Red }
if ($chk.Contains('PHONE ORDER MODE (staff only)'))                   { $ok = $false; Write-Host 'VERIFY FAIL: v1 block still present' -ForegroundColor Red }

if ($ok) {
  Write-Host ''
  Write-Host 'PATCH APPLIED AND VERIFIED (v2, owner-gated).' -ForegroundColor Green
  Write-Host "Size change: $($chk.Length - $origLen) chars."
  Write-Host ''
  Write-Host 'Next: .\push-pctires.ps1 to deploy.'
  Write-Host 'Usage: sign in as owner -> badge appears top-centre -> tap to toggle.'
} else {
  Write-Host ''
  Write-Host "VERIFICATION FAILED - restore with: Copy-Item '$bak' '$f' -Force" -ForegroundColor Red
  exit 1
}
