// Serverless proxy: houdt de Anthropic-sleutel verborgen en doet alleen rooster-analyse.
// Persoonlijke versie, beveiligd met een gedeelde toegangscode (geen accounts, geen credits).
// Omgevingsvariabelen in Netlify:
//   ANTHROPIC_API_KEY     = je Anthropic-sleutel (verplicht)
//   IMPORTAGENDA_PASSWORD = gedeelde toegangscode (verplicht; zonder dit weigert de functie)

const ALLOWED_MODELS = new Set([
  "claude-opus-4-8",
  "claude-sonnet-4-6",
  "claude-haiku-4-5"
]);

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

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Alleen POST." });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json(500, { error: "Server mist de API-sleutel (ANTHROPIC_API_KEY)." });

  const gate = process.env.IMPORTAGENDA_PASSWORD;
  if (!gate) return json(500, { error: "Server mist de toegangscode (IMPORTAGENDA_PASSWORD)." });

  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Ongeldige aanvraag." }); }

  if (payload.password !== gate) return json(401, { error: "Onjuiste toegangscode." });

  const { content, today, defYear } = payload;
  let model = payload.model;
  if (!Array.isArray(content) || content.length === 0) {
    return json(400, { error: "Geen inhoud om te analyseren." });
  }
  if (!ALLOWED_MODELS.has(model)) model = "claude-opus-4-8";

  const safeToday = /^\d{4}-\d{2}-\d{2}$/.test(today || "") ? today : new Date().toISOString().slice(0, 10);
  const safeYear = /^\d{4}$/.test(String(defYear || "")) ? String(defYear) : safeToday.slice(0, 4);

  const body = {
    model,
    max_tokens: 16000,
    system: buildSystem(safeToday, safeYear),
    messages: [{ role: "user", content: [...content, { type: "text", text: "Haal alle afspraken eruit en geef ze terug volgens het schema." }] }],
    output_config: { format: { type: "json_schema", schema: EVENT_SCHEMA } }
  };

  let resp;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });
  } catch (e) {
    return json(502, { error: "Kon de analyse-service niet bereiken." });
  }

  if (!resp.ok) {
    let detail = `${resp.status}`;
    try { const e = await resp.json(); detail = e.error?.message || detail; } catch {}
    return json(502, { error: "Analyse mislukt: " + detail });
  }

  const data = await resp.json();
  if (data.stop_reason === "refusal") return json(422, { error: "De analyse is geweigerd voor dit materiaal." });

  const textBlock = (data.content || []).find(b => b.type === "text");
  if (!textBlock) return json(502, { error: "Geen leesbaar antwoord ontvangen." });

  let parsed;
  try { parsed = JSON.parse(textBlock.text); }
  catch { return json(502, { error: "Antwoord kon niet worden gelezen." }); }

  return json(200, { events: parsed.events || [], notes: parsed.notes || "" });
};
