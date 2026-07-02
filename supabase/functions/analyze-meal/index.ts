// Vitae — meal photo analysis. Runs server-side so the Anthropic API key
// never reaches the client. Requires a valid Supabase user JWT (enforced by
// the platform by default) so only signed-in users can spend API credits.
//
// Two modes, both returning the same JSON shape:
//  - Initial analysis: body has `image` (+ optional `mediaType`). Claude reads
//    the photo cold and guesses everything, including cooking method and
//    piece/serving count — the two details a photo alone often can't nail
//    (e.g. breaded-and-fried vs. air-fried, or how many chops are on the plate).
//  - Correction: body has `corrections` (user-confirmed facts the model got
//    wrong or couldn't see) and `previous` (the prior estimate). Claude
//    recalculates kcal/macros from those confirmed facts instead of the user
//    hand-adjusting numbers. `image` is optional here — if the client still
//    has it (mid-review, pre-save) it's included for extra context; if the
//    meal was already saved and the photo is gone, correction still works
//    from the dish name + prior estimate + corrected facts alone.

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

const RESPONSE_SHAPE =
  '{"name":"Grilled chicken salad","cooking_method":"grilled","quantity":1,"kcal":520,"protein":42,"carbs":24,"fat":22,"confidence":0.85}';

function buildPrompt(corrections: Record<string, unknown> | undefined, previous: Record<string, unknown> | undefined, hasImage: boolean) {
  if (!corrections) {
    return "You are a nutrition estimation assistant. Look at this meal photo and estimate: a short dish name, " +
      "the apparent cooking method (e.g. grilled, air-fried, pan-fried, deep-fried, breaded & fried, baked, roasted, " +
      "steamed, boiled, raw), the count of discrete items/pieces on the plate if the food is countable (e.g. number " +
      "of chops, wings, dumplings — use 1 if not applicable), total calories (kcal) for everything on the plate, " +
      "protein (g), carbs (g), fat (g), and your confidence (0 to 1) in the overall estimate. Cooking method is " +
      "often ambiguous from a photo alone (breaded-and-fried can look a lot like air-fried) — give your best guess " +
      "but keep confidence honest about it. Respond with ONLY a compact JSON object, no markdown, in exactly this " +
      `shape: ${RESPONSE_SHAPE}`;
  }

  const facts: string[] = [];
  if (corrections.name) facts.push(`dish name is "${corrections.name}"`);
  if (corrections.cookingMethod) facts.push(`it was cooked ${corrections.cookingMethod}`);
  if (corrections.quantity != null && corrections.quantity !== "") facts.push(`there are ${corrections.quantity} piece(s)/serving(s)`);

  const prevLine = previous
    ? `Your (or a prior) estimate was: ${JSON.stringify(previous)}. `
    : "";

  return "You are a nutrition estimation assistant helping correct a meal log. " + prevLine +
    "The user, who can see the actual plate, has now confirmed these facts which you should treat as ground truth " +
    `and use to recalculate, even if they override what a photo alone would suggest: ${facts.join("; ") || "no changes"}. ` +
    (hasImage ? "The original photo is attached again for portion-size context. " : "No photo is available this time — use your general nutrition knowledge for a typical serving of this dish. ") +
    "Recalculate total calories (kcal), protein (g), carbs (g) and fat (g) to reflect the corrected facts (for " +
    "example, air-fried is meaningfully lower-fat than breaded-and-deep-fried, and calories/macros should scale " +
    "with the corrected piece count). Respond with ONLY a compact JSON object, no markdown, in exactly this shape " +
    `(echo back the corrected cooking_method and quantity): ${RESPONSE_SHAPE}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY is not configured" }, 500);

  let image: string | undefined, mediaType: string, corrections: Record<string, unknown> | undefined, previous: Record<string, unknown> | undefined;
  try {
    const body = await req.json();
    image = body.image || undefined;
    mediaType = body.mediaType || "image/jpeg";
    corrections = body.corrections || undefined;
    previous = body.previous || undefined;
    if (!image && !corrections) throw new Error("Expected an 'image' for analysis or 'corrections' for a recalculation");
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Expected a JSON body with an 'image' or 'corrections' field" }, 400);
  }

  const content: unknown[] = [];
  if (image) content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: image } });
  content.push({ type: "text", text: buildPrompt(corrections, previous, Boolean(image)) });

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
      messages: [{ role: "user", content }],
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
