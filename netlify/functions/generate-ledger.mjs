// Serverless: the Living Ledger. Turns one sentence OR a live website
// into a small bespoke brand kit using Claude. When a URL is given we
// fetch the page and ground every recommendation in what the site
// actually says, with visible reasoning. Falls back gracefully
// (returns non-200) so the client uses its local generator instead.
//
// Env: ANTHROPIC_API_KEY = Anthropic key (shared with the agenda tool).

const KIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    source:  { type: "string", description: "Cleaned 2-5 word label of the business" },
    observations: {
      type: "array",
      description: "Only when a website was provided: exactly 3 observations grounded in the site text. Otherwise an empty array.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          quote:   { type: "string", description: "A short literal phrase or fact taken from their site, under 12 words" },
          insight: { type: "string", description: "What this tells us and what to do about it, under 20 words, no em-dash" }
        },
        required: ["quote", "insight"]
      }
    },
    tagline: { type: "string", description: "One punchy tagline, under 9 words, no em-dash" },
    taglineWhy: { type: "string", description: "One sentence explaining why this tagline fits THIS business, referencing their site or wording where possible, under 22 words, no em-dash" },
    voice:   { type: "array", items: { type: "string" }, description: "Exactly 3 short brand-voice descriptors, 2-4 words each" },
    voiceWhy: { type: "string", description: "One sentence on why this voice suits their audience, under 20 words, no em-dash" },
    palette: { type: "string", description: "A two-word palette name" },
    swatches:{ type: "array", items: { type: "string" }, description: "Exactly 4 hex color codes suited to the business" },
    paletteWhy: { type: "string", description: "One sentence on why these colors fit, referencing their current look or sector, under 20 words, no em-dash" },
    audience: { type: "array", items: { type: "string" }, description: "Exactly 2 sharp observations about who the real customer is and what they actually buy, each under 16 words" },
    heroLine: { type: "string", description: "One landing-page opening headline for this business, under 10 words, no em-dash" },
    heroWhy: { type: "string", description: "One sentence on why this opener beats what they have now, under 20 words, no em-dash" },
    ad: {
      type: "object",
      additionalProperties: false,
      properties: {
        headline: { type: "string", description: "A sample ad headline, under 8 words" },
        body: { type: "string", description: "Sample ad body copy, 1-2 sentences, under 25 words, no em-dash" }
      },
      required: ["headline", "body"]
    },
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
    },
    moves: {
      type: "array",
      description: "Exactly 3 concrete first marketing moves",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          move: { type: "string", description: "The move, imperative voice, under 14 words, no em-dash" },
          why:  { type: "string", description: "Why this move first, for this business, under 16 words, no em-dash" }
        },
        required: ["move", "why"]
      }
    }
  },
  required: ["source", "observations", "tagline", "taglineWhy", "voice", "voiceWhy", "palette", "swatches", "paletteWhy", "audience", "heroLine", "heroWhy", "ad", "frames", "moves"]
};

const SYSTEM =
  "You are Scriba Nova, a premium studio that turns one brief into marketing and product. " +
  "Draft a compact, tasteful, genuinely useful starter brand kit. " +
  "Be specific, confident, and warm. Concrete beats clever: name their customer, their objection, their channel. " +
  "Every recommendation carries a short reason. Reasons must be specific to THIS business, never generic filler. " +
  "If website text is provided, ground everything in it: quote their own words in observations, respect what the brand clearly stands for, and improve rather than replace what already works. " +
  "If their current positioning is strong, say so in the observations and build on it. " +
  "Never use em-dashes. Avoid buzzwords like leverage, seamless, unlock, revolutionize, cutting-edge, next-level, elevate, empower. " +
  "Pick four hex colors that genuinely suit this specific business. If their site already has a clear palette, harmonize with it rather than fight it. " +
  "The moves must be doable this month by a small team. Keep every line short. Return only the structured object.";

const json = (statusCode, obj) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(obj)
});

/* ── Site fetching (SSRF-guarded, size-capped) ─────────────── */
function normalizeUrl(raw) {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  let parsed;
  try { parsed = new URL(u); } catch { return null; }
  if (!/^https?:$/.test(parsed.protocol)) return null;
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) && (
      host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.startsWith("169.254.") || host === "0.0.0.0"
    ) || host === "[::1]"
  ) return null;
  if (!host.includes(".")) return null;
  return parsed.toString();
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#\d+;|&\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(re, html) {
  const m = html.match(re);
  return m ? stripTags(m[1]).slice(0, 200) : "";
}

async function readSite(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6500);
  let resp;
  try {
    resp = await fetch(url, {
      signal: ctl.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; ScribaNovaLedger/1.0; +https://scribanova.com)" }
    });
  } finally { clearTimeout(t); }
  if (!resp.ok) throw new Error("status " + resp.status);
  const type = (resp.headers.get("content-type") || "").toLowerCase();
  if (!type.includes("html")) throw new Error("not html");

  // Size-capped read
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let html = "";
  while (html.length < 400000) {
    const { done, value } = await reader.read();
    if (done) break;
    html += dec.decode(value, { stream: true });
  }
  try { reader.cancel(); } catch {}

  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  const desc  = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i, html) ||
                pick(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i, html);
  const headings = [];
  const hre = /<h([12])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let hm;
  while ((hm = hre.exec(html)) && headings.length < 8) {
    const t2 = stripTags(hm[2]);
    if (t2) headings.push(t2.slice(0, 120));
  }
  const bodyText = stripTags(html).slice(0, 1800);
  return { title, desc, headings, bodyText };
}

/* ── Handler ───────────────────────────────────────────────── */
export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json(503, { error: "no key" });

  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "bad request" }); }

  const rawUrl = (payload.url || "").toString().trim().slice(0, 200);
  let prompt = (payload.prompt || "").toString().trim().slice(0, 160);

  let userText;
  let mode = "idea";
  let siteHost = "";

  if (rawUrl) {
    const safe = normalizeUrl(rawUrl);
    if (!safe) return json(400, { error: "bad url" });
    let site;
    try { site = await readSite(safe); }
    catch { return json(422, { error: "unreachable" }); }
    if (!site.title && !site.bodyText) return json(422, { error: "empty site" });
    mode = "site";
    siteHost = new URL(safe).hostname.replace(/^www\./, "");
    userText =
      "Their website (" + siteHost + ") says:\n" +
      "Title: " + (site.title || "(none)") + "\n" +
      "Description: " + (site.desc || "(none)") + "\n" +
      "Headings: " + (site.headings.join(" | ") || "(none)") + "\n" +
      "Page text: " + site.bodyText + "\n\n" +
      "Ground every recommendation and every reason in this material. Quote their own words in the observations. Draft the brand kit.";
  } else {
    if (prompt.length < 3) return json(400, { error: "too short" });
    userText = "Business: " + prompt + "\n\nNo website was provided, so the observations array must be empty. Draft the brand kit.";
  }

  const body = {
    model: "claude-haiku-4-5",
    max_tokens: 1600,
    temperature: 0.8,
    system: SYSTEM,
    messages: [{ role: "user", content: [{ type: "text", text: userText }] }],
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

  const kit = {
    mode,
    source: (parsed.source || siteHost || prompt).toString().slice(0, 60),
    observations: Array.isArray(parsed.observations)
      ? parsed.observations.slice(0, 3).map(o => ({ quote: String(o.quote || ""), insight: String(o.insight || "") })).filter(o => o.quote || o.insight)
      : [],
    tagline: (parsed.tagline || "").toString(),
    taglineWhy: (parsed.taglineWhy || "").toString(),
    voice: Array.isArray(parsed.voice) ? parsed.voice.slice(0, 3).map(String) : [],
    voiceWhy: (parsed.voiceWhy || "").toString(),
    palette: (parsed.palette || "Bespoke").toString(),
    swatches: Array.isArray(parsed.swatches) ? parsed.swatches.slice(0, 4).map(String) : [],
    paletteWhy: (parsed.paletteWhy || "").toString(),
    audience: Array.isArray(parsed.audience) ? parsed.audience.slice(0, 2).map(String) : [],
    heroLine: (parsed.heroLine || "").toString(),
    heroWhy: (parsed.heroWhy || "").toString(),
    ad: parsed.ad && typeof parsed.ad === "object" ? { headline: String(parsed.ad.headline || ""), body: String(parsed.ad.body || "") } : null,
    frames: Array.isArray(parsed.frames) ? parsed.frames.slice(0, 3).map(f => ({ tag: String(f.tag || ""), line: String(f.line || "") })) : [],
    moves: Array.isArray(parsed.moves) ? parsed.moves.slice(0, 3).map(m => ({ move: String(m.move || m || ""), why: String(m.why || "") })) : []
  };

  if (!kit.tagline || kit.swatches.length < 4 || kit.frames.length < 3) return json(502, { error: "incomplete" });

  return json(200, kit);
};
