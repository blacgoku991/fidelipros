import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://fidelipros.lovable.app",
  "https://id-preview--a602f3ee-5c8a-4025-8469-788fb1c1e4c8.lovable.app",
];
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  function json(data: any, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate authorization — require apikey header (set by supabase-js) or Authorization
    const apiKey = req.headers.get("apikey") || "";
    const authHeader = req.headers.get("Authorization") || "";
    if (!apiKey && !authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(sbUrl, sbKey, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const { session_id, step } = body;

    if (!session_id || step === undefined) {
      return json({ error: "session_id and step required" }, 400);
    }

    // Fetch demo session
    const { data: session, error: sessErr } = await supabase
      .from("demo_sessions")
      .select("*, businesses(*)")
      .eq("id", session_id)
      .single();

    if (sessErr || !session) return json({ error: "Session introuvable" }, 404);

    const biz = session.businesses as any;
    if (!biz) return json({ error: "Business introuvable" }, 404);

    const loyaltyType = biz.loyalty_type || "points";
    const maxPts = biz.max_points_per_card || 10;
    const bizName = biz.name || "Commerce";
    const rewardDesc = biz.reward_description || "Récompense offerte !";

    // Build step-specific update
    let changeMessage = "";
    let newPoints = 0;
    let stepField = "";

    if (step === 1) {
      stepField = "step1_at";
      changeMessage = `🎉 Bienvenue chez ${bizName} ! Votre programme est activé`;
      newPoints = 0;
    } else if (step === 2) {
      stepField = "step2_at";
      const pts = Math.min(3, maxPts);
      newPoints = pts;
      if (loyaltyType === "stamps") {
        changeMessage = `✅ ${pts} tampons ajoutés ! Continuez pour débloquer votre récompense`;
      } else if (loyaltyType === "cashback") {
        changeMessage = `💰 3€ de cagnotte ajoutés ! Votre solde grandit`;
      } else {
        changeMessage = `⭐ ${pts} points ajoutés ! ${maxPts - pts} restants avant la récompense`;
      }
    } else if (step === 3) {
      stepField = "step3_at";
      const pts = Math.min(6, maxPts);
      newPoints = pts;
      if (loyaltyType === "stamps") {
        changeMessage = `🎁 Plus que ${maxPts - pts} tampons avant : ${rewardDesc}`;
      } else if (loyaltyType === "cashback") {
        changeMessage = `🎁 ${rewardDesc} — Vous y êtes presque !`;
      } else {
        changeMessage = `🎁 Plus que ${maxPts - pts} points ! ${rewardDesc}`;
      }
    } else {
      return json({ error: "Invalid step (1-3)" }, 400);
    }

    // Update the customer card points
    if (session.card_id && step >= 2) {
      await supabase
        .from("customer_cards")
        .update({
          current_points: newPoints,
          wallet_change_message: changeMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.card_id);
    } else if (session.card_id && step === 1) {
      // Step 1: just update change message
      await supabase
        .from("customer_cards")
        .update({
          wallet_change_message: changeMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.card_id);
    }

    // Update demo session
    const sessionUpdate: Record<string, any> = {
      current_step: step,
      demo_started: true,
      updated_at: new Date().toISOString(),
    };
    if (stepField) sessionUpdate[stepField] = new Date().toISOString();
    if (step === 3) sessionUpdate.cta_shown_at = new Date().toISOString();

    await supabase
      .from("demo_sessions")
      .update(sessionUpdate)
      .eq("id", session_id);

    // Try real wallet push if device is registered
    let pushResult: any = null;
    try {
      // Check if there's a wallet registration for this card
      const { data: regs } = await supabase
        .from("wallet_registrations")
        .select("id")
        .eq("business_id", biz.id)
        .limit(1);

      if (regs && regs.length > 0) {
        // Trigger real wallet push via internal call
        const pushRes = await fetch(`${sbUrl}/functions/v1/wallet-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sbKey}`,
          },
          body: JSON.stringify({
            business_id: biz.id,
            change_message: changeMessage,
            action_type: step >= 2 ? "points_increment" : "test",
            card_ids: session.card_id ? [session.card_id] : undefined,
          }),
        });
        pushResult = await pushRes.json().catch(() => null);
        console.log(`[Demo Sequence] Wallet push result for step ${step}:`, JSON.stringify(pushResult));
      } else {
        console.log(`[Demo Sequence] No wallet registrations for business ${biz.id} — skipping real push`);
      }
    } catch (pushErr) {
      console.error(`[Demo Sequence] Push error:`, pushErr);
    }

    return json({
      success: true,
      step,
      change_message: changeMessage,
      new_points: newPoints,
      push_sent: pushResult?.pushed > 0 || false,
      push_result: pushResult,
    });
  } catch (err: any) {
    console.error("[Demo Sequence] Error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
