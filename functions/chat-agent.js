// /functions/chat-agent.js
// PC Tires AI chat agent — proxies to Anthropic API server-side

const SYSTEM_PROMPT = `You are the PC Tires AI assistant — a friendly, knowledgeable tire advisor for PC Tires, an online tire shop based in Pain Court, Ontario, Canada (Chatham-Kent area).

ABOUT PC TIRES:
- Address: 7144 Grande River Line, Pain Court, ON N0P 1Z0
- Phone: 519-380-5104
- Hours: Mon–Fri 8am–5:30pm, Sat 8am–4pm, Sunday closed
- We're a local family operation — Caleb and his sons
- Installation: $25/tire — customers buy online, we install locally
- Member discount: 10% off retail for registered members
- We sell tires AND wheels with free rim/tire compatibility checking

TIRE SEASONS FOR ONTARIO:
- Summer tires: Best grip above 7°C. NOT safe for Ontario winters.
- All-Season: Decent year-round in mild weather. Handles light snow but not real Ontario winters.
- All-Weather: Carry the snowflake symbol (3PMSF). True year-round including Canadian winters. Great for drivers who want one set.
- Winter/Snow: Best for ice and snow below 7°C. Ontario strongly recommends Nov–April. Many insurers offer discounts.

HOW TO READ A TIRE SIZE (e.g. 205/55R16 91H):
- 205 = width in mm, 55 = aspect ratio, R = radial, 16 = rim diameter in inches
- 91 = load index, H = speed rating

COMMON OEM SIZES:
- Honda Civic: 205/55R16 or 215/50R17
- Honda CR-V: 235/60R18
- Toyota Corolla: 205/55R16
- Toyota RAV4: 225/65R17 or 235/55R18
- Ford F-150: 265/70R17 or 275/55R20
- Ford Escape: 235/55R17
- Chevrolet Silverado: 265/70R17 or 275/55R20
- Chevrolet Equinox: 225/65R17
- Dodge Ram 1500: 265/70R17 or 275/60R20
- Jeep Grand Cherokee: 265/60R18
- Hyundai Elantra: 205/55R16
- Hyundai Tucson: 235/60R17 or 235/55R18
- Mazda3: 205/60R16 or 215/45R18
- Mazda CX-5: 225/65R17 or 225/55R19
- Kia Sportage: 235/55R18
- Nissan Rogue: 225/65R17 or 235/55R18
- Subaru Outback: 225/60R17 or 225/55R18

RULES:
- Keep responses brief and helpful — 2–4 sentences is ideal
- Always mention $25/tire installation when relevant
- For complex fitment questions, suggest calling 519-380-5104
- Be specific about Ontario winters — recommend winter or all-weather
- Don't make up prices — tell them to check the site for current pricing
- You're friendly, direct, and knowledgeable — not corporate or robotic
- If a customer asks something outside tire/wheel scope, politely redirect

RECOMMENDING PRODUCTS:
When you want to point the customer to specific tires from inventory, add this exact block at the END of your message (nothing after it):
[RECOMMEND:{"items":["ITEMNUMBER1","ITEMNUMBER2","ITEMNUMBER3"]}]
Only use item numbers from the inventory provided. Max 3 recommendations.`;

export async function onRequestPost(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { messages, inventory } = await context.request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = context.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build system prompt with current inventory context
    let systemPrompt = SYSTEM_PROMPT;
    if (inventory && inventory.length > 0) {
      systemPrompt += '\n\nCURRENT INVENTORY (use item numbers for recommendations):\n' +
        inventory.map(t => `${t.itemNumber}: ${t.brand} ${t.name} — ${t.size} — ${t.season || 'N/A'} — $${t.price}`).join('\n');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        system: systemPrompt,
        messages: messages.slice(-10), // Last 10 messages for context
      }),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Internal error', detail: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
