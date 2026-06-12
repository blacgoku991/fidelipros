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
    "Access-Control-Allow-Origin":
      ALLOWED_ORIGINS.includes(origin) || /\.lovable\.(app|dev)$/.test(origin)
        ? origin
        : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Non authentifié" }, 401);

    const supabase = createClient(sbUrl, sbKey, { auth: { persistSession: false } });
    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !userData?.user) return json({ error: "Token invalide" }, 401);

    const body = await req.json().catch(() => ({}));
    const { business_id, lat, lng, online } = body as {
      business_id?: string;
      lat?: number;
      lng?: number;
      online?: boolean;
    };

    if (!business_id) return json({ error: "business_id required" }, 400);
    if (
      online !== false &&
      (typeof lat !== "number" || typeof lng !== "number" ||
        Math.abs(lat) > 90 || Math.abs(lng) > 180)
    ) {
      return json({ error: "lat/lng invalides" }, 400);
    }

    const { data: biz, error: bizErr } = await supabase
      .from("businesses")
      .select(
        "id, name, owner_id, business_template, driver_proximity_radius_km, driver_proximity_cooldown_hours, driver_proximity_message"
      )
      .eq("id", business_id)
      .eq("owner_id", userData.user.id)
      .maybeSingle();

    if (bizErr || !biz) return json({ error: "Commerce introuvable" }, 403);
    if (biz.business_template !== "vtc")
      return json({ error: "Mode chauffeur non activé pour ce commerce" }, 400);

    // Going offline: just flip the flag
    if (online === false) {
      await supabase
        .from("businesses")
        .update({ driver_is_online: false })
        .eq("id", business_id);
      return json({ ok: true, online: false });
    }

    const driverLat = lat as number;
    const driverLng = lng as number;

    // 1. Update driver position
    await supabase
      .from("businesses")
      .update({
        driver_current_lat: driverLat,
        driver_current_lng: driverLng,
        driver_last_position_at: new Date().toISOString(),
        driver_is_online: true,
      })
      .eq("id", business_id);

    // 2. Fetch customers with any usable position
    const { data: customers } = await supabase
      .from("customers")
      .select(
        "id, full_name, home_lat, home_lng, last_known_lat, last_known_lng, last_position_at"
      )
      .eq("business_id", business_id);

    const radiusKm = Number(biz.driver_proximity_radius_km ?? 2);
    const cooldownH = Number(biz.driver_proximity_cooldown_hours ?? 6);
    const cooldownAgo = new Date(Date.now() - cooldownH * 3600_000).toISOString();

    const eligible: { id: string; full_name: string; distance_km: number }[] = [];

    for (const c of customers ?? []) {
      // Pick the most precise position: live GPS if < 6h old, else home
      let cLat: number | null = null;
      let cLng: number | null = null;
      const livePosFresh =
        c.last_position_at &&
        Date.now() - new Date(c.last_position_at).getTime() < 6 * 3600_000;
      if (livePosFresh && c.last_known_lat != null && c.last_known_lng != null) {
        cLat = c.last_known_lat;
        cLng = c.last_known_lng;
      } else if (c.home_lat != null && c.home_lng != null) {
        cLat = c.home_lat;
        cLng = c.home_lng;
      }
      if (cLat == null || cLng == null) continue;

      const d = haversineKm(driverLat, driverLng, cLat, cLng);
      if (d <= radiusKm) eligible.push({ id: c.id, full_name: c.full_name, distance_km: d });
    }

    if (eligible.length === 0) {
      return json({ ok: true, eligible_count: 0, notified_count: 0 });
    }

    // 3. Cooldown filter
    const { data: recent } = await supabase
      .from("driver_proximity_log")
      .select("customer_id")
      .eq("business_id", business_id)
      .gte("sent_at", cooldownAgo);

    const recentSet = new Set((recent ?? []).map((r: any) => r.customer_id));
    const toNotify = eligible.filter((e) => !recentSet.has(e.id));

    if (toNotify.length === 0) {
      return json({
        ok: true,
        eligible_count: eligible.length,
        notified_count: 0,
        reason: "cooldown",
      });
    }

    // 4. Find each customer's active card
    const { data: cards } = await supabase
      .from("customer_cards")
      .select("id, customer_id")
      .eq("business_id", business_id)
      .eq("is_active", true)
      .in("customer_id", toNotify.map((t) => t.id));

    const cardIds = (cards ?? []).map((c: any) => c.id);

    // 5. Trigger notification via send-notifications (service-role auth)
    let notifiedCount = 0;
    if (cardIds.length > 0) {
      const message =
        biz.driver_proximity_message ||
        "Votre chauffeur préféré est dans les parages ! 🚗";

      const notifRes = await fetch(`${sbUrl}/functions/v1/send-notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sbKey}`,
          apikey: sbKey,
        },
        body: JSON.stringify({
          business_id,
          message,
          change_message: message,
          card_ids: cardIds,
        }),
      });
      if (notifRes.ok) notifiedCount = cardIds.length;
    }

    // 6. Log proximity events
    const logRows = toNotify.map((t) => ({
      business_id,
      customer_id: t.id,
      distance_km: Number(t.distance_km.toFixed(3)),
    }));
    if (logRows.length > 0) {
      await supabase.from("driver_proximity_log").insert(logRows);
    }

    return json({
      ok: true,
      eligible_count: eligible.length,
      notified_count: notifiedCount,
      notified_customers: toNotify.map((t) => ({
        id: t.id,
        name: t.full_name,
        distance_km: Number(t.distance_km.toFixed(2)),
      })),
    });
  } catch (e) {
    console.error("[driver-broadcast-position] error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
