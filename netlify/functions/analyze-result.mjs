// Geeft het resultaat van een achtergrond-analyse terug, of {status:"pending"} als het nog loopt.

import { getStore } from "@netlify/blobs";

const json = (statusCode, obj) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(obj)
});

export const handler = async (event) => {
  const jobId = event.queryStringParameters?.jobId;
  if (!jobId) return json(400, { status: "error", error: "Geen jobId." });

  const store = getStore("analyses");
  let result;
  try {
    result = await store.get(jobId, { type: "json", consistency: "strong" });
  } catch {
    return json(200, { status: "pending" });
  }

  if (!result) return json(200, { status: "pending" });
  return json(200, result);
};
