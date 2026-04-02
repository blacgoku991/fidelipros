// wallet-debug — diagnostic endpoint for Apple Wallet registration state
// Returns real DB state: wallet_registrations, apns_logs, customer_cards wallet info
// REQUIRES service-role key or authenticated super_admin

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://fidelipros.lovable.app",
  "https://id-preview--a602f3ee-5c8a-4025-8469-788fb1c1e4c8.lovable.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data, null, 2), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(sbUrl, sbKey, { auth: { persistSession: false } });

    // Auth check: require service-role key or authenticated super_admin
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    let authorized = false;

    // Check if it's a service-role call
    if (token === sbKey) {
      authorized = true;
    } else if (token) {
      // Check if authenticated user is a super_admin
      const { data: userData, error: userErr } = await supabase.auth.getUser(token);
      if (!userErr && userData?.user) {
        const { data: hasAdmin } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", userData.user.id)
          .eq("role", "super_admin")
          .maybeSingle();
        if (hasAdmin) authorized = true;
      }
    }

    if (!authorized) {
      return json({ error: "Unauthorized — super_admin or service-role required" }, 401);
    }

    const url = new URL(req.url);
    let businessId: string | null = url.searchParams.get("business_id");

    if (!businessId) {
      const { data: firstBiz } = await supabase
        .from("businesses")
        .select("id, name")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      businessId = firstBiz?.id ?? null;
    }

    if (!businessId) return json({ error: "Aucun business trouvé en base" }, 404);

    // ── 1. wallet_registrations ───────────────────────────────────────────
    const { data: registrations, error: regErr } = await supabase
      .from("wallet_registrations")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(20);

    const { count: regCount } = await supabase
      .from("wallet_registrations")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId);

    // ── 2. Total registrations in the table (all businesses) ─────────────
    const { count: totalRegCount } = await supabase
      .from("wallet_registrations")
      .select("*", { count: "exact", head: true });

    // ── 3. customer_cards with wallet info ────────────────────────────────
    const { data: cards } = await supabase
      .from("customer_cards")
      .select("id, card_code, business_id, customer_id, wallet_auth_token, wallet_installed_at, wallet_last_fetched_at, wallet_change_message, updated_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(20);

    // ── 4. APNs logs ──────────────────────────────────────────────────────
    const { data: apnsLogs } = await supabase
      .from("wallet_apns_logs")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(20);

    // ── 5. Business wallet config ─────────────────────────────────────────
    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, geofence_enabled, latitude, longitude, geofence_satellite_points")
      .eq("id", businessId)
      .maybeSingle();

    // ── 6. What wallet-push would find ─────────────────────────────────────
    const { data: pushTargets } = await supabase
      .from("wallet_registrations")
      .select("serial_number, push_token, device_library_id, pass_type_id, card_id, updated_at")
      .eq("business_id", businessId);

    // ── Build summary ─────────────────────────────────────────────────────
    const summary = {
      timestamp: new Date().toISOString(),
      business: {
        id: businessId,
        name: business?.name,
        geofence_enabled: business?.geofence_enabled,
        has_coordinates: !!(business?.latitude && business?.longitude),
        satellite_points_count: Array.isArray(business?.geofence_satellite_points)
          ? business.geofence_satellite_points.length
          : 0,
      },

      wallet_registrations: {
        count_for_this_business: regCount ?? 0,
        total_in_table: totalRegCount ?? 0,
        fetch_error: regErr?.message ?? null,
        rows: (registrations || []).map(r => ({
          id: r.id,
          device_library_id: r.device_library_id,
          pass_type_id: r.pass_type_id,
          serial_number: r.serial_number,
          push_token_present: !!r.push_token,
          push_token_suffix: r.push_token ? r.push_token.slice(-8) : null,
          auth_token_present: !!r.authentication_token,
          card_id: r.card_id,
          customer_id: r.customer_id,
          created_at: r.created_at,
          updated_at: r.updated_at,
        })),
      },

      customer_cards: {
        count: cards?.length ?? 0,
        rows: (cards || []).map(c => ({
          id: c.id,
          card_code: c.card_code,
          has_auth_token: !!c.wallet_auth_token,
          auth_token_length: c.wallet_auth_token?.length ?? 0,
          wallet_installed_at: c.wallet_installed_at,
          wallet_last_fetched_at: c.wallet_last_fetched_at,
          has_change_message: !!c.wallet_change_message,
          updated_at: c.updated_at,
        })),
      },

      apns_logs: {
        count: apnsLogs?.length ?? 0,
        rows: (apnsLogs || []).map(l => ({
          status: l.status,
          serial_number: l.serial_number,
          push_token_suffix: l.push_token?.slice(-8),
          apns_response: l.apns_response,
          error_message: l.error_message,
          created_at: l.created_at,
        })),
      },

      wallet_push_simulation: {
        would_find_registrations: (pushTargets?.length ?? 0) > 0,
        registration_count: pushTargets?.length ?? 0,
        push_tokens: (pushTargets || []).map(r => ({
          serial: r.serial_number,
          token_suffix: r.push_token?.slice(-8),
          pass_type: r.pass_type_id,
        })),
      },

      diagnosis: {
        wallet_registrations_empty: (regCount ?? 0) === 0,
        wallet_never_installed: !(cards || []).some(c => c.wallet_installed_at),
        apns_ever_attempted: (apnsLogs?.length ?? 0) > 0,
        recommendation: (regCount ?? 0) === 0
          ? "TABLE VIDE — L'iPhone ne s'est jamais enregistré. Vérifier que le webService est déployé et réinstaller le pass."
          : "Enregistrements présents — problème de ciblage campagne ou de push_token invalide.",
      },
    };

    return json(summary);
  } catch (err: any) {
    console.error("[wallet-debug] Error:", err);
    return json({ error: "Internal error", details: String(err) }, 500);
  }
});
