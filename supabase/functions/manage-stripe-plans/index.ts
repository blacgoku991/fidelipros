import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://fidelipros.lovable.app",
  "https://fidelipro.com",
  "https://www.fidelipro.com",
  ...(Deno.env.get("EXTRA_ALLOWED_ORIGINS") || "").split(",").filter(Boolean),
];
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    console.log("[manage-stripe-plans] START — method:", req.method);

    // ── Auth : vérifier que l'appelant est super_admin ─────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    console.log("[manage-stripe-plans] token présent:", !!token, "longueur:", token.length);
    if (!token) throw new Error("Non authentifié — token manquant");

    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    console.log("[manage-stripe-plans] getUser error:", authErr?.message ?? null, "user_id:", userData?.user?.id ?? null);
    if (authErr || !userData?.user) throw new Error("Non authentifié");

    const { data: roleRow, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "super_admin")
      .maybeSingle();
    console.log("[manage-stripe-plans] roleRow:", JSON.stringify(roleRow), "roleErr:", roleErr?.message ?? null);
    if (roleRow?.role !== "super_admin") throw new Error("Accès réservé aux super admins");

    // ── Stripe ─────────────────────────────────────────────────────────
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    console.log("[manage-stripe-plans] STRIPE_SECRET_KEY présent:", !!stripeKey);
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY non configuré dans les secrets Supabase");

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    const body = await req.json();
    const { action } = body;
    const VALID_ACTIONS = ["create_products", "update_price", "sync_subscription"];
    if (!action || !VALID_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ error: "Action invalide" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    console.log("[manage-stripe-plans] action reçue:", action);

    // ── Lire les settings actuels ──────────────────────────────────────
    const { data: rows, error: settingsErr } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", [
        "plan_starter_name", "plan_starter_price",
        "plan_pro_name",     "plan_pro_price",
        "plan_franchise_name", "plan_franchise_price",
        "stripe_product_starter", "stripe_product_pro", "stripe_product_franchise",
        "stripe_price_starter",   "stripe_price_pro",   "stripe_price_franchise",
      ]);

    console.log("[manage-stripe-plans] site_settings lues:", rows?.length ?? 0, "rows, settingsErr:", settingsErr?.message ?? null);
    if (settingsErr) throw new Error(`Erreur lecture site_settings: ${settingsErr.message}`);

    const cfg: Record<string, string> = {};
    rows?.forEach(r => { cfg[r.key] = r.value; });

    const upsertSetting = async (key: string, value: string) => {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key, value }, { onConflict: "key" });
      if (error) throw new Error(`Erreur upsert ${key}: ${error.message}`);
    };

    // ── ACTION : créer les produits et prix Stripe ─────────────────────
    if (action === "create_products") {
      const results: Record<string, string> = {};

      const defaultPrices: Record<string, number> = { starter: 29, pro: 59, franchise: 149 };
      const defaultNames: Record<string, string> = { starter: "Starter", pro: "Pro", franchise: "Franchise" };

      for (const plan of ["starter", "pro", "franchise"] as const) {
        const name   = cfg[`plan_${plan}_name`]?.trim()  || defaultNames[plan];
        const amount = parseInt(cfg[`plan_${plan}_price`]) || defaultPrices[plan];

        // Trouver ou créer le produit Stripe
        // On utilise list+metadata au lieu de search (plus fiable)
        let productId = cfg[`stripe_product_${plan}`]?.trim() || "";

        if (!productId) {
          // Chercher un produit existant via list (evite l'API search qui peut échouer)
          const existing = await stripe.products.list({ limit: 100, active: true });
          const found = existing.data.find((p: any) => p.metadata?.plan === plan);
          if (found) {
            productId = found.id;
          } else {
            const product = await stripe.products.create({
              name,
              description: `FidéliPro — Plan ${name}`,
              metadata: { plan },
            });
            productId = product.id;
          }
          await upsertSetting(`stripe_product_${plan}`, productId);
          results[`stripe_product_${plan}`] = productId;
        }

        // Créer un nouveau prix récurrent mensuel
        const price = await stripe.prices.create({
          product: productId,
          unit_amount: amount * 100,
          currency: "eur",
          recurring: { interval: "month" },
          metadata: { plan },
        });

        // Archiver l'ancien Price ID s'il existait
        const oldPriceId = cfg[`stripe_price_${plan}`]?.trim();
        if (oldPriceId && oldPriceId !== price.id) {
          try {
            await stripe.prices.update(oldPriceId, { active: false });
          } catch (_) { /* ignore si le prix n'existe plus */ }
        }

        await upsertSetting(`stripe_price_${plan}`, price.id);
        results[`stripe_price_${plan}`] = price.id;
        results[`stripe_product_${plan}`] = productId;
      }

      return new Response(JSON.stringify({ ok: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION : mettre à jour le prix d'un plan spécifique ───────────
    if (action === "update_price") {
      const { plan, price: newAmount, name: newName } = body as {
        plan: "starter" | "pro" | "franchise"; price: number; name?: string;
      };
      if (!plan || !newAmount) throw new Error("plan et price requis");

      const productId = cfg[`stripe_product_${plan}`]?.trim();
      if (!productId) throw new Error(`Produit Stripe non trouvé pour ${plan}. Cliquez d'abord sur "Créer les produits Stripe".`);

      if (newName) await stripe.products.update(productId, { name: newName });

      const price = await stripe.prices.create({
        product: productId,
        unit_amount: newAmount * 100,
        currency: "eur",
        recurring: { interval: "month" },
        metadata: { plan },
      });

      const oldPriceId = cfg[`stripe_price_${plan}`]?.trim();
      if (oldPriceId && oldPriceId !== price.id) {
        try { await stripe.prices.update(oldPriceId, { active: false }); } catch (_) { /* ignore */ }
      }

      await upsertSetting(`stripe_price_${plan}`, price.id);
      if (newName) await upsertSetting(`plan_${plan}_name`, newName);
      await upsertSetting(`plan_${plan}_price`, String(newAmount));

      return new Response(JSON.stringify({ ok: true, price_id: price.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION : synchroniser la souscription Stripe d'un business ────
    if (action === "sync_subscription") {
      const { business_id, new_plan } = body as { business_id: string; new_plan: "starter" | "pro" | "franchise" };
      if (!business_id || !new_plan) throw new Error("business_id et new_plan requis");

      // Get business
      const { data: biz, error: bizErr } = await supabase
        .from("businesses")
        .select("stripe_subscription_id, stripe_customer_id, subscription_plan")
        .eq("id", business_id)
        .single();
      if (bizErr || !biz) throw new Error("Business non trouvé");

      // Get new price ID
      const newPriceId = cfg[`stripe_price_${new_plan}`]?.trim();
      if (!newPriceId) throw new Error(`Prix Stripe non configuré pour le plan ${new_plan}`);

      if (biz.stripe_subscription_id) {
        // Update existing Stripe subscription
        const sub = await stripe.subscriptions.retrieve(biz.stripe_subscription_id);
        const itemId = sub.items.data[0]?.id;
        if (!itemId) throw new Error("Aucun item dans la souscription Stripe");

        await stripe.subscriptions.update(biz.stripe_subscription_id, {
          items: [{ id: itemId, price: newPriceId }],
          proration_behavior: "none",
        });
        console.log(`[manage-stripe-plans] Subscription ${biz.stripe_subscription_id} updated to ${new_plan}`);
      } else {
        console.log(`[manage-stripe-plans] No Stripe subscription for business ${business_id}, DB-only change`);
      }

      // Update DB
      await supabase.from("businesses").update({ subscription_plan: new_plan as any }).eq("id", business_id);

      return new Response(JSON.stringify({ ok: true, synced: !!biz.stripe_subscription_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[manage-stripe-plans] action inconnue:", action);
    throw new Error(`Action inconnue : ${action}`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[manage-stripe-plans] ERREUR:", msg);
    // Only expose safe user-facing messages, not internal details
    const safeMessages = ["Non authentifié", "Accès réservé aux super admins", "STRIPE_SECRET_KEY non configuré",
      "plan et price requis", "Action invalide"];
    const isSafe = safeMessages.some(s => msg.includes(s)) || msg.startsWith("Produit Stripe non trouvé");
    return new Response(JSON.stringify({ error: isSafe ? msg : "Erreur interne" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: isSafe ? 400 : 500,
    });
  }
});
