import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  // Only accept service-role calls (cron or internal)
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token || token !== SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Find all scheduled campaigns that are due
  const { data: campaigns, error } = await supabase
    .from("notification_campaigns")
    .select("*")
    .eq("status", "scheduled")
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(20);

  if (error || !campaigns || campaigns.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let processed = 0;

  for (const campaign of campaigns) {
    try {
      // Resolve customers by segment
      const VALID_SEGMENTS = ["all", "bronze", "silver", "gold", "vip", "inactive"];
      const segments = (campaign.segment || "all").split(",").map((s: string) => s.trim()).filter((s: string) => VALID_SEGMENTS.includes(s));
      if (segments.length === 0) segments.push("all");
      const customerIds = new Set<string>();

      for (const seg of segments) {
        let query = supabase.from("customers").select("id, level, last_visit_at, total_points").eq("business_id", campaign.business_id);

        if (seg === "bronze") query = query.eq("level", "bronze");
        else if (seg === "silver") query = query.eq("level", "silver");
        else if (seg === "gold") query = query.eq("level", "gold");
        else if (seg === "inactive") {
          const ago30 = new Date(Date.now() - 30 * 86400000).toISOString();
          query = query.or(`last_visit_at.lt.${ago30},last_visit_at.is.null`);
        } else if (seg === "vip") {
          query = query.eq("level", "gold");
        }
        // "all" = no filter

        const { data } = await query.limit(1000);
        if (data) data.forEach((c: any) => customerIds.add(c.id));
      }

      if (customerIds.size === 0) {
        await supabase.from("notification_campaigns").update({
          status: "sent",
          recipients_count: 0,
        }).eq("id", campaign.id);
        processed++;
        continue;
      }

      // Insert notification logs
      const logs = [...customerIds].map(cid => ({
        business_id: campaign.business_id,
        customer_id: cid,
        title: campaign.title,
        message: campaign.message,
        type: "custom",
        segment: campaign.segment,
        delivery_status: "sent",
      }));
      await supabase.from("notifications_log").insert(logs);

      // Send wallet push notifications
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-notifications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            business_id: campaign.business_id,
            title: campaign.title,
            message: campaign.message,
            segment: campaign.segment,
            channels: { web_push: false, apple_wallet: true },
          }),
        });
      } catch { /* non-blocking */ }

      // Mark as sent
      await supabase.from("notification_campaigns").update({
        status: "sent",
        recipients_count: customerIds.size,
      }).eq("id", campaign.id);

      processed++;
    } catch (err) {
      // Mark as failed
      await supabase.from("notification_campaigns").update({
        status: "failed",
      }).eq("id", campaign.id);
      console.error(`[campaign-scheduler] Failed campaign ${campaign.id}:`, err);
    }
  }

  return new Response(JSON.stringify({ processed }), {
    headers: { "Content-Type": "application/json" },
  });
});
