// /functions/reel-ai.js
// Cloudflare Pages Function — Claude helpers for the Reel Builder (/video).
//   action "highlights": contact sheets of frames from a long clip → suggested segments to keep
//   action "copy":       one-line description → on-screen caption + Instagram/Facebook/Google post text
// Gated with the tech-portal token (same one /video and /tech store in localStorage), so the API
// key can't be spent by anyone who finds the URL. Uses env.ANTHROPIC_API_KEY and env.TECH_PASSWORD.

const MODEL = 'claude-sonnet-4-20250514';   // same model the chat agent uses; change here if it's retired

const BUSINESS = `PC Tires — online tire and wheel sales with local installation. Shop at 7144 Grande River Line, Pain Court, ON (Chatham-Kent). Phone/text 519-397-4686. Website pctires.ca. Services: seasonal changeovers, new tires, tire repair, wheel alignment, balancing and rotation, TPMS service. Canadian spelling (tire is spelled "tire" here, colour/centre otherwise).`;

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

function tokenOk(token, env) {
  try {
    if (!token || !env.TECH_PASSWORD) return false;
    const parts = atob(token).split(':');
    return parts[0] === 'pctech' && parts[2] === env.TECH_PASSWORD.slice(0, 4);
  } catch (e) { return false; }
}

async function askClaude(env, system, content, maxTokens) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || ('Anthropic API error ' + r.status));
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

function parseJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Model did not return JSON');
  return JSON.parse(m[0]);
}

const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'Bad JSON' }, 400); }
  if (!tokenOk(body.token, env)) return json({ ok: false, error: 'Not signed in — reload /video and enter the tech password.' }, 401);
  if (!env.ANTHROPIC_API_KEY) return json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' }, 500);

  try {
    if (body.action === 'highlights') {
      const { sheets, hint, duration, target } = body;
      if (!Array.isArray(sheets) || !sheets.length) return json({ ok: false, error: 'No frames' }, 400);
      if (sheets.length > 10) return json({ ok: false, error: 'Too many sheets' }, 400);
      const want = Math.max(10, Math.min(90, Number(target) || 30));

      const system = `You pick highlights for short vertical social videos (Instagram Reels / Facebook / TikTok) for a tire shop. ${BUSINESS}
You are shown contact sheets: grids of frames sampled from ONE continuous video, in reading order (left to right, top to bottom). Every tile has its timestamp (m:ss) printed in its top-left corner, and the exact list of tile times is given in the text. Pick the moments that make satisfying, watchable footage: hands-on action (wheel coming off, tire mounting, balancing, torque wrench, lift going up, before/after), clear views of the vehicle and shop, faces engaged with the work. Avoid tiles that are dark, blurry, empty floor, people standing around, or the camera pointed at nothing.
Return ONLY JSON, no prose: {"segments":[{"start":<seconds>,"end":<seconds>,"label":"<3-6 words>"}],"note":"<one sentence>"}
Rules: 3 to 8 segments; each 2 to 8 seconds; total about ${want} seconds; chronological; non-overlapping; start/end are seconds from the beginning of the video (use the tile time as the start unless the action clearly begins earlier); never exceed the video length (${Math.round(duration || 0)} s).`;

      const content = [];
      sheets.forEach((s, i) => {
        content.push({ type: 'text', text: `Sheet ${i + 1} of ${sheets.length}. Tile times in reading order: ${(s.times || []).map(fmt).join(', ')}.` });
        content.push({ type: 'image', source: { type: 'base64', media_type: s.mediaType || 'image/jpeg', data: s.data } });
      });
      content.push({ type: 'text', text: `The video is ${Math.round(duration || 0)} seconds long. What it's about: ${hint || 'a tire shop job'}. Target total ${want} seconds. Return the JSON now.` });

      const text = await askClaude(env, system, content, 1200);
      const out = parseJSON(text);
      const dur = Number(duration) || Infinity;
      let segs = (out.segments || []).map(s => ({ start: Number(s.start), end: Number(s.end), label: String(s.label || '').slice(0, 60) }))
        .filter(s => isFinite(s.start) && isFinite(s.end) && s.end > s.start)
        .map(s => ({ ...s, start: Math.max(0, s.start), end: Math.min(dur, s.start + Math.min(8, Math.max(2, s.end - s.start))) }))
        .filter(s => s.end - s.start >= 1.5)
        .sort((a, b) => a.start - b.start);
      // drop overlaps
      const clean = [];
      for (const s of segs) { if (!clean.length || s.start >= clean[clean.length - 1].end) clean.push(s); }
      return json({ ok: true, segments: clean.slice(0, 8), note: String(out.note || '').slice(0, 200) });
    }

    if (body.action === 'copy') {
      const about = String(body.about || '').slice(0, 500).trim();
      if (!about) return json({ ok: false, error: 'Tell me what the video is about' }, 400);
      const system = `You write social media copy for a small-town tire shop. ${BUSINESS}
Voice: plain, friendly, confident, a little dry; no corporate fluff, no exclamation-mark pileups, no emojis except at most one. Canadian spelling. Never invent prices, promotions, or claims that were not given. Return ONLY JSON:
{"caption":"<on-screen caption, 3-7 words, no hashtags, no punctuation at the end>",
 "instagram":"<1-3 short lines, then a line of 6-10 hashtags mixing local (#ChathamKent #PainCourt #CKOnt) and topical>",
 "facebook":"<2-4 sentences, conversational, ends with how to book: pctires.ca or 519-397-4686, no hashtags>",
 "gbp":"<Google Business Profile post, 1-3 sentences, plain, includes one clear call to action, no hashtags>"}`;
      const text = await askClaude(env, system, [{ type: 'text', text: `The video: ${about}` }], 800);
      const out = parseJSON(text);
      return json({ ok: true, caption: String(out.caption || '').slice(0, 80), instagram: String(out.instagram || ''), facebook: String(out.facebook || ''), gbp: String(out.gbp || '') });
    }

    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ ok: false, error: err.message || String(err) }, 502);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
