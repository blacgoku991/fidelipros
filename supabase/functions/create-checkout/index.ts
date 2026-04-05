import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://fidelipros.lovable.app",
  ...(Deno.env.get("EXTRA_ALLOWED_ORIGINS") || "").split(",").filter(Boolean),
];

function isAllowedOrigin(origin: string) {
  return !!origin && (
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/.*\.lovable\.app$/.test(origin) ||
    /^https:\/\/.*\.lovableproject\.com$/.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)
  );
}

function resolveAllowedOrigin(origin: string) {
  return isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": resolveAllowedOrigin(origin),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

// Fallback Price IDs
const FALLBACK_PLANS: Record<string, string> = {
  starter:    Deno.env.get("STRIPE_PRICE_STARTER")    || "price_1TGQcwFQlLT8Im0J1OI53niu",
  pro:        Deno.env.get("STRIPE_PRICE_PRO")        || "price_1TGQdDFQlLT8Im0J7YQ9OWuG",
  franchise:  Deno.env.get("STRIPE_PRICE_FRANCHISE")  || "",
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

    const VALID_PLANS = ["starter", "pro", "franchise", "enterprise"];
    if (!VALID_PLANS.includes(plan)) throw new Error("Plan invalide");

    const rawOrigin = body?.origin || req.headers.get("origin") || "";
    const origin = resolveAllowedOrigin(rawOrigin);

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

    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("id, subscription_plan, subscription_status, stripe_customer_id, stripe_subscription_id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (businessError) {
      throw new Error("Impossible de récupérer le commerce");
    }

    const businessIsSubscribed = business?.subscription_status === "active" || business?.subscription_status === "trialing";

    // IMPORTANT: never infer an active subscription for a fresh signup from the email alone.
    // We only reuse/inspect Stripe customer data when the current business is already linked to billing.
    let customerId: string | undefined = business?.stripe_customer_id || undefined;

    if (!customerId && businessIsSubscribed && user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    // If this business is already subscribed, allow plan management rules.
    if (customerId && businessIsSubscribed) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const sub = subscriptions.data[0];
        const currentPriceId = sub.items.data[0]?.price?.id;

        const samePlanInDatabase = business?.subscription_plan === plan;

        if (currentPriceId === priceId && samePlanInDatabase) {
          console.log(`[CHECKOUT] Already on this plan, no action needed`);
          return new Response(JSON.stringify({
            updated: true,
            already_active: true,
            message: "Vous êtes déjà abonné à ce plan !"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        // Different plan — cancel old subscription and create new checkout
        // This forces the user through Stripe payment for any plan change
        console.log(`[CHECKOUT] Plan change requested: ${currentPriceId} → ${priceId}, cancelling old sub and creating new checkout`);
        await stripe.subscriptions.update(sub.id, {
          cancel_at_period_end: true,
        });
      }
    }

    // No active subscription for this business (or old one cancelled) — create a new checkout session
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
    const safeMessages = ["Non authentifié", "non spécifié", "invalide", "déjà abonné"];
    const isSafe = safeMessages.some(s => msg.toLowerCase().includes(s.toLowerCase()));
    return new Response(JSON.stringify({ error: isSafe ? msg : "Erreur lors du paiement" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: isSafe ? 400 : 500,
    });
  }
});
