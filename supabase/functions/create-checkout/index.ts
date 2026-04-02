import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://fidelipros.lovable.app",
  ...(Deno.env.get("EXTRA_ALLOWED_ORIGINS") || "").split(",").filter(Boolean),
];
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

// Fallback Price IDs
const FALLBACK_PLANS: Record<string, string> = {
  starter:    Deno.env.get("STRIPE_PRICE_STARTER")    || "price_1TGQcwFQlLT8Im0J1OI53niu",
  pro:        Deno.env.get("STRIPE_PRICE_PRO")        || "price_1TGQdDFQlLT8Im0J7YQ9OWuG",
  enterprise: Deno.env.get("STRIPE_PRICE_ENTERPRISE") || "price_1TGQdVFQlLT8Im0JMB3Y4hmT",
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non authentifié");

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !data.user?.email) throw new Error("Utilisateur non authentifié");
    const user = data.user;

    const body = await req.json();
    const plan = body?.plan;
    if (!plan || typeof plan !== "string") throw new Error("Plan non spécifié");

    const rawOrigin = body?.origin || req.headers.get("origin") || "";
    const origin = ALLOWED_ORIGINS.includes(rawOrigin) ? rawOrigin : ALLOWED_ORIGINS[0];

    // Read Price ID from site_settings first
    const { data: settingRow } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", `stripe_price_${plan}`)
      .maybeSingle();

    const priceId = (settingRow?.value && settingRow.value.trim())
      ? settingRow.value.trim()
      : FALLBACK_PLANS[plan];

    if (!priceId) throw new Error(`Plan invalide: ${plan}`);

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Find existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Check if user has an active subscription — if so, update it directly (plan switch)
    if (customerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const sub = subscriptions.data[0];
        const currentPriceId = sub.items.data[0]?.price?.id;

        if (currentPriceId === priceId) {
          throw new Error("Vous êtes déjà abonné à ce plan");
        }

        console.log(`[CHECKOUT] Scheduling plan switch: ${currentPriceId} → ${priceId} for sub ${sub.id} at period end`);

        // Schedule the plan change at the end of the current billing period
        const updated = await stripe.subscriptions.update(sub.id, {
          items: [{ id: sub.items.data[0].id, price: priceId }],
          proration_behavior: "none",
          billing_cycle_anchor: "unchanged",
          metadata: { user_id: user.id, plan },
        });

        // Calculate when the current period ends
        const periodEnd = new Date(sub.current_period_end * 1000).toLocaleDateString("fr-FR");

        console.log(`[CHECKOUT] Plan switch scheduled for ${periodEnd}, sub: ${updated.id}`);

        return new Response(JSON.stringify({ 
          updated: true, 
          scheduled: true,
          plan,
          period_end: periodEnd,
          message: `Votre plan passera à ${plan} le ${periodEnd}` 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // No active subscription — create a new checkout session
    console.log(`[CHECKOUT] Creating session for plan=${plan}, priceId=${priceId}, email=${user.email}`);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/dashboard/checkout?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/checkout?plan=${plan}`,
      payment_method_types: ["card"],
      subscription_data: {
        metadata: { user_id: user.id, plan },
      },
      metadata: { user_id: user.id, plan },
    });

    console.log(`[CHECKOUT] Session created: ${session.id}`);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[CHECKOUT] Error: ${msg}`);
    const isUserError = msg.includes("non authentifié") || msg.includes("non spécifié") || msg.includes("invalide") || msg.includes("déjà abonné");
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: isUserError ? 400 : 500,
    });
  }
});
