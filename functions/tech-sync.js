// /functions/tech-sync.js
// Cloudflare Pages Function — phone ↔ TV sync, vehicle notes, verified torque DB
// Requires KV binding: TECH_KV (create namespace "PC_TIRES_TECH" in Cloudflare dashboard,
// then bind it to this Pages project as variable name TECH_KV)
//
// POST /tech-sync with JSON body { action, ... }

import { findTorque as halderman } from './tech-torque-db.js';
import { findOverlay } from './tech-torque-overlay-2022-2026.js';
import { findCorrection } from './tech-torque-corrections.js';
import { classifyVehicle } from './tech-vehicle-type.js';
import { findLug } from './tech-lugnut-db.js';
import { findRelearn } from './tech-relearn-db.js';


//
// Actions:
//   push       — phone writes latest scan to KV (overwrites bay slot)
//   pull       — TV reads latest scan
//   clear      — clear the bay (tech done with vehicle)
//   getNotes   — pull all notes for a VIN
//   addNote    — append a note to a VIN
//   getTorque  — read verified torque entry for a vehicle (year/make/model)
//   saveTorque — mark a torque value as verified (promotes AI → verified)
//   listTorque — list all verified torque entries (for admin view)

const BAY_KEY = 'scan:bay:1';
const BAY_TTL = 60 * 60 * 24; // 24h — auto-clears if forgotten overnight
const RECENTS_KEY = 'recents:bay:1';
const RECENTS_MAX = 10;

const NOTE_PREFIX = 'notes:vin:';
const TORQUE_PREFIX = 'torque:verified:';

// Permanent VIN scan log. One entry per vehicle per DAY -- re-scanning the same
// truck twice in an afternoon is one job, not two, so the demand counts stay honest.
// Key: vinlog:<YYYY-MM-DD>:<VIN>. Lexicographic order == chronological order.
// The whole entry also goes in KV metadata so the report can be built from a
// single list() call instead of one get() per scan.
const VINLOG_PREFIX = 'vinlog:';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS });
}

// ── AUTH ────────────────────────────────────────────────────────────────────
// This endpoint used to accept any POST from anywhere: the tech password gated
// the tech.html UI, but not the data behind it, so a stranger could read the
// bay's recent VINs and -- worse -- write to the verified torque DB. Now every
// action needs the token /tech-auth issues.
//
// Token shape (set by tech-auth.js): btoa("pctech:<issued-ms>:<first 4 chars of
// TECH_PASSWORD>"). Rotating TECH_PASSWORD invalidates every existing token.
// It is a weak scheme -- unsigned, and it leaks a 4-char password prefix to
// anyone holding a token -- but validating it here is a large improvement over
// no check at all. Worth replacing with a signed token later.
function techTokenOk(token, env) {
  if (!token || !env.TECH_PASSWORD) return false;
  let decoded;
  try { decoded = atob(String(token)); } catch (e) { return false; }
  const parts = decoded.split(':');
  if (parts.length !== 3 || parts[0] !== 'pctech') return false;
  const a = new TextEncoder().encode(parts[2]);
  const b = new TextEncoder().encode(String(env.TECH_PASSWORD).slice(0, 4));
  let match = a.length === b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) match = false;
  }
  return match;
}

function bearerFrom(request, body) {
  const h = request.headers.get('Authorization') || '';
  if (h.slice(0, 7).toLowerCase() === 'bearer ') return h.slice(7).trim();
  return (body && body.token) || '';
}

// YYYY-MM-DD in America/Toronto, so "today" matches the shop's day, not UTC's.
function shopDate(ms) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ms));
}

// Normalise a sidewall size for counting: strip spaces, upper-case, drop the
// P/LT service prefix so P225/65R17 and 225/65R17 are one bucket.
function normSize(raw) {
  const s = String(raw || '').toUpperCase().replace(/\s+/g, '');
  if (!s) return '';
  if (!/^[A-Z]{0,2}[\d.]+([X/][\d.]+)?Z?R[\d.]+/.test(s)) return '';
  return s.replace(/^(P|LT|C)(?=\d)/, '');
}

function normTorqueKey({ make, model, year }) {
  const m = (make || '').trim().toLowerCase().replace(/\s+/g, '-');
  const mo = (model || '').trim().toLowerCase().replace(/\s+/g, '-');
  const y = Number(year) || 0;
  return `${TORQUE_PREFIX}${m}:${mo}:${y}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.TECH_KV) {
    return json({ ok: false, error: 'TECH_KV namespace not bound. Create KV namespace PC_TIRES_TECH and bind as TECH_KV in Pages → Settings → Functions.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const action = body.action;

  // Fail closed. tech.html attaches the token to every /tech-sync call.
  if (!techTokenOk(bearerFrom(request, body), env)) {
    return json({ ok: false, error: 'Not authorised — sign in on the tech page again.' }, 401);
  }

  try {
    switch (action) {

      // ── PHONE → TV SYNC ─────────────────────────────────────────────
      case 'push': {
        if (!body.scan) return json({ ok: false, error: 'Missing scan data' }, 400);
        const payload = {
          ...body.scan,
          ts: Date.now(),
        };
        await env.TECH_KV.put(BAY_KEY, JSON.stringify(payload), {
          expirationTtl: BAY_TTL,
        });
        return json({ ok: true, ts: payload.ts });
      }

      case 'pull': {
        const raw = await env.TECH_KV.get(BAY_KEY);
        if (!raw) return json({ ok: true, scan: null });
        return json({ ok: true, scan: JSON.parse(raw) });
      }

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
          tireSize: normSize(entry.tireSize) || null,
          ts: Date.now(),
        });
        if (recents.length > RECENTS_MAX) recents.length = RECENTS_MAX;
        await env.TECH_KV.put(RECENTS_KEY, JSON.stringify(recents));
        return json({ ok: true, recents });
      }

      // ── NOTES PER VIN ────────────────────────────────────────────────
      case 'getNotes': {
        const vin = (body.vin || '').toUpperCase().trim();
        if (!vin) return json({ ok: true, notes: [] });
        const raw = await env.TECH_KV.get(NOTE_PREFIX + vin);
        return json({ ok: true, notes: raw ? JSON.parse(raw) : [] });
      }

      case 'addNote': {
        const vin = (body.vin || '').toUpperCase().trim();
        const text = (body.text || '').trim();
        if (!vin || !text) return json({ ok: false, error: 'Missing vin or text' }, 400);

        const raw = await env.TECH_KV.get(NOTE_PREFIX + vin);
        const notes = raw ? JSON.parse(raw) : [];
        notes.unshift({
          ts: Date.now(),
          text,
          author: body.author || 'Tech',
        });
        // Cap at 50 notes per vehicle
        if (notes.length > 50) notes.length = 50;
        await env.TECH_KV.put(NOTE_PREFIX + vin, JSON.stringify(notes));
        return json({ ok: true, notes });
      }

      // ── VERIFIED TORQUE DATABASE ─────────────────────────────────────
      case 'getTorque': {
        // Lookup order:
        //   1. KV verified override (shop-confirmed, highest trust)
        //   2. 2022-2026 Overlay (current-year manufacturer data)
        //   3. Corrections (fixes known Halderman platform-swap errors, 1995-2021)
        //   4. Halderman 1995-2021 published DB (with vehicleType hint to fix
        //      catchall tier ordering for truck-platform SUVs)
        //   5. Null (client falls back to AI via /tech-specs)

        // Lug hardware spec + TPMS relearn steps ride along on every getTorque response
        const lug = findLug({ year: body.year, make: body.make, model: body.model });
        const relearn = findRelearn({ year: body.year, make: body.make, model: body.model });

        const key = normTorqueKey(body);
        const raw = await env.TECH_KV.get(key);
        if (raw) {
          const entry = JSON.parse(raw);
          return json({ ok: true, torque: { ...entry, source: 'verified' }, lug, relearn });
        }

        // Classify once up front. Used by Halderman to reorder catchall tiers.
        // Overlay and Corrections are exact-match, so they don't need the hint.
        const vehicleType = classifyVehicle({ make: body.make, model: body.model });

        // Try 2022-2026 overlay first (authoritative manufacturer data)
        const o = findOverlay({ year: body.year, make: body.make, model: body.model });
        if (o) {
          return json({
            ok: true,
            torque: {
              ftlb: o.ftlb,
              source: 'published',
              note: o.note,
              matchTier: o.matchTier,
              reference: `${o.sourceTag} · ${o.entry.make} ${o.entry.model} ${o.entry.yearFrom}-${o.entry.yearTo}`,
              vehicleType,
            },
            lug,
            relearn,
          });
        }

        // Try corrections overlay (fixes to Halderman 1995-2021 data)
        const c = findCorrection({ year: body.year, make: body.make, model: body.model });
        if (c) {
          return json({
            ok: true,
            torque: {
              ftlb: c.ftlb,
              source: 'published',
              note: c.note,
              matchTier: c.matchTier,
              reference: `${c.sourceTag} · ${c.entry.make} ${c.entry.model} ${c.entry.yearFrom}-${c.entry.yearTo}`,
              vehicleType,
            },
            lug,
            relearn,
          });
        }

        // Fall back to Halderman for 1995-2021 — pass vehicleType hint so
        // truck-platform SUVs (Escalade, Yukon, etc.) hit the truck catchall
        // at 140 ft-lb instead of the car catchall at 100 ft-lb.
        const h = halderman({ year: body.year, make: body.make, model: body.model, vehicleType });
        if (h) {
          return json({
            ok: true,
            torque: {
              ftlb: h.ftlb,
              source: 'published',
              raw: h.raw,
              flags: h.flags,
              matchTier: h.matchTier,
              reference: `Halderman ${h.entry.yearFrom}-${h.entry.yearTo} · ${h.entry.make} ${h.entry.model}`,
              vehicleType,
            },
            lug,
            relearn,
          });
        }

        return json({ ok: true, torque: null, lug, relearn });
      }

      case 'saveTorque': {
        const key = normTorqueKey(body);
        const ftlb = Number(body.ftlb);
        if (!ftlb || ftlb < 20 || ftlb > 300) {
          return json({ ok: false, error: 'Torque value out of sane range (20-300 ft-lb)' }, 400);
        }
        const entry = {
          ftlb,
          pattern: body.pattern || null,
          source: 'verified',
          verifiedBy: body.author || 'Tech',
          ts: Date.now(),
          // optional: where this was confirmed from
          verifiedFrom: body.verifiedFrom || 'shop manual',
        };
        await env.TECH_KV.put(key, JSON.stringify(entry));
        return json({ ok: true, entry });
      }

      case 'listTorque': {
        const list = await env.TECH_KV.list({ prefix: TORQUE_PREFIX, limit: 1000 });
        const entries = [];
        for (const k of list.keys) {
          const raw = await env.TECH_KV.get(k.name);
          if (raw) {
            const parts = k.name.slice(TORQUE_PREFIX.length).split(':');
            entries.push({
              make: parts[0],
              model: parts[1],
              year: Number(parts[2]),
              ...JSON.parse(raw),
            });
          }
        }
        entries.sort((a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || a.year - b.year);
        return json({ ok: true, entries });
      }


      // ── PERMANENT VIN SCAN LOG ──────────────────────────────────────
      // The rolling `recents` list above is a 10-item scratchpad that
      // de-dupes by VIN, so it forgets. This is the durable record: what
      // rolled through the bay, and what size it was actually wearing.
      case 'logScan': {
        const e = body.entry || {};
        const vin = String(e.vin || '').toUpperCase().trim();
        if (!vin) return json({ ok: false, error: 'Missing entry.vin' }, 400);

        const now = Date.now();
        const veh = e.vehicle || {};
        const size = normSize(e.tireSize);
        const rec = {
          vin,
          year: veh.year || null,
          make: veh.make || '',
          model: veh.model || '',
          trim: veh.trim || '',
          size: size || null,
          // 'confirmed' = a human typed or corrected it. 'oe' = looked up from
          // the vehicle. Confirmed always wins, so the report can weight it.
          sizeSource: size ? (e.sizeSource || 'oe') : null,
          ts: now,
        };

        const key = VINLOG_PREFIX + shopDate(now) + ':' + vin;
        const prior = await env.TECH_KV.get(key, { type: 'json' });
        if (prior) {
          rec.ts = prior.ts || now;                       // keep first-seen time
          if (!rec.size && prior.size) {                  // don't lose a known size
            rec.size = prior.size; rec.sizeSource = prior.sizeSource;
          }
          if (prior.sizeSource === 'confirmed' && rec.sizeSource !== 'confirmed') {
            rec.size = prior.size; rec.sizeSource = prior.sizeSource;
          }
        }

        // The entry rides in KV metadata as well as the value, so sizeReport can
        // read everything from list() alone -- no get() per scan.
        await env.TECH_KV.put(key, JSON.stringify(rec), { metadata: rec });
        return json({ ok: true, entry: rec });
      }

      // Raw log, newest first. `limit` caps the rows returned.
      case 'getVinLog': {
        const limit = Math.min(Math.max(parseInt(body.limit, 10) || 200, 1), 2000);
        const { rows, truncated } = await listVinLog(env, body.from, body.to);
        rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        return json({ ok: true, total: rows.length, truncated, scans: rows.slice(0, limit) });
      }

      // What sizes are actually coming through the door.
      case 'sizeReport': {
        const { rows, truncated } = await listVinLog(env, body.from, body.to);
        const sizes = new Map(), makes = new Map();
        let known = 0, unknown = 0, confirmed = 0;
        for (const r of rows) {
          const mk = (r.make || 'Unknown');
          makes.set(mk, (makes.get(mk) || 0) + 1);
          if (r.size) {
            known++;
            if (r.sizeSource === 'confirmed') confirmed++;
            const cur = sizes.get(r.size) || { size: r.size, count: 0, confirmed: 0 };
            cur.count++;
            if (r.sizeSource === 'confirmed') cur.confirmed++;
            sizes.set(r.size, cur);
          } else {
            unknown++;
          }
        }
        const bySize = [...sizes.values()].sort((a, b) => b.count - a.count || a.size.localeCompare(b.size));
        const byMake = [...makes.entries()].map(([make, count]) => ({ make, count }))
          .sort((a, b) => b.count - a.count || a.make.localeCompare(b.make));
        const dates = rows.map(r => r.date).filter(Boolean).sort();
        return json({
          ok: true,
          truncated,
          scans: rows.length,
          withSize: known,
          withoutSize: unknown,
          confirmedSizes: confirmed,
          firstDate: dates[0] || null,
          lastDate: dates[dates.length - 1] || null,
          bySize,
          byMake,
        });
      }

      default:
        return json({ ok: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

// Walk the whole vinlog prefix. Entries come back from KV metadata, so this is
// one list() round-trip per 1000 scans rather than one get() per scan.
// Caps at 20 pages (20k scans) -- far beyond a one-bay shop, but it stops a
// runaway key space from hanging the report. `truncated` is surfaced, never silent.
async function listVinLog(env, from, to) {
  const lo = from || '0000-00-00';
  const hi = to || '9999-99-99';
  const rows = [];
  let cursor = undefined, truncated = false;
  for (let page = 0; ; page++) {
    if (page >= 20) { truncated = true; break; }
    const res = await env.TECH_KV.list({ prefix: VINLOG_PREFIX, cursor, limit: 1000 });
    for (const k of res.keys) {
      const date = k.name.slice(VINLOG_PREFIX.length, VINLOG_PREFIX.length + 10);
      if (date < lo || date > hi) continue;
      if (k.metadata) rows.push({ ...k.metadata, date });
    }
    if (res.list_complete) break;
    cursor = res.cursor;
  }
  return { rows, truncated };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}