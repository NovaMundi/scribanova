// Achtergrond-worker (V2): krijgt alleen een jobId, leest de invoer uit Blobs, doet de analyse
// (mag tot 15 min duren) en schrijft het resultaat naar Blobs. Env: ANTHROPIC_API_KEY.

import { getStore } from "@netlify/blobs";

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

export default async (req) => {
  let payload = {};
  try { payload = await req.json(); } catch {}
  const jobId = payload.jobId;
  if (!jobId) return new Response("Geen jobId", { status: 400 });

  const store = getStore("analyses", { consistency: "strong" });
  const fail = (error) => store.setJSON(`result:${jobId}`, { status: "error", error });
  const done = () => new Response(null, { status: 202 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { await fail("Server mist de API-sleutel (ANTHROPIC_API_KEY)."); return done(); }

  const input = await store.get(`input:${jobId}`, { type: "json" });
  if (!input || !Array.isArray(input.content)) { await fail("Geen invoer gevonden."); return done(); }

  const content = input.content;
  const model = input.model || "claude-sonnet-4-6";
  const today = /^\d{4}-\d{2}-\d{2}$/.test(input.today || "") ? input.today : new Date().toISOString().slice(0, 10);
  const year = /^\d{4}$/.test(String(input.defYear || "")) ? String(input.defYear) : today.slice(0, 4);

  const body = {
    model,
    max_tokens: 16000,
    system: buildSystem(today, year),
    messages: [{ role: "user", content: [...content, { type: "text", text: "Haal alle afspraken eruit en geef ze terug volgens het schema." }] }],
    output_config: { format: { type: "json_schema", schema: EVENT_SCHEMA } }
  };

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      let detail = `${resp.status}`;
      try { const e = await resp.json(); detail = e.error?.message || detail; } catch {}
      await fail("Analyse mislukt: " + detail);
    } else {
      const data = await resp.json();
      if (data.stop_reason === "refusal") {
        await fail("De analyse is geweigerd voor dit materiaal.");
      } else {
        const textBlock = (data.content || []).find(b => b.type === "text");
        if (!textBlock) {
          await fail("Geen leesbaar antwoord ontvangen.");
        } else {
          let parsed = null;
          try { parsed = JSON.parse(textBlock.text); } catch {}
          if (!parsed) await fail("Antwoord kon niet worden gelezen.");
          else await store.setJSON(`result:${jobId}`, { status: "done", events: parsed.events || [], notes: parsed.notes || "" });
        }
      }
    }
  } catch (e) {
    await fail("Kon de analyse-service niet bereiken.");
  }

  try { await store.delete(`input:${jobId}`); } catch {}
  return done();
};
