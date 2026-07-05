// Serverless: the Living Ledger. Turns one sentence into a tiny bespoke
// brand kit using Claude. Public marketing toy, so it is rate-light and
// cheap: short output, fast model, strict schema. Falls back gracefully
// (returns non-200) so the client uses its local generator instead.
//
// Env: ANTHROPIC_API_KEY = Anthropic key (shared with the agenda tool).

const KIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    source:  { type: "string", description: "Cleaned 2-5 word label of the business" },
    tagline: { type: "string", description: "One punchy tagline, under 9 words, no em-dash" },
    voice:   { type: "array", items: { type: "string" }, description: "Exactly 3 short brand-voice descriptors, 2-4 words each" },
    palette: { type: "string", description: "A two-word palette name" },
    swatches:{ type: "array", items: { type: "string" }, description: "Exactly 4 hex color codes suited to the business" },
    frames:  {
      type: "array",
      description: "Exactly 3 campaign concept frames",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          tag:  { type: "string", description: "One word: Hook, Proof, or Call" },
          line: { type: "string", description: "Short ad line, under 12 words, no em-dash" }
        },
        required: ["tag", "line"]
      }
    }
  },
  required: ["source", "tagline", "voice", "palette", "swatches", "frames"]
};

const SYSTEM =
  "You are Scriba Nova, a premium studio that turns one brief into marketing and product. " +
  "A visitor describes their business in one sentence. Draft a tiny, tasteful, bespoke brand kit for it. " +
  "Be specific to their business, confident, and warm. Never use em-dashes. Avoid buzzwords like leverage, seamless, unlock, revolutionize, cutting-edge, next-level. " +
  "Pick four hex colors that genuinely suit the business. Keep every line short. Return only the structured object.";

const json = (statusCode, obj) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(obj)
});

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json(503, { error: "no key" });

  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "bad request" }); }

  let prompt = (payload.prompt || "").toString().trim().slice(0, 160);
  if (prompt.length < 3) return json(400, { error: "too short" });

  const body = {
    model: "claude-haiku-4-5",
    max_tokens: 700,
    temperature: 0.85,
    system: SYSTEM,
    messages: [{ role: "user", content: [{ type: "text", text: "Business: " + prompt + "\n\nDraft the brand kit." }] }],
    output_config: { format: { type: "json_schema", schema: KIT_SCHEMA } }
  };

  let resp;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body)
    });
  } catch (e) {
    return json(502, { error: "upstream unreachable" });
  }

  if (!resp.ok) return json(502, { error: "upstream " + resp.status });

  const data = await resp.json();
  if (data.stop_reason === "refusal") return json(422, { error: "refused" });

  const textBlock = (data.content || []).find(b => b.type === "text");
  if (!textBlock) return json(502, { error: "no text" });

  let parsed;
  try { parsed = JSON.parse(textBlock.text); }
  catch { return json(502, { error: "unparseable" }); }

  // Normalize to what the client expects
  const kit = {
    source: (parsed.source || prompt).toString().slice(0, 60),
    tagline: (parsed.tagline || "").toString(),
    voice: Array.isArray(parsed.voice) ? parsed.voice.slice(0, 3).map(String) : [],
    palette: (parsed.palette || "Bespoke").toString(),
    swatches: Array.isArray(parsed.swatches) ? parsed.swatches.slice(0, 4).map(String) : [],
    frames: Array.isArray(parsed.frames) ? parsed.frames.slice(0, 3).map(f => ({ tag: String(f.tag || ""), line: String(f.line || "") })) : []
  };

  if (!kit.tagline || kit.swatches.length < 4 || kit.frames.length < 3) return json(502, { error: "incomplete" });

  return json(200, kit);
};
