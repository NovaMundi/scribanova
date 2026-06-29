// Analyse-proxy. Anonieme bezoekers krijgen een paar gratis analyses per IP per dag;
// ingelogde gebruikers betalen met credits (1 per analyse, teruggeboekt als het misgaat).
// Env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "@supabase/supabase-js";

const FREE_LIMIT_PER_DAY = 3;
const ALLOWED_MODELS = new Set(["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"]);

const EVENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          date: { type: "string", description: "Startdatum als YYYY-MM-DD" },
          end_date: { type: "string", description: "Einddatum YYYY-MM-DD, gelijk aan date bij een afspraak op één dag" },
          all_day: { type: "boolean" },
          start_time: { type: "string", description: "HH:MM 24-uurs, leeg bij hele dag" },
          end_time: { type: "string", description: "HH:MM 24-uurs, leeg indien onbekend" },
          location: { type: "string" },
          description: { type: "string" }
        },
        required: ["title", "date", "end_date", "all_day", "start_time", "end_time", "location", "description"]
      }
    },
    notes: { type: "string", description: "Korte opmerkingen of aannames over onduidelijke delen" }
  },
  required: ["events", "notes"]
};

function buildSystem(today, defYear) {
  return "Je bent een assistent die roosters en planningen omzet naar agenda-afspraken. " +
    "Lees de aangeleverde inhoud (afbeelding, document of tekst) en haal er alle losse afspraken/diensten uit. " +
    `Vandaag is ${today}. Als een jaartal ontbreekt, gebruik ${defYear}. ` +
    "Begrijp Nederlandse en Engelse dag- en maandnamen, en formaten als 17-06-2026, 17/6, 'ma 17 jun'. " +
    "Gebruik 24-uurs tijden (HH:MM). Een tijdspanne als '09:00-17:00' wordt start_time en end_time. " +
    "Als er geen tijd staat, zet all_day op true en laat de tijden leeg. " +
    "Voor een afspraak op één dag is end_date gelijk aan date. " +
    "Laat onbekende velden leeg ('') in plaats van te gokken. Verzin geen afspraken die er niet staan.";
}

const json = (statusCode, obj) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(obj)
});

function adminClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Alleen POST." });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(500, { error: "Server mist de API-sleutel (ANTHROPIC_API_KEY)." });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: "Server mist de Supabase-configuratie." });
  }

  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Ongeldige aanvraag." }); }

  const { content, today, defYear } = payload;
  let model = payload.model;
  if (!Array.isArray(content) || content.length === 0) {
    return json(400, { error: "Geen inhoud om te analyseren." });
  }
  if (!ALLOWED_MODELS.has(model)) model = "claude-opus-4-8";

  const db = adminClient();
  const authHeader = event.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  let userId = null;
  if (token) {
    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user) return json(401, { error: "Je sessie is verlopen. Log opnieuw in." });
    userId = data.user.id;
    const { data: balance, error: spendErr } = await db.rpc("spend_credit", { p_user: userId });
    if (spendErr) return json(500, { error: "Kon je credits niet verwerken." });
    if (balance === null) return json(402, { error: "Je hebt geen credits meer. Koop een bundel om door te gaan." });
  } else {
    const ip = (event.headers["x-nf-client-connection-ip"] ||
      (event.headers["x-forwarded-for"] || "").split(",")[0] || "onbekend").trim();
    const { data: count, error: freeErr } = await db.rpc("bump_free_use", { p_ip: ip });
    if (freeErr) return json(500, { error: "Kon het gratis gebruik niet verwerken." });
    if (count > FREE_LIMIT_PER_DAY) {
      return json(402, { error: "Je hebt je gratis analyses voor vandaag gebruikt. Log in en koop credits om door te gaan." });
    }
  }

  const refund = async () => { if (userId) await db.rpc("add_credits", { p_user: userId, p_n: 1 }); };

  const today2 = /^\d{4}-\d{2}-\d{2}$/.test(today || "") ? today : new Date().toISOString().slice(0, 10);
  const year2 = /^\d{4}$/.test(String(defYear || "")) ? String(defYear) : today2.slice(0, 4);

  const body = {
    model,
    max_tokens: 16000,
    system: buildSystem(today2, year2),
    messages: [{ role: "user", content: [...content, { type: "text", text: "Haal alle afspraken eruit en geef ze terug volgens het schema." }] }],
    output_config: { format: { type: "json_schema", schema: EVENT_SCHEMA } }
  };

  let resp;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body)
    });
  } catch {
    await refund();
    return json(502, { error: "Kon de analyse-service niet bereiken." });
  }

  if (!resp.ok) {
    await refund();
    let detail = `${resp.status}`;
    try { const e = await resp.json(); detail = e.error?.message || detail; } catch {}
    return json(502, { error: "Analyse mislukt: " + detail });
  }

  const data = await resp.json();
  if (data.stop_reason === "refusal") { await refund(); return json(422, { error: "De analyse is geweigerd voor dit materiaal." }); }

  const textBlock = (data.content || []).find(b => b.type === "text");
  if (!textBlock) { await refund(); return json(502, { error: "Geen leesbaar antwoord ontvangen." }); }

  let parsed;
  try { parsed = JSON.parse(textBlock.text); }
  catch { await refund(); return json(502, { error: "Antwoord kon niet worden gelezen." }); }

  let remaining = null;
  if (userId) {
    const { data: row } = await db.from("credits").select("balance").eq("user_id", userId).single();
    remaining = row?.balance ?? null;
  }

  return json(200, { events: parsed.events || [], notes: parsed.notes || "", credits: remaining });
};
