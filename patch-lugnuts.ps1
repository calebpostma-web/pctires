# patch-lugnuts.ps1
# Adds lug nut spec (thread / hex socket / seat / nut-bolt + stock kit match) to:
#   1. tech-sync.js     - lug data rides along on every getTorque response
#   2. tech-specs.js    - AI fallback now returns lug fields too
#   3. tech.html        - Lug Nut box on phone spec card + TV quad
#                         (replaces the redundant Vehicle box - vehicle name
#                          is already in the header/banner)
#   4. send-order-email.js - internal order email gets a Lug Spec row with
#                            IN STOCK kit name, or a red HEADS UP badge when
#                            the spec is not covered by stocked kits
# Requires: functions/tech-lugnut-db.js (new file, already in repo)
# Run from repo root:  .\patch-lugnuts.ps1
# Then deploy:         .\push-pctires.ps1

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

function ReadF([string]$p) { [System.IO.File]::ReadAllText($p) }
function WriteF([string]$p, [string]$t) {
  [System.IO.File]::WriteAllText($p, $t, (New-Object System.Text.UTF8Encoding($false)))
}
function NormLF([string]$s) { $s.Replace("`r`n", "`n") }

function PatchExact([string]$path, [string]$old, [string]$new, [int]$expect = 1) {
  $old = NormLF $old; $new = NormLF $new
  $t = ReadF $path
  $c = ([regex]::Matches($t, [regex]::Escape($old))).Count
  if ($c -ne $expect) {
    throw ("ANCHOR FAIL in " + $path + " - found " + $c + ", expected " + $expect + ". Anchor starts: " + $old.Substring(0, [Math]::Min(70, $old.Length)))
  }
  WriteF $path ($t.Replace($old, $new))
}

function PatchRegex([string]$path, [string]$pattern, [string]$new) {
  $new = NormLF $new
  $t = ReadF $path
  $m = [regex]::Matches($t, $pattern)
  if ($m.Count -ne 1) {
    throw ("REGEX ANCHOR FAIL in " + $path + " - found " + $m.Count + " matches for: " + $pattern)
  }
  WriteF $path ($t.Replace($m[0].Value, $new))
}

function MustContain([string]$path, [string]$needle) {
  if (-not (ReadF $path).Contains($needle)) { throw ("VERIFY FAIL - " + $path + " missing: " + $needle) }
}
function MustNotContain([string]$path, [string]$needle) {
  if ((ReadF $path).Contains($needle)) { throw ("VERIFY FAIL - " + $path + " still contains: " + $needle) }
}

$sync  = Join-Path $root 'functions\tech-sync.js'
$specs = Join-Path $root 'functions\tech-specs.js'
$page  = Join-Path $root 'tech.html'
$email = Join-Path $root 'functions\send-order-email.js'
$db    = Join-Path $root 'functions\tech-lugnut-db.js'

if (-not (Test-Path $db)) { throw 'functions\tech-lugnut-db.js is missing - it must be in the repo before patching.' }

# -- Backups ----------------------------------------------------------
foreach ($f in @($sync, $specs, $page, $email)) {
  Copy-Item $f ($f + '.bak-lugnuts-' + $stamp)
}
Write-Host ('Backups created (.bak-lugnuts-' + $stamp + ')') -ForegroundColor Cyan

# ====================================================================
# 1. tech-sync.js
# ====================================================================

PatchExact $sync "import { classifyVehicle } from './tech-vehicle-type.js';" @'
import { classifyVehicle } from './tech-vehicle-type.js';
import { findLug } from './tech-lugnut-db.js';
'@

PatchExact $sync @'
        const key = normTorqueKey(body);
        const raw = await env.TECH_KV.get(key);
'@ @'
        // Lug hardware spec rides along on every getTorque response
        const lug = findLug({ year: body.year, make: body.make, model: body.model });

        const key = normTorqueKey(body);
        const raw = await env.TECH_KV.get(key);
'@

PatchExact $sync "return json({ ok: true, torque: { ...entry, source: 'verified' } });" "return json({ ok: true, torque: { ...entry, source: 'verified' }, lug });"

PatchExact $sync @'
              vehicleType,
            },
          });
'@ @'
              vehicleType,
            },
            lug,
          });
'@ 3

PatchExact $sync "return json({ ok: true, torque: null });" "return json({ ok: true, torque: null, lug });"

Write-Host 'tech-sync.js patched' -ForegroundColor Green

# ====================================================================
# 2. tech-specs.js (AI fallback)
# ====================================================================

PatchExact $specs '  "cold_pressure_rear_psi": <number or null>,' @'
  "cold_pressure_rear_psi": <number or null>,
  "lug_thread": "<e.g. 'M12x1.5' or '1/2-20' or null>",
  "lug_hex_mm": <17 | 19 | 21 | 22 | null>,
  "lug_seat": "<conical | ball | mag | flat | unknown>",
  "lug_type": "<nut | bolt | unknown>",
'@

PatchExact $specs '- For relearn: OBD = requires scan tool, auto = drives 15-20min, stationary = manual procedure.' @'
- For relearn: OBD = requires scan tool, auto = drives 15-20min, stationary = manual procedure.
- Lug hardware: thread like 'M12x1.5', 'M14x1.5', '1/2-20', '9/16-18'. Seat: conical (most Asian/domestic), ball (VW/Audi/Mercedes/Porsche, Honda OEM alloys), mag = flat-washer/shank style (Toyota trucks, many Toyota OEM alloys). Type: bolt for most German vehicles, nut otherwise. If not certain, return null/unknown. Never guess thread size.
'@

PatchExact $specs @'
      pressure: {
        frontPsi: parsed.cold_pressure_front_psi || null,
        rearPsi: parsed.cold_pressure_rear_psi || null,
      },
'@ @'
      pressure: {
        frontPsi: parsed.cold_pressure_front_psi || null,
        rearPsi: parsed.cold_pressure_rear_psi || null,
      },
      lug: {
        thread: parsed.lug_thread || null,
        hexMm: parsed.lug_hex_mm || null,
        seat: parsed.lug_seat && parsed.lug_seat !== 'unknown' ? parsed.lug_seat : null,
        type: parsed.lug_type && parsed.lug_type !== 'unknown' ? parsed.lug_type : null,
      },
'@

Write-Host 'tech-specs.js patched' -ForegroundColor Green

# ====================================================================
# 3. tech.html
# ====================================================================

# 3a. Merge lug into the scan object (published DB > AI, never claim a
#     stock kit match on unverified AI data)
PatchExact $page '  const tpms = aiRes.ok ? (aiRes.tpms || {}) : {};' @'
  // Lug hardware: published DB (rides along on getTorque) > AI fallback
  let lug = null;
  if (verifiedRes.ok && verifiedRes.lug) {
    lug = { ...verifiedRes.lug, source: 'published' };
  } else if (aiRes.ok && aiRes.lug && (aiRes.lug.thread || aiRes.lug.hexMm)) {
    lug = { ...aiRes.lug, source: 'ai', kit: null };
  }

  const tpms = aiRes.ok ? (aiRes.tpms || {}) : {};
'@

PatchExact $page @'
    vin,
    vehicle,
    torque,
'@ @'
    vin,
    vehicle,
    torque,
    lug,
'@

# 3b. Phone render - build lug display strings
PatchExact $page '  const p = scan.pressure;' @'
  const p = scan.pressure;
  const lug = scan.lug || null;
  const lugMain = lug && lug.hexMm ? lug.hexMm + '<span class="spec-unit">mm hex</span>'
                : (lug && lug.thread ? '<span style="font-size:18px">' + escapeHtml(lug.thread) + '</span>' : '&mdash;');
  const lugSub = lug ? [lug.thread, lug.seat, lug.type].filter(Boolean).join(' &middot; ') : '';
  const lugKitLine = lug && lug.kit ? '<div class="spec-sub" style="color:#4ade80;font-weight:700">Stock: ' + escapeHtml(lug.kit) + '</div>'
                   : (lug ? '<div class="spec-sub" style="color:#f87171;font-weight:700">NOT IN LUG STOCK</div>' : '');
  const lugNote = lug && lug.note ? '<div class="spec-sub" style="font-size:10px">' + escapeHtml(lug.note) + '</div>' : '';
  const lugBadge = !lug ? '<div class="spec-badge unknown">Unknown</div>'
                 : lug.source === 'ai' ? '<div class="spec-badge ai">&#9888; AI &middot; Verify</div>'
                 : '<div class="spec-badge published">&#128214; Published</div>';
'@

# 3c. Replace the redundant Vehicle spec box with the Lug Nut box
PatchRegex $page '<div class="spec-box">\s*<div class="spec-label">Vehicle</div>[\s\S]*?</div>\s*</div>' @'
<div class="spec-box">
          <div class="spec-label">Lug Nut</div>
          <div class="spec-value">${lugMain}</div>
          <div class="spec-sub">${lugSub}</div>
          ${lugKitLine}
          ${lugNote}
          ${lugBadge}
        </div>
'@

# 3d. TV - replace the Vehicle quad with a Lug Nut quad
PatchRegex $page '<div class="tv-quad">\s*<div class="q-label">Vehicle</div>[\s\S]*?</div>\s*</div>\s*</div>' @'
<div class="tv-quad">
        <div class="q-label">Lug Nut</div>
        <div class="q-big small" id="tvLugMain">&mdash;</div>
        <div class="q-unit" id="tvLugUnit"></div>
        <div class="q-sub" id="tvLugSub"></div>
      </div>
'@

# 3e. TV render JS
PatchExact $page @'
  // Vehicle stack
  document.getElementById('tvStackMake').textContent = (v.make || '').toUpperCase();
  document.getElementById('tvStackModel').textContent = v.model || '';
  document.getElementById('tvStackTrim').textContent = v.trim || '';
'@ @'
  // Lug nut
  const lg = scan.lug || {};
  document.getElementById('tvLugMain').textContent = lg.hexMm ? (lg.hexMm + ' mm') : (lg.thread || '\u2014');
  document.getElementById('tvLugUnit').textContent = lg.hexMm ? 'socket' : '';
  document.getElementById('tvLugSub').textContent =
    [lg.thread, lg.seat, lg.type].filter(Boolean).join(' / ')
    + (lg.kit ? '  -  Stock: ' + lg.kit : (lg.thread ? '  -  NOT IN STOCK' : ''));
'@

Write-Host 'tech.html patched' -ForegroundColor Green

# ====================================================================
# 4. send-order-email.js (internal email only)
# ====================================================================

PatchExact $email "const TDG_API_BASE       = 'https://www.tdgaccess.ca/api';" @'
import { findLug } from './tech-lugnut-db.js';

const TDG_API_BASE       = 'https://www.tdgaccess.ca/api';
'@

PatchExact $email "  const rowVal    = 'padding:5px 0;text-align:right;color:#e0e0e0;font-size:14px';" @'
  const rowVal    = 'padding:5px 0;text-align:right;color:#e0e0e0;font-size:14px';

  // Lug hardware heads-up: look up the vehicle's lug spec and flag anything
  // not covered by the stocked kits (Lug Hardware Bay Card, June 2026).
  const lugSpec = (order.vehicleYear && order.vehicleMake && order.vehicleModel)
    ? findLug({ year: order.vehicleYear, make: order.vehicleMake, model: order.vehicleModel })
    : null;
  let lugRowHtml = '';
  if (order.vehicle) {
    if (lugSpec) {
      const specTxt = [lugSpec.thread, lugSpec.hexMm ? lugSpec.hexMm + 'mm hex' : null, lugSpec.seat, lugSpec.type].filter(Boolean).join(' &middot; ');
      const badge = lugSpec.kit
        ? '<span style="color:#4ade80;font-size:11px;font-weight:700;margin-left:6px">IN STOCK &middot; ' + lugSpec.kit + '</span>'
        : '<span style="background:#7f1d1d;color:#fecaca;font-size:11px;font-weight:700;padding:2px 6px;border-radius:3px;margin-left:6px">HEADS UP &mdash; NOT IN LUG STOCK</span>';
      lugRowHtml = '<tr><td style="' + rowLbl + '">Lug Spec</td><td style="' + rowVal + '">' + specTxt + badge + '</td></tr>'
        + (lugSpec.note ? '<tr><td></td><td style="padding:0 0 5px;text-align:right;color:#888;font-size:11px">' + lugSpec.note + '</td></tr>' : '');
    } else {
      lugRowHtml = '<tr><td style="' + rowLbl + '">Lug Spec</td><td style="' + rowVal + ';color:#888">Unknown &mdash; check at write-up</td></tr>';
    }
  }
'@

PatchExact $email '      <tr><td style="${rowLbl}">Vehicle</td><td style="${rowVal}">${order.vehicle || ''-''}</td></tr>' @'
      <tr><td style="${rowLbl}">Vehicle</td><td style="${rowVal}">${order.vehicle || '-'}</td></tr>
      ${lugRowHtml}
'@

Write-Host 'send-order-email.js patched' -ForegroundColor Green

# ====================================================================
# Verification
# ====================================================================

Write-Host ''
Write-Host 'Running node --check on all touched JS...' -ForegroundColor Cyan
foreach ($f in @($db, $sync, $specs, $email)) {
  node --check $f
  if ($LASTEXITCODE -ne 0) { throw ('node --check FAILED on ' + $f + ' - restore from .bak-lugnuts-' + $stamp) }
  Write-Host ('  OK ' + (Split-Path $f -Leaf))
}

# Structural checks
MustContain $sync  'findLug'
MustContain $sync  'torque: null, lug'
MustContain $specs 'lug_thread'
MustContain $specs 'lug: {'
MustContain $page  'tvLugMain'
MustContain $page  'scan.lug'
MustContain $page  'Lug Nut'
MustNotContain $page 'tvStackMake'
MustContain $email 'lugRowHtml'
MustContain $email 'NOT IN LUG STOCK'

# Quick live lookup test against the real DB
Write-Host ''
Write-Host 'Running lug lookup smoke test...' -ForegroundColor Cyan
$dbUrl = 'file:///' + ($db -replace '\\', '/')
$testJs = @"
import { findLug } from '$dbUrl';
const t = [
  [2020,'Ford','F-150','M14x1.5','KIT902'],
  [2008,'Ford','F-150','M14x2.0','KIT903'],
  [2019,'Toyota','Tundra','M14x1.5',null],
  [2018,'Toyota','Tacoma','M12x1.5','TMS1215'],
  [2012,'Jeep','Wrangler','1/2"-20','JOBBER 1/2-20'],
  [2019,'Volkswagen','Jetta','M14x1.5',null],
  [2019,'Nissan','Rogue','M12x1.25','KIT905'],
];
let bad = 0;
for (const [y,mk,mo,th,kit] of t) {
  const r = findLug({year:y,make:mk,model:mo});
  if (!r || r.thread !== th || r.kit !== kit) { bad++; console.error('FAIL', y, mk, mo, JSON.stringify(r)); }
}
if (bad) process.exit(1);
console.log('  All ' + t.length + ' smoke tests pass');
"@
$tmpTest = Join-Path $env:TEMP ('lug-smoke-' + $stamp + '.mjs')
[System.IO.File]::WriteAllText($tmpTest, $testJs, (New-Object System.Text.UTF8Encoding($false)))
node $tmpTest
if ($LASTEXITCODE -ne 0) { throw 'Lug lookup smoke test FAILED' }
Remove-Item $tmpTest -ErrorAction SilentlyContinue

Write-Host ''
Write-Host 'ALL PATCHES APPLIED AND VERIFIED' -ForegroundColor Green
Write-Host 'Deploy with:  .\push-pctires.ps1' -ForegroundColor Yellow
