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

const PRODUCT_TO_PLAN: Record<string, string> = {
  prod_UEuRDMQSWVTnoL: "starter",
  prod_UEuSxVTVVLAifJ: "pro",
};

// Also resolve plan from site_settings (for dynamically created Stripe products like franchise)
async function resolveProductPlan(supabaseAdmin: any, productId: string, metadataPlan: string | undefined): Promise<string> {
  // 1. Check hardcoded map
  if (PRODUCT_TO_PLAN[productId]) return PRODUCT_TO_PLAN[productId];
  // 2. Check metadata (with whitelist validation)
  const validPlans = ["starter", "pro", "franchise", "enterprise"];
  if (metadataPlan && validPlans.includes(metadataPlan)) return metadataPlan;
  if (metadataPlan && !validPlans.includes(metadataPlan)) {
    console.warn(`[CHECK-SUB] Invalid plan in metadata: ${metadataPlan}, ignoring`);
  }
  // 3. Check site_settings for franchise product
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("key, value")
    .in("key", ["stripe_product_starter", "stripe_product_pro", "stripe_product_franchise"]);
  if (data) {
    for (const row of data) {
      if (row.value === productId) {
        return row.key.replace("stripe_product_", "");
      }
    }
  }
  return "starter";
}

const log = (step: string, details?: any) =>
  console.log(`[CHECK-SUB] ${step}${details ? ` — ${JSON.stringify(details)}` : ""}`);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user?.email) throw new Error("Auth failed");

    const user = userData.user;
    log("User authenticated", { email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Read session_id from body (optional)
    let sessionId: string | null = null;
    try {
      const body = await req.json();
      sessionId = body?.session_id ?? null;
    } catch { /* no body */ }

    let customerId: string | null = null;
    let activeSub: Stripe.Subscription | null = null;
    let plan: string | null = null;

    // Path 1: resolve via checkout session_id (with ownership validation)
    if (sessionId) {
      log("Looking up checkout session", { sessionId });
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ["subscription"],
        });
        // Validate that this session belongs to the authenticated user
        const sessionEmail = session.customer_email || session.customer_details?.email;
        if (sessionEmail && sessionEmail !== user.email) {
          log("Session email mismatch — rejecting", { sessionEmail, userEmail: user.email });
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 403,
          });
        }
        customerId = session.customer as string | null;
        const sub = session.subscription as Stripe.Subscription | null;
        if (sub && (sub.status === "active" || sub.status === "trialing")) {
          activeSub = sub;
          const productId = sub.items.data[0]?.price?.product as string;
          plan = await resolveProductPlan(supabaseAdmin, productId, sub.metadata?.plan);
          log("Active sub via session", { subId: sub.id, plan, status: sub.status });
        }
      } catch (err) {
        log("Session lookup failed", { err: String(err) });
      }
    }

    // Path 2: lookup by customer email
    if (!activeSub) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length === 0) {
        log("No Stripe customer found");
        return new Response(JSON.stringify({ subscribed: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      customerId = customers.data[0].id;
      log("Found customer", { customerId });

      const [activeSubs, trialSubs] = await Promise.all([
        stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 }),
        stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 1 }),
      ]);

      const allSubs = [...activeSubs.data, ...trialSubs.data];
      if (allSubs.length > 0) {
        activeSub = allSubs[0];
        const productId = activeSub.items.data[0]?.price?.product as string;
        plan = await resolveProductPlan(supabaseAdmin, productId, activeSub.metadata?.plan);
        log("Active sub via customer", { subId: activeSub.id, plan, status: activeSub.status });
      }
    }

    // If active subscription found → sync DB
    if (activeSub && customerId) {
      const { data: bizData } = await supabaseAdmin
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (bizData) {
        const franchiseFields = plan === "franchise"
          ? { is_franchise: true, max_locations: 5 }
          : {};
        const { error: updateErr } = await supabaseAdmin.from("businesses").update({
          subscription_status: activeSub.status === "trialing" ? "trialing" : "active",
          subscription_plan: plan,
          stripe_customer_id: customerId,
          stripe_subscription_id: activeSub.id,
          ...franchiseFields,
        }).eq("id", bizData.id);

        if (updateErr) log("DB update error", { err: updateErr.message });
        else log("DB synced", { plan, status: activeSub.status });
      }

      const subscriptionEnd = new Date(activeSub.current_period_end * 1000).toISOString();
      return new Response(JSON.stringify({
        subscribed: true,
        active: true,
        plan,
        subscription_end: subscriptionEnd,
        stripe_subscription_id: activeSub.id,
        stripe_status: activeSub.status,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check past_due
    if (customerId) {
      const pastDueSubs = await stripe.subscriptions.list({
        customer: customerId, status: "past_due", limit: 1,
      });
      if (pastDueSubs.data.length > 0) {
        const sub = pastDueSubs.data[0];
        const productId = sub.items.data[0]?.price?.product as string;
        const pastPlan = await resolveProductPlan(supabaseAdmin, productId, sub.metadata?.plan);

        const { data: bizData } = await supabaseAdmin
          .from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
        if (bizData) {
          await supabaseAdmin.from("businesses").update({
            subscription_status: "past_due",
            stripe_customer_id: customerId,
            stripe_subscription_id: sub.id,
          }).eq("id", bizData.id);
        }
        log("Subscription past_due");
        return new Response(JSON.stringify({ subscribed: false, stripe_status: "past_due", plan: pastPlan }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    log("No active subscription");
    return new Response(JSON.stringify({ subscribed: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: msg });
    const safeMessages = ["No auth header", "Auth failed", "STRIPE_SECRET_KEY not set"];
    const isSafe = safeMessages.some(s => msg.includes(s));
    return new Response(JSON.stringify({ error: isSafe ? msg : "Internal error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: isSafe ? 400 : 500,
    });
  }
});
