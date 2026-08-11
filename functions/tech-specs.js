// /functions/tech-specs.js
// Cloudflare Pages Function — AI-generated tech specs with safety-first prompting
// Returns torque (as fallback only — prefer verified DB), TPMS freq, cold pressure
//
// POST /tech-specs with { year, make, model, trim }
// Returns { torque, tpms, pressure, source: 'ai', confidence: ... }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.ANTHROPIC_API_KEY) {
    return json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const { year, make, model, trim } = body;
  if (!year || !make || !model) {
    return json({ ok: false, error: 'Missing year/make/model' }, 400);
  }

  // Strict, safety-first prompt. Tell Claude explicitly:
  // - Torque is life-safety; null-out if uncertain
  // - Return JSON only, no commentary
  // - Don't invent specs for variants/trims you don't know

  const prompt = `You are a reference for a tire shop. ACCURACY IS SAFETY-CRITICAL. A wrong torque value can cause a wheel to come off at highway speed.

Vehicle: ${year} ${make} ${model}${trim ? ' ' + trim : ''}

Return ONLY this JSON object, nothing else:
{
  "torque_ftlb": <number or null>,
  "torque_confidence": "<high | medium | low | unknown>",
  "torque_pattern": "<e.g. '5-lug star' or null>",
  "tpms_freq_mhz": <315 | 433 | null>,
  "tpms_relearn": "<OBD | auto | stationary | unknown>",
  "cold_pressure_front_psi": <number or null>,
  "cold_pressure_rear_psi": <number or null>,
  "lug_thread": "<e.g. 'M12x1.5' or '1/2-20' or null>",
  "lug_hex_mm": <17 | 19 | 21 | 22 | null>,
  "lug_seat": "<conical | ball | mag | flat | unknown>",
  "lug_type": "<nut | bolt | unknown>",
  "oe_tire_size": "<e.g. '225/65R17' or 'LT265/70R17' or null>",
  "notes": "<short caveat or empty string>"
}

Rules:
- If you are not certain about torque for this exact year/trim combination, return null for torque_ftlb. Never guess.
- North American passenger vehicles (2005+) are almost always 315 MHz TPMS. European and some luxury/performance vehicles are 433 MHz.
- Cold pressure: the door jamb sticker is the final authority. Return typical OEM spec if widely known, else null.
- For relearn: OBD = requires scan tool, auto = drives 15-20min, stationary = manual procedure.
- Lug hardware: thread like 'M12x1.5', 'M14x1.5', '1/2-20', '9/16-18'. Seat: conical (most Asian/domestic), ball (VW/Audi/Mercedes/Porsche, Honda OEM alloys), mag = flat-washer/shank style (Toyota trucks, many Toyota OEM alloys). Type: bolt for most German vehicles, nut otherwise. If not certain, return null/unknown. Never guess thread size.
- oe_tire_size: the most common factory tire size for this vehicle, in standard
  metric form. This one is NOT safety-critical -- it feeds a stocking report, not
  a torque wrench -- but still return null rather than invent a size you don't
  know. If the vehicle shipped in several sizes, give the highest-volume one and
  say so in notes.
- "notes" should flag known quirks (e.g. "Some trims use 18in wheels with different pressure", "Dual pattern 6x135, 6x139.7").
- JSON only. No markdown fences, no prose before or after.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const rawText = (data.content?.[0]?.text || '').trim();

    let parsed;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      return json({
        ok: false,
        error: 'AI returned unparseable response',
        raw: rawText.slice(0, 500),
      }, 502);
    }

    // Sanity-check torque range. Under 40 or over 250 ft-lb for a passenger vehicle is suspect;
    // null it out defensively rather than display a bad value.
    let torqueFtlb = parsed.torque_ftlb;
    let torqueWarn = null;
    if (torqueFtlb != null) {
      const n = Number(torqueFtlb);
      if (!isFinite(n) || n < 40 || n > 250) {
        torqueFtlb = null;
        torqueWarn = `AI returned out-of-range value (${parsed.torque_ftlb}). Blocked.`;
      } else {
        torqueFtlb = Math.round(n);
      }
    }

    return json({
      ok: true,
      source: 'ai',
      torque: {
        ftlb: torqueFtlb,
        confidence: parsed.torque_confidence || 'unknown',
        pattern: parsed.torque_pattern || null,
        warn: torqueWarn,
      },
      // Factory size, used to seed the VIN scan log so the stocking report has
      // something even when nobody photographs a sidewall. Shape-checked here so
      // a hallucinated string can never reach the log.
      oeTireSize: (function (v) {
        const t = String(v || '').toUpperCase().replace(/\s+/g, '');
        return /^[A-Z]{0,2}[\d.]+([X/][\d.]+)?Z?R[\d.]+/.test(t) ? t : null;
      })(parsed.oe_tire_size),
      tpms: {
        freqMhz: parsed.tpms_freq_mhz || null,
        relearn: parsed.tpms_relearn || 'unknown',
      },
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
      notes: parsed.notes || '',
    });

  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
