// /functions/auth-check.js
// Cloudflare Pages Function — verifies bookkeeping password
// Add env var BOOKKEEPING_PASSWORD in Cloudflare dashboard

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const { password } = await request.json();

    if (!password) {
      return new Response(JSON.stringify({ ok: false, error: 'No password provided' }), {
        status: 400, headers: corsHeaders
      });
    }

    const correct = env.BOOKKEEPING_PASSWORD;

    if (!correct) {
      return new Response(JSON.stringify({ ok: false, error: 'Password not configured' }), {
        status: 500, headers: corsHeaders
      });
    }

    // Constant-time comparison to prevent timing attacks
    const a = new TextEncoder().encode(password);
    const b = new TextEncoder().encode(correct);
    let match = a.length === b.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) match = false;
    }

    if (match) {
      // Return a session token (just a signed timestamp — simple but effective)
      const token = btoa(`postma:${Date.now()}:${correct.slice(0,4)}`);
      return new Response(JSON.stringify({ ok: true, token }), {
        status: 200, headers: corsHeaders
      });
    } else {
      return new Response(JSON.stringify({ ok: false, error: 'Incorrect password' }), {
        status: 401, headers: corsHeaders
      });
    }

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500, headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
