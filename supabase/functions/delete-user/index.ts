import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    // Auth: verify caller is super_admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) throw new Error("Non authentifié");

    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !userData?.user) throw new Error("Non authentifié");

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "super_admin")
      .maybeSingle();
    if (roleRow?.role !== "super_admin") throw new Error("Accès réservé aux super admins");

    const { user_id } = await req.json();
    if (!user_id) throw new Error("user_id requis");

    if (user_id === userData.user.id) throw new Error("Impossible de supprimer votre propre compte");

    console.log(`[delete-user] Starting full cascade delete for: ${user_id}`);

    // 1. Find all businesses owned by this user
    const { data: businesses } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user_id);

    const bizIds = (businesses || []).map((b: any) => b.id);
    console.log(`[delete-user] Found ${bizIds.length} businesses to clean`);

    if (bizIds.length > 0) {
      // 2. Find all customers for these businesses
      const { data: customers } = await supabase
        .from("customers")
        .select("id")
        .in("business_id", bizIds);
      const customerIds = (customers || []).map((c: any) => c.id);

      // 3. Find all customer cards
      const { data: cards } = await supabase
        .from("customer_cards")
        .select("id")
        .in("business_id", bizIds);
      const cardIds = (cards || []).map((c: any) => c.id);

      // 4. Find all locations
      const { data: locations } = await supabase
        .from("merchant_locations")
        .select("id")
        .in("business_id", bizIds);
      const locationIds = (locations || []).map((l: any) => l.id);

      // Delete in dependency order (deepest first)
      if (cardIds.length > 0) {
        await supabase.from("scan_cooldowns").delete().in("card_id", cardIds);
        await supabase.from("points_history").delete().in("card_id", cardIds);
        await supabase.from("wallet_pass_updates").delete().in("serial_number", cardIds);
      }

      if (locationIds.length > 0) {
        await supabase.from("location_managers").delete().in("location_id", locationIds);
        await supabase.from("user_merchant_points").delete().in("merchant_location_id", locationIds);
      }

      if (customerIds.length > 0) {
        await supabase.from("customer_scores").delete().in("customer_id", customerIds);
        await supabase.from("customer_reviews").delete().in("customer_id", customerIds);
        await supabase.from("notifications_log").delete().in("customer_id", customerIds);
      }

      // Delete business-level data
      for (const bizId of bizIds) {
        await supabase.from("customer_cards").delete().eq("business_id", bizId);
        await supabase.from("customers").delete().eq("business_id", bizId);
        await supabase.from("rewards").delete().eq("business_id", bizId);
        await supabase.from("notification_templates").delete().eq("business_id", bizId);
        await supabase.from("notification_campaigns").delete().eq("business_id", bizId);
        await supabase.from("automations").delete().eq("business_id", bizId);
        await supabase.from("special_events").delete().eq("business_id", bizId);
        await supabase.from("merchant_locations").delete().eq("business_id", bizId);
        await supabase.from("webhook_endpoints").delete().eq("business_id", bizId);
        await supabase.from("vitrine_visits").delete().eq("business_id", bizId);
        await supabase.from("demo_sessions").delete().eq("business_id", bizId);
        await supabase.from("digest_logs").delete().eq("merchant_id", bizId);
        await supabase.from("wallet_registrations").delete().eq("business_id", bizId);
        await supabase.from("wallet_apns_logs").delete().eq("business_id", bizId);
      }

      // Delete the businesses themselves
      await supabase.from("businesses").delete().in("id", bizIds);
    }

    // 5. Delete user-level data
    await supabase.from("user_roles").delete().eq("user_id", user_id);
    await supabase.from("profiles").delete().eq("id", user_id);

    // 6. Finally delete from auth.users
    const { error: deleteErr } = await supabase.auth.admin.deleteUser(user_id);
    if (deleteErr) {
      console.error(`[delete-user] Auth delete error:`, deleteErr.message);
      throw new Error(`Erreur suppression auth: ${deleteErr.message}`);
    }

    console.log(`[delete-user] Successfully deleted user and all data: ${user_id}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[delete-user] ERROR:", msg);
    const safeMessages = ["Non authentifié", "Accès réservé aux super admins", "user_id requis", "Impossible de supprimer votre propre compte"];
    const isSafe = safeMessages.some(s => msg.includes(s));
    return new Response(JSON.stringify({ error: isSafe ? msg : "Erreur lors de la suppression" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: isSafe ? 400 : 500,
    });
  }
});
