// Start-functie (gewoon, V2): ontvangt het rooster (tot 6MB), zet de invoer in Blobs,
// en start de achtergrond-worker met alleen de jobId (kleine payload, onder de 256KB-limiet).
// Env: ANTHROPIC_API_KEY, IMPORTAGENDA_PASSWORD.

import { getStore } from "@netlify/blobs";

const ALLOWED_MODELS = new Set(["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"]);

export default async (req) => {
  if (req.method !== "POST") return new Response("Alleen POST", { status: 405 });

  let payload = {};
  try { payload = await req.json(); } catch { return Response.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }

  const jobId = payload.jobId;
  if (!jobId) return Response.json({ error: "Geen jobId." }, { status: 400 });

  const key = process.env.ANTHROPIC_API_KEY;
  const gate = process.env.IMPORTAGENDA_PASSWORD;
  if (!key) return Response.json({ error: "Server mist de API-sleutel (ANTHROPIC_API_KEY)." }, { status: 500 });
  if (!gate) return Response.json({ error: "Server mist de toegangscode (IMPORTAGENDA_PASSWORD)." }, { status: 500 });
  if (payload.password !== gate) return Response.json({ error: "Onjuiste toegangscode." }, { status: 401 });

  const content = payload.content;
  if (!Array.isArray(content) || content.length === 0) return Response.json({ error: "Geen inhoud om te analyseren." }, { status: 400 });

  let model = payload.model;
  if (!ALLOWED_MODELS.has(model)) model = "claude-sonnet-4-6";

  const store = getStore("analyses", { consistency: "strong" });
  await store.setJSON(`input:${jobId}`, { model, today: payload.today, defYear: payload.defYear, content });

  const origin = new URL(req.url).origin;
  try {
    await fetch(`${origin}/.netlify/functions/analyze-background`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId })
    });
  } catch {
    return Response.json({ error: "Kon de analyse niet starten." }, { status: 502 });
  }

  return Response.json({ started: true });
};
