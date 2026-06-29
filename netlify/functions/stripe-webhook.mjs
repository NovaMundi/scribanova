// Stripe-webhook: schrijft credits bij zodra een betaling gelukt is.
// Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Zet in Stripe een endpoint naar /.netlify/functions/stripe-webhook voor 'checkout.session.completed'.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Alleen POST." };

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !whSecret) return { statusCode: 500, body: "Configuratie ontbreekt." };

  const stripe = new Stripe(stripeKey);
  const sig = event.headers["stripe-signature"];
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body;

  let evt;
  try {
    evt = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch (e) {
    return { statusCode: 400, body: `Webhook-fout: ${e.message}` };
  }

  if (evt.type === "checkout.session.completed") {
    const s = evt.data.object;
    const userId = s.metadata?.user_id;
    const credits = parseInt(s.metadata?.credits || "0", 10);

    if (userId && credits > 0) {
      const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      // Idempotent: dezelfde sessie schrijft maar één keer credits bij (webhook kan opnieuw geleverd worden).
      const { error: insErr } = await db.from("purchases").insert({
        stripe_session_id: s.id,
        user_id: userId,
        credits,
        amount: s.amount_total
      });
      if (!insErr) {
        await db.rpc("add_credits", { p_user: userId, p_n: credits });
      }
    }
  }

  return { statusCode: 200, body: "ok" };
};
