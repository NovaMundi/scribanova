// Geeft het resultaat van een achtergrond-analyse terug, of {status:"pending"} als het nog loopt. V2-functie.

import { getStore } from "@netlify/blobs";

export default async (req) => {
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return Response.json({ status: "error", error: "Geen jobId." }, { status: 400 });

  const store = getStore("analyses", { consistency: "strong" });
  let result;
  try {
    result = await store.get(jobId, { type: "json" });
  } catch {
    return Response.json({ status: "pending" });
  }

  if (!result) return Response.json({ status: "pending" });
  return Response.json(result);
};
