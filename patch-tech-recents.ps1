# patch-tech-recents.ps1
# Adds:
#   1) KV-backed Recent VINs (last 10, per bay) to /tech portal
#   2) Type-in VIN textbox inside the Scan VIN modal (fallback when camera fails)
#
# Run from PCtires project root:
#   PS> .\patch-tech-recents.ps1
#
# After it reports OK, deploy with:
#   PS> .\push-pctires.ps1

$ErrorActionPreference = 'Stop'

$root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$syncPath = Join-Path $root 'functions\tech-sync.js'
$htmlPath = Join-Path $root 'tech.html'

if (-not (Test-Path $syncPath)) { throw "tech-sync.js not found at $syncPath" }
if (-not (Test-Path $htmlPath)) { throw "tech.html not found at $htmlPath" }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$syncBak = "$syncPath.bak-recents-$stamp"
$htmlBak = "$htmlPath.bak-recents-$stamp"
Copy-Item $syncPath $syncBak
Copy-Item $htmlPath $htmlBak
Write-Host "Backups:" -ForegroundColor Cyan
Write-Host "  $syncBak"
Write-Host "  $htmlBak"

# Read both files as UTF-8 without BOM, preserving exact bytes
$utf8 = New-Object System.Text.UTF8Encoding $false
function ReadAll($p) { [System.IO.File]::ReadAllText($p, $utf8) }
function WriteAll($p, $s) { [System.IO.File]::WriteAllText($p, $s, $utf8) }

# ─── PART 1: tech-sync.js ─────────────────────────────────────────────
$sync = ReadAll $syncPath

if ($sync.Contains("case 'getRecents'")) {
    Write-Host "tech-sync.js already patched (getRecents present). Skipping." -ForegroundColor Yellow
}
else {
    # 1A: Insert RECENTS_KEY / RECENTS_MAX constants right after BAY_TTL line.
    # Anchor on the canonical portion; preserve the existing trailing comment.
    if ($sync -notmatch 'const BAY_TTL = 60 \* 60 \* 24;') {
        throw "tech-sync.js: BAY_TTL anchor not found"
    }
    $sync = [regex]::Replace(
        $sync,
        '(const BAY_TTL = 60 \* 60 \* 24;[^\n]*\n)',
        "`$1const RECENTS_KEY = 'recents:bay:1';`nconst RECENTS_MAX = 10;`n"
    )

    # 1B: Insert addRecent + getRecents cases right after the 'clear' case.
    $clearAnchor = @'
      case 'clear': {
        await env.TECH_KV.delete(BAY_KEY);
        return json({ ok: true });
      }
'@
    if (-not $sync.Contains($clearAnchor)) {
        throw "tech-sync.js: 'clear' case anchor not found"
    }
    $newCases = @'
      case 'clear': {
        await env.TECH_KV.delete(BAY_KEY);
        return json({ ok: true });
      }

      // === RECENT VINS PER BAY (last 10) ===
      case 'getRecents': {
        const raw = await env.TECH_KV.get(RECENTS_KEY);
        return json({ ok: true, recents: raw ? JSON.parse(raw) : [] });
      }

      case 'addRecent': {
        if (!body.entry || !body.entry.vin) {
          return json({ ok: false, error: 'Missing entry.vin' }, 400);
        }
        const raw = await env.TECH_KV.get(RECENTS_KEY);
        let recents = raw ? JSON.parse(raw) : [];
        const entry = body.entry;
        const veh = entry.vehicle || {};
        const vinUp = String(entry.vin).toUpperCase();
        const isManual = vinUp.startsWith('MANUAL-');
        const dedupKey = isManual
          ? 'MANUAL|' + (veh.year || '') + '|' + String(veh.make || '').toUpperCase() + '|' + String(veh.model || '').toUpperCase()
          : vinUp;
        recents = recents.filter(r => {
          const rVin = String(r.vin || '').toUpperCase();
          const rVeh = r.vehicle || {};
          const rKey = rVin.startsWith('MANUAL-')
            ? 'MANUAL|' + (rVeh.year || '') + '|' + String(rVeh.make || '').toUpperCase() + '|' + String(rVeh.model || '').toUpperCase()
            : rVin;
          return rKey !== dedupKey;
        });
        recents.unshift({
          vin: entry.vin,
          vehicle: {
            year: veh.year || null,
            make: veh.make || '',
            model: veh.model || '',
            trim: veh.trim || '',
          },
          ts: Date.now(),
        });
        if (recents.length > RECENTS_MAX) recents.length = RECENTS_MAX;
        await env.TECH_KV.put(RECENTS_KEY, JSON.stringify(recents));
        return json({ ok: true, recents });
      }
'@
    $sync = $sync.Replace($clearAnchor, $newCases)

    WriteAll $syncPath $sync
    Write-Host "tech-sync.js patched (constants + getRecents + addRecent)" -ForegroundColor Green
}

# ─── PART 2: tech.html ────────────────────────────────────────────────
$html = ReadAll $htmlPath

if ($html.Contains('id="recentRow"')) {
    Write-Host "tech.html already patched (recentRow present). Skipping." -ForegroundColor Yellow
}
else {
    # 2A: Inject CSS just before </style>
    $cssAnchor = @'
  .admin-table td.num { font-family: 'IBM Plex Mono', monospace; color: var(--yellow); font-weight: 700; }
</style>
'@
    if (-not $html.Contains($cssAnchor)) {
        throw "tech.html: CSS anchor (admin-table td.num) not found"
    }
    $newCss = @'
  .admin-table td.num { font-family: 'IBM Plex Mono', monospace; color: var(--yellow); font-weight: 700; }

  /* Recent VINs strip (phone mode only) */
  .recent-row { margin-bottom: 14px; }
  .recent-row .recent-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;
    color: var(--muted); font-weight: 700;
    margin-bottom: 6px;
  }
  .recent-chips {
    display: flex; gap: 8px; overflow-x: auto;
    padding-bottom: 4px;
  }
  .recent-chips::-webkit-scrollbar { height: 4px; }
  .recent-chips::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
  .recent-chip {
    flex: 0 0 auto;
    background: var(--card); border: 1px solid var(--border);
    color: var(--white);
    padding: 8px 12px; border-radius: 2px; cursor: pointer;
    text-align: left; font-family: 'Barlow', sans-serif;
    min-width: 120px;
    transition: border-color .15s, color .15s;
  }
  .recent-chip:hover { border-color: var(--yellow); }
  .recent-chip .rc-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px; font-weight: 700; line-height: 1.1;
    white-space: nowrap;
  }
  .recent-chip .rc-sub {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px; color: var(--muted); margin-top: 3px;
    letter-spacing: .5px;
  }

  /* Type-in VIN row inside Scan VIN modal */
  .vin-typein-row { margin-top: 14px; }
  .vin-typein-row .vin-or {
    text-align: center; font-family: 'IBM Plex Mono', monospace;
    font-size: 10px; color: var(--muted); letter-spacing: 2px;
    margin: 10px 0 8px; text-transform: uppercase;
  }
  .vin-typein-row label {
    display: block; font-family: 'Barlow Condensed', sans-serif;
    font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;
    color: var(--muted); font-weight: 700; margin-bottom: 5px;
  }
  .vin-typein-row .vin-input-wrap { display: flex; gap: 8px; }
  .vin-typein-row input {
    flex: 1; background: var(--raised); border: 1px solid var(--border);
    color: var(--white); padding: 10px 12px; border-radius: 2px;
    font-family: 'IBM Plex Mono', monospace; font-size: 14px;
    letter-spacing: 1px; text-transform: uppercase;
    outline: none;
  }
  .vin-typein-row input:focus { border-color: var(--yellow); }
  .vin-typein-row .vin-go {
    background: var(--yellow); color: var(--black);
    border: 1px solid var(--yellow); border-radius: 2px;
    padding: 0 16px; font-weight: 800; cursor: pointer;
    font-family: 'Barlow Condensed', sans-serif;
    letter-spacing: 1.5px; text-transform: uppercase; font-size: 13px;
    white-space: nowrap;
  }
  .vin-typein-row .vin-go:hover { filter: brightness(0.92); }
</style>
'@
    $html = $html.Replace($cssAnchor, $newCss)

    # 2B: Insert Recent VINs section after scan-row
    $scanRowAnchor = @'
    <section class="scan-row">
      <button class="scan-tile primary" onclick="openCamera()">
        <div class="icon">📷</div>
        <div class="label">Scan VIN</div>
      </button>
      <button class="scan-tile" onclick="openManualEntry()">
        <div class="icon">⌨️</div>
        <div class="label">Manual Entry</div>
      </button>
    </section>
'@
    if (-not $html.Contains($scanRowAnchor)) {
        throw "tech.html: scan-row anchor not found"
    }
    $scanRowReplacement = @'
    <section class="scan-row">
      <button class="scan-tile primary" onclick="openCamera()">
        <div class="icon">📷</div>
        <div class="label">Scan VIN</div>
      </button>
      <button class="scan-tile" onclick="openManualEntry()">
        <div class="icon">⌨️</div>
        <div class="label">Manual Entry</div>
      </button>
    </section>

    <!-- Recent VINs (phone mode, KV-backed, last 10) -->
    <section class="recent-row" id="recentRow" hidden>
      <div class="recent-label">Recent</div>
      <div class="recent-chips" id="recentChips"></div>
    </section>
'@
    $html = $html.Replace($scanRowAnchor, $scanRowReplacement)

    # 2C: Add VIN textbox inside Scan VIN modal
    $camInputLine = '    <input type="file" id="camInput" accept="image/*" capture="environment" style="display:none" onchange="handleCamCapture(event)">'
    if (-not $html.Contains($camInputLine)) {
        throw "tech.html: camInput anchor not found"
    }
    $camInputReplacement = @'
    <input type="file" id="camInput" accept="image/*" capture="environment" style="display:none" onchange="handleCamCapture(event)">
    <div class="vin-typein-row">
      <div class="vin-or">— or type it in —</div>
      <label for="vinTypeIn">VIN (17 characters)</label>
      <div class="vin-input-wrap">
        <input type="text" id="vinTypeIn" placeholder="1FTFW1ET5DKE12345" maxlength="17" autocapitalize="characters" autocomplete="off" spellcheck="false" onkeydown="if(event.key==='Enter'){event.preventDefault();submitTypedVIN();}">
        <button type="button" class="vin-go" onclick="submitTypedVIN()">Look Up</button>
      </div>
    </div>
'@
    $html = $html.Replace($camInputLine, $camInputReplacement)

    # 2D: Add currentRecents state var
    $stateAnchor = @'
// Current vehicle state (phone mode)
let currentScan = null;
'@
    if (-not $html.Contains($stateAnchor)) {
        throw "tech.html: currentScan state anchor not found"
    }
    $stateReplacement = @'
// Current vehicle state (phone mode)
let currentScan = null;
let currentRecents = [];
'@
    $html = $html.Replace($stateAnchor, $stateReplacement)

    # 2E: Wire loadRecents() into unlock()
    $unlockAnchor = @'
  if (TV_MODE) enterTVMode();
}
'@
    if (-not $html.Contains($unlockAnchor)) {
        throw "tech.html: unlock() closing anchor not found"
    }
    $unlockReplacement = @'
  if (TV_MODE) enterTVMode();
  else loadRecents();
}
'@
    $html = $html.Replace($unlockAnchor, $unlockReplacement)

    # 2F: Push to recents after specs load
    $pushAnchor = @'
  currentScan = scan;
  await pushToTV(scan);
  renderPhoneResult(scan);
  await loadNotes(vin);
'@
    if (-not $html.Contains($pushAnchor)) {
        throw "tech.html: loadSpecsForVehicle push anchor not found"
    }
    $pushReplacement = @'
  currentScan = scan;
  await pushToTV(scan);
  renderPhoneResult(scan);
  await loadNotes(vin);
  pushRecent(vin, vehicle);
'@
    $html = $html.Replace($pushAnchor, $pushReplacement)

    # 2G: Add the new JS functions just before clearVehicle().
    # Single-quoted here-string preserves backticks and ${...} of JS template literals.
    $fnAnchor = 'function clearVehicle() {'
    if (-not $html.Contains($fnAnchor)) {
        throw "tech.html: clearVehicle anchor not found"
    }
    $newFunctions = @'
/* ═══════════════════════════════════════════════════════════════
   RECENT VINS (KV-backed, per bay)
   ═══════════════════════════════════════════════════════════════ */
async function loadRecents() {
  if (TV_MODE) return;
  try {
    const r = await fetch('/tech-sync', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'getRecents' }),
    });
    const d = await r.json();
    if (d.ok) renderRecents(d.recents || []);
  } catch (e) {
    // silent — recents are nice-to-have, not critical
  }
}

function renderRecents(list) {
  currentRecents = Array.isArray(list) ? list : [];
  const row = document.getElementById('recentRow');
  const host = document.getElementById('recentChips');
  if (!row || !host) return;
  if (!currentRecents.length) { row.hidden = true; host.innerHTML = ''; return; }
  row.hidden = false;
  host.innerHTML = currentRecents.map(function(r) {
    const v = r.vehicle || {};
    const label = ((v.year || '') + ' ' + (v.make || '') + ' ' + (v.model || '')).trim() || 'Vehicle';
    const isManual = String(r.vin || '').startsWith('MANUAL-');
    const sub = isManual ? 'manual' : ('VIN …' + String(r.vin || '').slice(-5));
    const safeVin = String(r.vin || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return '<button type="button" class="recent-chip" onclick="tapRecent(\'' + safeVin + '\')">'
         + '<div class="rc-label">' + escapeHtml(label) + '</div>'
         + '<div class="rc-sub">' + escapeHtml(sub) + '</div>'
         + '</button>';
  }).join('');
}

function tapRecent(vinStr) {
  const r = currentRecents.find(function(x) { return String(x.vin) === String(vinStr); });
  if (!r) { toast('Recent entry missing', 'error'); return; }
  const veh = r.vehicle || {};
  if (vinStr.startsWith('MANUAL-')) {
    if (!veh.make || !veh.model) { toast('Recent entry incomplete', 'error'); return; }
    loadSpecsForVehicle(vinStr, {
      vin: null,
      year: veh.year,
      make: veh.make,
      model: veh.model,
      trim: veh.trim || '',
    });
  } else {
    processVIN(vinStr);
  }
}

function pushRecent(vin, vehicle) {
  if (!vin) return;
  fetch('/tech-sync', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      action: 'addRecent',
      entry: {
        vin: vin,
        vehicle: {
          year: (vehicle && vehicle.year) || null,
          make: (vehicle && vehicle.make) || '',
          model: (vehicle && vehicle.model) || '',
          trim: (vehicle && vehicle.trim) || '',
        },
      },
    }),
  }).then(function(r) { return r.json(); })
    .then(function(d) { if (d && d.ok) renderRecents(d.recents); })
    .catch(function() { /* ignore */ });
}

/* ═══════════════════════════════════════════════════════════════
   TYPE-IN VIN (fallback when camera scan fails)
   ═══════════════════════════════════════════════════════════════ */
function submitTypedVIN() {
  const inp = document.getElementById('vinTypeIn');
  if (!inp) return;
  const vin = (inp.value || '').toUpperCase().replace(/\s+/g, '').trim();
  if (vin.length !== 17) {
    toast('VIN must be 17 characters (' + vin.length + ' entered)', 'error');
    inp.focus();
    return;
  }
  // VINs exclude I, O, Q
  if (/[IOQ]/.test(vin)) {
    toast('VINs do not contain I, O, or Q — check for misreads', 'error');
    inp.focus();
    return;
  }
  inp.value = '';
  closeCamera();
  processVIN(vin);
}

function clearVehicle() {
'@
    $html = $html.Replace($fnAnchor, $newFunctions)

    WriteAll $htmlPath $html
    Write-Host "tech.html patched (recent strip + VIN textbox + JS + CSS)" -ForegroundColor Green
}

# ─── PART 3: Verification ─────────────────────────────────────────────
Write-Host ""
Write-Host "Verifying patches..." -ForegroundColor Cyan

# Node syntax check on tech-sync.js
$nodeCheck = & node --check $syncPath 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "node --check FAILED on tech-sync.js" -ForegroundColor Red
    Write-Host $nodeCheck
    Write-Host "Restore from backup with:"
    Write-Host "  Copy-Item '$syncBak' '$syncPath' -Force"
    exit 1
}
Write-Host "  [OK] tech-sync.js syntax valid (node --check)" -ForegroundColor Green

# Structural checks on tech.html
$h = ReadAll $htmlPath
$checks = @(
    @{ name = 'recentRow section';      pattern = 'id="recentRow"' },
    @{ name = 'recentChips host';       pattern = 'id="recentChips"' },
    @{ name = 'vinTypeIn input';        pattern = 'id="vinTypeIn"' },
    @{ name = 'loadRecents function';   pattern = 'async function loadRecents' },
    @{ name = 'renderRecents function'; pattern = 'function renderRecents' },
    @{ name = 'tapRecent function';     pattern = 'function tapRecent' },
    @{ name = 'pushRecent function';    pattern = 'function pushRecent' },
    @{ name = 'submitTypedVIN function';pattern = 'function submitTypedVIN' },
    @{ name = 'unlock loadRecents wire';pattern = 'else loadRecents' },
    @{ name = 'pushRecent in loadSpecs';pattern = 'pushRecent(vin, vehicle)' },
    @{ name = 'currentRecents state';   pattern = 'let currentRecents' }
)
$fail = $false
foreach ($c in $checks) {
    if ($h.Contains($c.pattern)) {
        Write-Host ("  [OK] " + $c.name) -ForegroundColor Green
    } else {
        Write-Host ("  [MISSING] " + $c.name + " — pattern: " + $c.pattern) -ForegroundColor Red
        $fail = $true
    }
}

$s = ReadAll $syncPath
$syncChecks = @(
    @{ name = "RECENTS_KEY const";     pattern = "RECENTS_KEY = 'recents:bay:1'" },
    @{ name = "RECENTS_MAX const";     pattern = "RECENTS_MAX = 10" },
    @{ name = "getRecents action";     pattern = "case 'getRecents'" },
    @{ name = "addRecent action";      pattern = "case 'addRecent'" }
)
foreach ($c in $syncChecks) {
    if ($s.Contains($c.pattern)) {
        Write-Host ("  [OK] " + $c.name) -ForegroundColor Green
    } else {
        Write-Host ("  [MISSING] " + $c.name) -ForegroundColor Red
        $fail = $true
    }
}

if ($fail) {
    Write-Host ""
    Write-Host "VERIFICATION FAILED — restore from backups:" -ForegroundColor Red
    Write-Host ("  Copy-Item '" + $syncBak + "' '" + $syncPath + "' -Force")
    Write-Host ("  Copy-Item '" + $htmlBak + "' '" + $htmlPath + "' -Force")
    exit 1
}

Write-Host ""
Write-Host "All checks passed." -ForegroundColor Green
Write-Host "Deploy with: .\push-pctires.ps1" -ForegroundColor Cyan
