// Vitae — blood lab report extraction. Runs server-side so the Anthropic
// API key never reaches the client. Requires a valid Supabase user JWT
// (enforced by the platform by default). Accepts a PDF or a photo of a lab
// report and returns every marker it can read.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const KNOWN_PANELS = ["Lipids", "Metabolic", "Thyroid", "Vitamins & minerals", "Inflammation", "Liver & kidney", "Hormones"];

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

  let file: string, mediaType: string;
  try {
    const body = await req.json();
    file = body.file;
    mediaType = body.mediaType || "image/jpeg";
    if (!file) throw new Error("Missing file");
  } catch {
    return json({ error: "Expected JSON body with a base64 'file' field" }, 400);
  }

  const isPdf = mediaType === "application/pdf";
  const fileBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: file } };

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          fileBlock,
          {
            type: "text",
            text: "You are reading a blood lab report. Extract every marker you can find. For each, group it " +
              `into one of these panels if it fits: ${KNOWN_PANELS.join(", ")}. If a marker doesn't fit any of ` +
              "those, invent a short, sensible panel name for it. For each marker capture: the marker's common " +
              "name, its numeric value, its unit, the reference range low and high as printed (use 0 for low if " +
              "no floor is given, and null for high if no ceiling is given), and the date the panel was drawn if " +
              "printed on the report (YYYY-MM-DD; use null if not found — the caller will default to today). " +
              "Respond with ONLY a compact JSON object, no markdown, in exactly this shape: " +
              '{"takenOn":"2026-05-12","markers":[{"panel":"Lipids","key":"LDL","value":138,"unit":"mg/dL","low":0,"high":130}]}',
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
