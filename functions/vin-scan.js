export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();

    // Support both single image (legacy) and multiple images
    let images = body.images;
    if (!images && body.imageData) {
      images = [{ imageData: body.imageData, mediaType: body.mediaType || 'image/jpeg' }];
    }

    if (!images || !images.length) {
      return new Response(JSON.stringify({ error: 'No image data provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hasTireImage = images.length >= 2;
    const content = [];

    // Add image(s)
    for (const img of images) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mediaType || 'image/jpeg',
          data: img.imageData,
        },
      });
    }

    // Build prompt
    let prompt;
    if (hasTireImage) {
      prompt = `You have two images:
Image 1: A VIN sticker or VIN number on a vehicle.
Image 2: A tire sidewall showing the tire size.

Task:
1. Extract the VIN from Image 1. A VIN is exactly 17 characters using only letters A-H, J-N, P-Z and digits 0-9 (no I, O, or Q).
2. Extract the tire size from Image 2 (format like 275/50R22 or P285/45R22 or LT265/70R17).

Respond with ONLY a JSON object, no other text:
{"vin":"XXXXXXXXXXXXXXXXX","tireSize":"275/50R22"}

If you cannot find the VIN, use null for vin. If you cannot read the tire size, use null for tireSize.`;
    } else {
      prompt = `Find the VIN (Vehicle Identification Number) in this image. A VIN is exactly 17 characters, using only letters A-H, J-N, P-Z and digits 0-9 (no I, O, or Q).

Respond with ONLY a JSON object, no other text:
{"vin":"XXXXXXXXXXXXXXXXX"}

If you cannot find a VIN, respond with: {"vin":null}`;
    }

    content.push({ type: 'text', text: prompt });

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 200,
        messages: [{ role: 'user', content }],
      }),
    });

    const data = await anthropicRes.json();
    const rawText = (data.content?.[0]?.text || '').trim();

    let vin = null;
    let tireSize = null;

    try {
      const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
      const rawVin = (parsed.vin || '').toString().toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
      vin = rawVin.length === 17 ? rawVin : null;
      tireSize = parsed.tireSize || null;
    } catch {
      const clean = rawText.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
      vin = clean.length === 17 ? clean : null;
    }

    return new Response(JSON.stringify({ vin, tireSize: tireSize || null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
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
