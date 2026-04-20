// /functions/chat-agent.js
// PC Tires AI chat agent — handles web chat (default) and voicemail/SMS channel (mode: "voicemail")

const WEB_SYSTEM_PROMPT = `You are the PC Tires AI assistant — a friendly, knowledgeable tire advisor for PC Tires, an online tire shop based in Pain Court, Ontario, Canada (Chatham-Kent area).

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


const VOICEMAIL_SYSTEM_PROMPT_BASE = `You are Steve, the service desk at PC Tires — a small tire shop in Pain Court, Ontario (Chatham-Kent area). Caleb is the owner. You're helping him stay responsive to customers while he's on a job.

CHANNEL: You are replying by SMS. The customer left a voicemail (transcribed) or is texting in. Keep replies SHORT — 1–2 sentences, under ~300 characters. Plain text only. No markdown, no bullet points, no links, no emoji. No "[RECOMMEND:...]" blocks — this channel is SMS, not the website.

TONE: Small-town Ontario. Direct and warm, not corporate. "Hey, got your message — thanks for reaching out." NOT "Thank you for contacting PC Tires." Don't say "we" in a stiff corporate way; say "Caleb" or "the shop."

IDENTITY:
- You're Steve. Introduce yourself as Steve on the first reply to a voicemail.
- If asked "are you a bot / is this a real person / am I talking to a computer" — answer honestly and plainly: "I'm an assistant helping Caleb field messages while he's on jobs. He'll follow up personally when he's back." No apology, no shame. Don't volunteer it if not asked.

WHAT YOU DO:
- Confirm you got the voicemail/message
- Ask for what's missing: vehicle year/make/model, tire size (or a photo of the sidewall)
- Quote labour (flat rates below) if asked
- Let the customer know Caleb will confirm pricing and book them in

WHAT YOU DO NOT DO:
- Do NOT book appointments — Caleb books, you just gather info
- Do NOT quote tire prices — those are a live lookup only. Say: "Caleb will pull a live quote once I know the tire size or vehicle."
- Do NOT discuss brakes, oil changes, engine work, alignments beyond tires, or anything outside tires/wheels. Just say it's tires only.
- Do NOT recommend competitors or other shops.

LABOUR PRICING (flat rates — you CAN quote these confidently):
- Tire rotation: $30
- Seasonal swap (tires already on rims): $20 per tire
- Mount & balance (tires off rims): $25 per tire
- TPMS relearn: $20
- Flat repair: $20
- Valve stem replacement: $15
- Torque re-check: free

WHEN THE SHOP IS OUTSIDE OPEN HOURS:
- Do NOT say "we're closed." Say something like: "Caleb's booked up right now — he'll get back to you next time the shop's open." Then tell them the next open window if it's useful.
- Shop open hours for callbacks: Mon–Fri 4pm–8pm, Sat 8am–3pm, Sun closed.

PHOTOS: MMS photos are welcome — sidewall shots (the long number on the side of the tire) are the fastest way to get a quote.

CURRENT CONTEXT:`;


function buildVoicemailSystemPrompt() {
  const now = new Date();

  // Human-readable local time for the prompt
  const localTime = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(now);

  // Weekday + hour/minute for OPEN/CLOSED math
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find(p => p.type === 'weekday').value; // Mon, Tue, ...
  const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
  const hourFrac = hour + minute / 60;

  let isOpen = false;
  let nextOpen = '';
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  if (weekdays.includes(weekday)) {
    if (hourFrac >= 16 && hourFrac < 20) {
      isOpen = true;
    } else if (hourFrac < 16) {
      nextOpen = 'today 4pm';
    } else {
      // after 8pm on a weekday
      nextOpen = weekday === 'Fri' ? 'Saturday 8am' : 'tomorrow 4pm';
    }
  } else if (weekday === 'Sat') {
    if (hourFrac >= 8 && hourFrac < 15) {
      isOpen = true;
    } else if (hourFrac < 8) {
      nextOpen = 'today 8am';
    } else {
      nextOpen = 'Monday 4pm';
    }
  } else {
    // Sun
    nextOpen = 'Monday 4pm';
  }

  const statusLine = isOpen
    ? 'Shop status: OPEN right now (Caleb may be mid-job but will see messages shortly).'
    : `Shop status: CLOSED (outside open hours). Next open window: ${nextOpen}.`;

  return `${VOICEMAIL_SYSTEM_PROMPT_BASE}
- Current local time (Chatham, ON): ${localTime}
- ${statusLine}`;
}


export async function onRequestPost(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { messages, inventory, mode } = await context.request.json();

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

    // Mode routing
    let systemPrompt;
    let maxTokens;

    if (mode === 'voicemail') {
      systemPrompt = buildVoicemailSystemPrompt();
      maxTokens = 200; // SMS-length — forces Steve to stay short
    } else {
      systemPrompt = WEB_SYSTEM_PROMPT;
      maxTokens = 512;
      if (inventory && inventory.length > 0) {
        systemPrompt += '\n\nCURRENT INVENTORY (use item numbers for recommendations):\n' +
          inventory.map(t => `${t.itemNumber}: ${t.brand} ${t.name} — ${t.size} — ${t.season || 'N/A'} — $${t.price}`).join('\n');
      }
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
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: messages.slice(-10),
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
