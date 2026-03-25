// /functions/claude-proxy.js
// Cloudflare Pages Function — proxies Anthropic API calls for Postma Contracting bookkeeping tools
// Deploy to: calebpostma-web/pctires/functions/claude-proxy.js

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers — restrict to your domains in production if desired
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body = await request.json();
    const { model, max_tokens, messages, beta } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid request — messages array required' }), {
        status: 400, headers: corsHeaders
      });
    }

    // Build headers for Anthropic
    const anthropicHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    };

    // Add beta header if requested (needed for PDF document support)
    if (beta) {
      anthropicHeaders['anthropic-beta'] = beta;
    }

    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: anthropicHeaders,
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: max_tokens || 1000,
        messages,
      }),
    });

    const data = await anthropicResp.json();

    if (!anthropicResp.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'Anthropic API error', detail: data }), {
        status: anthropicResp.status, headers: corsHeaders
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200, headers: corsHeaders
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy error: ' + err.message }), {
      status: 500, headers: corsHeaders
    });
  }
}

// Handle preflight OPTIONS requests
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
