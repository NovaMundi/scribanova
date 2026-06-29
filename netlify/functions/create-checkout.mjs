// Start een Stripe Checkout voor een creditbundel. Vereist een ingelogde gebruiker.
// Env: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const BUNDLES = {
  small: { credits: 10, amount: 695, name: "10 roosterimports" },
  large: { credits: 25, amount: 1295, name: "25 roosterimports" }
};

const json = (statusCode, obj) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(obj)
});

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Alleen POST." });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json(500, { error: "Server mist de Stripe-configuratie." });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: "Server mist de Supabase-configuratie." });
  }

  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Ongeldige aanvraag." }); }

  const bundle = BUNDLES[payload.bundle];
  if (!bundle) return json(400, { error: "Onbekende bundel." });

  const authHeader = event.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return json(401, { error: "Log eerst in om credits te kopen." });

  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return json(401, { error: "Je sessie is verlopen. Log opnieuw in." });
  const user = data.user;

  const base = event.headers.origin || "https://scribanova.com";
  const stripe = new Stripe(stripeKey);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: bundle.amount,
          product_data: { name: bundle.name }
        }
      }],
      customer_email: user.email,
      success_url: base + "/importagenda?betaald=1",
      cancel_url: base + "/importagenda",
      metadata: { user_id: user.id, credits: String(bundle.credits) }
    });
    return json(200, { url: session.url });
  } catch (e) {
    return json(502, { error: "Kon de betaling niet starten." });
  }
};
