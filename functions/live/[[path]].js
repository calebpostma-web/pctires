// PC Tires Live Scoreboard - Backend
// Serves /live/api/* endpoints via KV storage.
//
// Required binding:
//   SCORE_KV -> a KV namespace (suggested name: PC_TIRES_SCOREBOARD)
//
// Endpoints:
//   GET  /live/api/games                       - list all active games
//   POST /live/api/games                       - create a game
//   GET  /live/api/game/:code                  - get game state
//   POST /live/api/game/:code/claim            - claim scorekeeper role
//   POST /live/api/game/:code/release          - release scorekeeper role
//   POST /live/api/game/:code/action           - apply an action (scorekeeper only)
//   POST /live/api/game/:code/heartbeat        - scorekeeper keep-alive

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
const GAME_TTL_SEC = 30 * 60;                 // 30 min inactivity -> auto-purge
const SCOREKEEPER_TIMEOUT_MS = 5 * 60 * 1000; // 5 min silence -> role opens up

function generateCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*'
    }
  });
}

function cleanName(name, fallback) {
  if (name === undefined || name === null) return fallback;
  const s = String(name).trim().slice(0, 12).toUpperCase();
  return s || fallback;
}

function defaultGame(code, homeName, awayName) {
  const now = Date.now();
  return {
    gameId: code,
    homeName: cleanName(homeName, 'HOME'),
    awayName: cleanName(awayName, 'AWAY'),
    homeScore: 0,
    awayScore: 0,
    homeSets: 0,
    awaySets: 0,
    setNumber: 1,
    format: 5,
    cap: 25,
    server: 'home',
    history: [],
    matchOver: false,
    scorekeeperSessionId: null,
    scorekeeperLastSeen: 0,
    createdAt: now,
    updatedAt: now
  };
}

function canClaim(game) {
  if (!game.scorekeeperSessionId) return true;
  return Date.now() - game.scorekeeperLastSeen > SCOREKEEPER_TIMEOUT_MS;
}

function publicGame(game) {
  const copy = Object.assign({}, game);
  copy.hasScorekeeper = !canClaim(game);
  delete copy.scorekeeperSessionId;
  return copy;
}

async function saveGame(env, game) {
  game.updatedAt = Date.now();
  await env.SCORE_KV.put('game:' + game.gameId, JSON.stringify(game), {
    expirationTtl: GAME_TTL_SEC
  });
}

async function loadGame(env, code) {
  const raw = await env.SCORE_KV.get('game:' + code);
  return raw ? JSON.parse(raw) : null;
}

function checkSetWin(s) {
  const needed = Math.ceil(s.format / 2);
  const isDecider = s.format > 1 && s.homeSets === needed - 1 && s.awaySets === needed - 1;
  const cap = isDecider ? 15 : s.cap;
  let winner = null;
  if (s.homeScore >= cap && s.homeScore - s.awayScore >= 2) winner = 'home';
  if (s.awayScore >= cap && s.awayScore - s.homeScore >= 2) winner = 'away';
  if (!winner) return;
  if (winner === 'home') s.homeSets++;
  else s.awaySets++;
  if (s.homeSets >= needed || s.awaySets >= needed) s.matchOver = true;
}

function applyAction(s, action) {
  switch (action.type) {
    case 'point': {
      if (s.matchOver) return;
      if (action.team === 'home') s.homeScore++;
      else if (action.team === 'away') s.awayScore++;
      else return;
      s.server = action.team;
      s.history.push(action.team);
      checkSetWin(s);
      break;
    }
    case 'undo': {
      if (!s.history.length) return;
      const last = s.history.pop();
      if (last === 'home') s.homeScore = Math.max(0, s.homeScore - 1);
      else s.awayScore = Math.max(0, s.awayScore - 1);
      if (s.history.length) s.server = s.history[s.history.length - 1];
      break;
    }
    case 'subtract': {
      // Manual -1 for a specific team. Removes the most recent occurrence
      // of that team from history to keep the record consistent.
      if (action.team === 'home' && s.homeScore > 0) {
        s.homeScore--;
        for (let i = s.history.length - 1; i >= 0; i--) {
          if (s.history[i] === 'home') { s.history.splice(i, 1); break; }
        }
      } else if (action.team === 'away' && s.awayScore > 0) {
        s.awayScore--;
        for (let j = s.history.length - 1; j >= 0; j--) {
          if (s.history[j] === 'away') { s.history.splice(j, 1); break; }
        }
      } else {
        return;
      }
      if (s.history.length) s.server = s.history[s.history.length - 1];
      break;
    }
    case 'settings': {
      if (action.homeName !== undefined) s.homeName = cleanName(action.homeName, 'HOME');
      if (action.awayName !== undefined) s.awayName = cleanName(action.awayName, 'AWAY');
      if (action.format !== undefined) {
        const f = parseInt(action.format, 10);
        if (f === 1 || f === 3 || f === 5) s.format = f;
      }
      if (action.cap !== undefined) {
        const c = parseInt(action.cap, 10);
        if (c === 21 || c === 25) s.cap = c;
      }
      if (action.server === 'home' || action.server === 'away') s.server = action.server;
      break;
    }
    case 'nextSet': {
      const loserServes = s.homeScore > s.awayScore ? 'away' : 'home';
      s.setNumber++;
      s.homeScore = 0;
      s.awayScore = 0;
      s.history = [];
      s.server = loserServes;
      break;
    }
    case 'reset': {
      s.homeScore = 0;
      s.awayScore = 0;
      s.homeSets = 0;
      s.awaySets = 0;
      s.setNumber = 1;
      s.history = [];
      s.matchOver = false;
      s.server = 'home';
      break;
    }
  }
}

async function readJsonSafe(request) {
  try {
    return await request.json();
  } catch (e) {
    return {};
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (!env.SCORE_KV) {
    return json({ error: 'SCORE_KV binding not configured on this Pages project' }, 500);
  }

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '86400'
      }
    });
  }

  // GET /live/api/games
  if (path === '/live/api/games' && method === 'GET') {
    const list = await env.SCORE_KV.list({ prefix: 'game:' });
    const games = [];
    for (const key of list.keys) {
      const raw = await env.SCORE_KV.get(key.name);
      if (!raw) continue;
      const g = JSON.parse(raw);
      games.push({
        gameId: g.gameId,
        homeName: g.homeName,
        awayName: g.awayName,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        homeSets: g.homeSets,
        awaySets: g.awaySets,
        setNumber: g.setNumber,
        hasScorekeeper: !canClaim(g),
        matchOver: g.matchOver,
        updatedAt: g.updatedAt
      });
    }
    games.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    return json({ games: games });
  }

  // POST /live/api/games
  if (path === '/live/api/games' && method === 'POST') {
    const body = await readJsonSafe(request);
    let code = null;
    for (let i = 0; i < 10; i++) {
      const candidate = generateCode();
      const existing = await env.SCORE_KV.get('game:' + candidate);
      if (!existing) { code = candidate; break; }
    }
    if (!code) return json({ error: 'Could not allocate a unique code, try again' }, 503);
    const game = defaultGame(code, body.homeName, body.awayName);
    await saveGame(env, game);
    return json({ gameId: code, game: publicGame(game) });
  }

  // /live/api/game/:code[/action|/claim|/release|/heartbeat]
  const m = path.match(/^\/live\/api\/game\/([A-Za-z0-9]{4})(\/.*)?$/);
  if (m) {
    const code = m[1].toUpperCase();
    const sub = m[2] || '';
    const game = await loadGame(env, code);
    if (!game) return json({ error: 'Game not found or expired' }, 404);

    if (sub === '' && method === 'GET') {
      return json({ game: publicGame(game) });
    }

    if (sub === '/claim' && method === 'POST') {
      const body = await readJsonSafe(request);
      const sid = body.sessionId;
      if (!sid) return json({ error: 'sessionId required' }, 400);
      if (!canClaim(game) && game.scorekeeperSessionId !== sid) {
        return json({ error: 'Scorekeeper role is taken', game: publicGame(game) }, 409);
      }
      game.scorekeeperSessionId = sid;
      game.scorekeeperLastSeen = Date.now();
      await saveGame(env, game);
      return json({ game: publicGame(game), youAreScorekeeper: true });
    }

    if (sub === '/release' && method === 'POST') {
      const body = await readJsonSafe(request);
      if (game.scorekeeperSessionId !== body.sessionId) {
        return json({ error: 'Not the scorekeeper' }, 403);
      }
      game.scorekeeperSessionId = null;
      game.scorekeeperLastSeen = 0;
      await saveGame(env, game);
      return json({ game: publicGame(game) });
    }

    if (sub === '/action' && method === 'POST') {
      const body = await readJsonSafe(request);
      if (!body.sessionId || game.scorekeeperSessionId !== body.sessionId) {
        return json({ error: 'Not the scorekeeper' }, 403);
      }
      if (Date.now() - game.scorekeeperLastSeen > SCOREKEEPER_TIMEOUT_MS) {
        return json({ error: 'Scorekeeper role expired, please reclaim' }, 403);
      }
      if (!body.action || typeof body.action !== 'object') {
        return json({ error: 'action required' }, 400);
      }
      applyAction(game, body.action);
      game.scorekeeperLastSeen = Date.now();
      await saveGame(env, game);
      return json({ game: publicGame(game) });
    }

    if (sub === '/heartbeat' && method === 'POST') {
      const body = await readJsonSafe(request);
      if (game.scorekeeperSessionId === body.sessionId) {
        game.scorekeeperLastSeen = Date.now();
        await saveGame(env, game);
      }
      return json({ ok: true, game: publicGame(game) });
    }
  }

  return json({ error: 'Not found', path: path }, 404);
}
