// Vitae — meal photo analysis. Runs server-side so the Anthropic API key
// never reaches the client. Requires a valid Supabase user JWT (enforced by
// the platform by default) so only signed-in users can spend API credits.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY is not configured" }, 500);

  let image: string, mediaType: string;
  try {
    const body = await req.json();
    image = body.image;
    mediaType = body.mediaType || "image/jpeg";
    if (!image) throw new Error("Missing image");
  } catch {
    return json({ error: "Expected JSON body with a base64 'image' field" }, 400);
  }

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          {
            type: "text",
            text: "You are a nutrition estimation assistant. Look at this meal photo and estimate: " +
              "a short dish name, total calories (kcal), protein (g), carbs (g), fat (g), and your " +
              "confidence (0 to 1) in the estimate. Respond with ONLY a compact JSON object, no markdown, " +
              'in exactly this shape: {"name":"Grilled chicken salad","kcal":520,"protein":42,"carbs":24,"fat":22,"confidence":0.85}',
          },
        ],
      }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    return json({ error: `Anthropic API error (${resp.status}): ${errText}` }, 502);
  }

  const data = await resp.json();
  const text = data.content?.[0]?.text ?? "{}";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return json({ error: "Could not parse a JSON result from the model", raw: text }, 502);

  try {
    return json(JSON.parse(match[0]));
  } catch {
    return json({ error: "Model returned malformed JSON", raw: text }, 502);
  }
});
