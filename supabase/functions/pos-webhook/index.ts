import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing x-api-key header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find business by API key
    const { data: business, error: bizErr } = await supabase
      .from("businesses")
      .select("id, name, pos_enabled, loyalty_type, points_per_visit, points_per_euro, max_points_per_card")
      .eq("pos_api_key", apiKey)
      .eq("pos_enabled", true)
      .maybeSingle();

    if (bizErr || !business) {
      return new Response(JSON.stringify({ error: "Invalid API key or POS not enabled" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { customer_email, customer_phone, amount, reference, items } = body;

    if (!customer_email && !customer_phone) {
      return new Response(JSON.stringify({ error: "customer_email or customer_phone required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Input validation
    if (customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (customer_phone && !/^\+?[0-9\s\-()]{7,20}$/.test(customer_phone)) {
      return new Response(JSON.stringify({ error: "Invalid phone format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (amount !== undefined && (typeof amount !== "number" || amount < 0 || amount > 100000)) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find existing customer
    let customerQuery = supabase
      .from("customers")
      .select("id, total_points, total_visits")
      .eq("business_id", business.id);

    if (customer_email) {
      customerQuery = customerQuery.eq("email", customer_email);
    } else {
      customerQuery = customerQuery.eq("phone", customer_phone);
    }

    const { data: customer } = await customerQuery.maybeSingle();

    if (!customer) {
      return new Response(JSON.stringify({
        error: "Customer not found",
        message: "Le client doit d'abord s'inscrire au programme de fidélité",
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find their active card
    const { data: card } = await supabase
      .from("customer_cards")
      .select("id, current_points, max_points, rewards_earned")
      .eq("customer_id", customer.id)
      .eq("business_id", business.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!card) {
      return new Response(JSON.stringify({
        error: "No active loyalty card",
        message: "Le client n'a pas de carte de fidélité active",
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate points to add
    let pointsToAdd = business.points_per_visit || 1;
    if (business.loyalty_type === "cashback" && amount && business.points_per_euro) {
      pointsToAdd = Math.floor(amount * (business.points_per_euro / 100));
    } else if (business.loyalty_type === "points" && amount && business.points_per_euro) {
      pointsToAdd = Math.floor(amount * business.points_per_euro);
    }
    if (pointsToAdd < 1) pointsToAdd = 1;

    const maxPoints = card.max_points || business.max_points_per_card || 10;
    const newPoints = card.current_points + pointsToAdd;
    const rewardEarned = newPoints >= maxPoints;

    // Update card
    await supabase.from("customer_cards").update({
      current_points: rewardEarned ? 0 : newPoints,
      rewards_earned: rewardEarned ? (card.rewards_earned || 0) + 1 : card.rewards_earned,
      last_visit: new Date().toISOString(),
      wallet_change_message: rewardEarned
        ? `Récompense débloquée ! (${reference || "POS"})`
        : `+${pointsToAdd} point${pointsToAdd > 1 ? "s" : ""} (${reference || "POS"})`,
    }).eq("id", card.id);

    // Update customer totals
    await supabase.from("customers").update({
      total_points: (customer.total_points || 0) + pointsToAdd,
      total_visits: (customer.total_visits || 0) + 1,
      last_visit_at: new Date().toISOString(),
    }).eq("id", customer.id);

    // Log the transaction
    await supabase.from("points_history").insert({
      customer_id: customer.id,
      business_id: business.id,
      card_id: card.id,
      points_added: pointsToAdd,
      action: "pos_transaction",
      note: [reference, items?.map((i: any) => `${i.name} x${i.qty}`).join(", ")].filter(Boolean).join(" — "),
    });

    // Push wallet update if card is installed
    try {
      const { data: registrations } = await supabase
        .from("wallet_registrations")
        .select("serial_number")
        .eq("card_id", card.id);

      if (registrations && registrations.length > 0) {
        for (const reg of registrations) {
          await supabase.from("wallet_pass_updates").upsert({
            serial_number: reg.serial_number,
            pass_type_id: "pass.app.fidelispro",
            change_message: rewardEarned
              ? `Récompense débloquée !`
              : `+${pointsToAdd} point${pointsToAdd > 1 ? "s" : ""}`,
            last_updated: new Date().toISOString(),
          }, { onConflict: "serial_number,pass_type_id" });
        }
      }
    } catch { /* wallet push is best-effort */ }

    return new Response(JSON.stringify({
      success: true,
      customer_id: customer.id,
      points_added: pointsToAdd,
      new_total: rewardEarned ? 0 : newPoints,
      reward_earned: rewardEarned,
      rewards_count: rewardEarned ? (card.rewards_earned || 0) + 1 : card.rewards_earned,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal processing error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
