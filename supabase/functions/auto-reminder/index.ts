// Edge function: Auto-reminder for inactive customers + birthday notifications
// Checks automations rules and sends push notifications via wallet-push

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://fidelipros.lovable.app",
  "https://id-preview--a602f3ee-5c8a-4025-8469-788fb1c1e4c8.lovable.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

const log = (step: string, details?: any) => {
  console.log(`[AUTO-REMINDER] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

async function sendPush(projectUrl: string, serviceKey: string, payload: Record<string, any>) {
  try {
    await fetch(`${projectUrl}/functions/v1/wallet-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    log("Push failed (non-blocking)", { error: String(err) });
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const jsonResponse = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sbUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(sbUrl, sbKey, { auth: { persistSession: false } });

  // Auth: only service-role
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (token !== sbKey) {
    return jsonResponse({ error: "Unauthorized — service-role key required" }, 401);
  }

  try {
    let targetBusinessId: string | null = null;
    try {
      const body = await req.json();
      targetBusinessId = body.business_id || null;
    } catch { /* No body = process all */ }

    // ── Fetch all businesses ──
    const { data: businesses, error: bizErr } = await supabase
      .from("businesses")
      .select("id, name, auto_reminder_days, auto_reminder_enabled, reward_alert_threshold, max_points_per_card, loyalty_type, birthday_notif_enabled, birthday_notif_message")
      .or(targetBusinessId ? `id.eq.${targetBusinessId}` : "auto_reminder_enabled.eq.true,birthday_notif_enabled.eq.true");

    if (bizErr) throw new Error(`Failed to fetch businesses: ${bizErr.message}`);
    if (!businesses || businesses.length === 0) {
      log("No businesses to process");
      return jsonResponse({ success: true, processed: 0 });
    }

    log("Processing businesses", { count: businesses.length });

    let totalReminders = 0;
    let totalRewardAlerts = 0;
    let totalBirthdayNotifs = 0;

    for (const biz of businesses) {
      const unitLabel = biz.loyalty_type === "stamps" ? "tampons" : "points";

      // ── 1. Inactive customer reminders ──
      if (biz.auto_reminder_enabled) {
        const reminderDays = biz.auto_reminder_days || 7;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - reminderDays);

        const { data: inactiveCustomers } = await supabase
          .from("customers")
          .select("id, full_name, last_visit_at")
          .eq("business_id", biz.id)
          .lt("last_visit_at", cutoffDate.toISOString())
          .not("last_visit_at", "is", null);

        if (inactiveCustomers && inactiveCustomers.length > 0) {
          for (const customer of inactiveCustomers) {
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);

            const { count: recentReminders } = await supabase
              .from("notifications_log")
              .select("*", { count: "exact", head: true })
              .eq("customer_id", customer.id)
              .eq("business_id", biz.id)
              .eq("type", "win_back")
              .gte("sent_at", oneDayAgo.toISOString());

            if ((recentReminders || 0) > 0) continue;

            const daysSince = Math.floor((Date.now() - new Date(customer.last_visit_at!).getTime()) / (1000 * 60 * 60 * 24));
            const message = `👋 ${customer.full_name || "Cher client"}, ça fait ${daysSince} jours ! Vos ${unitLabel} vous attendent chez ${biz.name}.`;

            await sendPush(sbUrl, sbKey, {
              business_id: biz.id,
              customer_id: customer.id,
              action_type: "campaign",
              change_message: message,
            });

            await supabase.from("notifications_log").insert({
              business_id: biz.id,
              customer_id: customer.id,
              type: "win_back" as any,
              title: biz.name,
              message,
              delivery_status: "sent",
            });

            totalReminders++;
          }
        }

        // ── 2. Reward proximity alerts ──
        const rewardThreshold = biz.reward_alert_threshold || 2;
        const maxPoints = biz.max_points_per_card || 10;

        const { data: closeToReward } = await supabase
          .from("customer_cards")
          .select("id, customer_id, current_points, max_points, customers(full_name)")
          .eq("business_id", biz.id)
          .eq("is_active", true)
          .gte("current_points", maxPoints - rewardThreshold)
          .lt("current_points", maxPoints);

        if (closeToReward && closeToReward.length > 0) {
          for (const card of closeToReward) {
            const remaining = (card.max_points || maxPoints) - (card.current_points || 0);
            const customerName = (card.customers as any)?.full_name || "Cher client";

            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

            const { count: recentAlerts } = await supabase
              .from("notifications_log")
              .select("*", { count: "exact", head: true })
              .eq("customer_id", card.customer_id)
              .eq("business_id", biz.id)
              .eq("type", "points_reminder")
              .gte("sent_at", twoDaysAgo.toISOString());

            if ((recentAlerts || 0) > 0) continue;

            const rewardMsg = `⭐ ${customerName}, plus que ${remaining} ${unitLabel} pour votre récompense chez ${biz.name} !`;

            await sendPush(sbUrl, sbKey, {
              business_id: biz.id,
              customer_id: card.customer_id,
              action_type: "campaign",
              change_message: rewardMsg,
            });

            await supabase.from("notifications_log").insert({
              business_id: biz.id,
              customer_id: card.customer_id,
              type: "points_reminder" as any,
              title: biz.name,
              message: rewardMsg,
              delivery_status: "sent",
            });

            totalRewardAlerts++;
          }
        }
      }

      // ── 3. Birthday notifications ──
      if (biz.birthday_notif_enabled) {
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");

        // Find customers whose birthday is today (match month-day)
        const { data: birthdayCustomers } = await supabase
          .from("customers")
          .select("id, full_name, birthday")
          .eq("business_id", biz.id)
          .not("birthday", "is", null);

        if (birthdayCustomers && birthdayCustomers.length > 0) {
          const todayBirthdays = birthdayCustomers.filter((c: any) => {
            if (!c.birthday) return false;
            const bd = c.birthday; // format: YYYY-MM-DD
            return bd.substring(5) === `${month}-${day}`;
          });

          for (const customer of todayBirthdays) {
            // Check if already notified today
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

            const { count: recentBirthday } = await supabase
              .from("notifications_log")
              .select("*", { count: "exact", head: true })
              .eq("customer_id", customer.id)
              .eq("business_id", biz.id)
              .eq("type", "special_offer")
              .gte("sent_at", todayStart);

            if ((recentBirthday || 0) > 0) continue;

            const birthdayMsg = biz.birthday_notif_message
              ? biz.birthday_notif_message.replace("{name}", customer.full_name || "")
              : `🎂 Joyeux anniversaire ${customer.full_name || ""} ! Un cadeau vous attend chez ${biz.name}`;

            await sendPush(sbUrl, sbKey, {
              business_id: biz.id,
              customer_id: customer.id,
              action_type: "campaign",
              change_message: birthdayMsg,
            });

            await supabase.from("notifications_log").insert({
              business_id: biz.id,
              customer_id: customer.id,
              type: "special_offer" as any,
              title: `🎂 ${biz.name}`,
              message: birthdayMsg,
              delivery_status: "sent",
            });

            totalBirthdayNotifs++;
            log("Birthday notification sent", { customer: customer.full_name, business: biz.name });
          }
        }
      }

      // ── 4. Process custom automations ──
      const { data: automations } = await supabase
        .from("automations")
        .select("*")
        .eq("business_id", biz.id)
        .eq("is_active", true);

      if (automations && automations.length > 0) {
        for (const auto of automations) {
          const cooldownMs = (auto.cooldown_hours || 24) * 60 * 60 * 1000;

          if (auto.trigger_type === "inactive_days") {
            const triggerDays = auto.trigger_value || 7;
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - triggerDays);

            let custQuery = supabase
              .from("customers")
              .select("id, full_name, last_visit_at, level")
              .eq("business_id", biz.id)
              .lt("last_visit_at", cutoff.toISOString())
              .not("last_visit_at", "is", null);

            if (auto.target_segment !== "all") {
              custQuery = custQuery.eq("level", auto.target_segment);
            }

            const { data: targets } = await custQuery;
            if (!targets || targets.length === 0) continue;

            for (const c of targets) {
              const cooldownCutoff = new Date(Date.now() - cooldownMs).toISOString();
              const { count } = await supabase
                .from("notifications_log")
                .select("*", { count: "exact", head: true })
                .eq("customer_id", c.id)
                .eq("business_id", biz.id)
                .gte("sent_at", cooldownCutoff);

              if ((count || 0) > 0) continue;

              const msg = auto.message.replace("{name}", c.full_name || "").replace("{business}", biz.name);

              await sendPush(sbUrl, sbKey, {
                business_id: biz.id,
                customer_id: c.id,
                action_type: "campaign",
                change_message: msg,
              });

              await supabase.from("notifications_log").insert({
                business_id: biz.id,
                customer_id: c.id,
                type: "custom" as any,
                title: auto.title,
                message: msg,
                delivery_status: "sent",
              });

              totalReminders++;
            }

            // Update last_triggered_at
            await supabase.from("automations").update({ last_triggered_at: new Date().toISOString() } as any).eq("id", auto.id);
          }

          if (auto.trigger_type === "reward_reached") {
            const maxPts = biz.max_points_per_card || 10;
            const { data: rewardCards } = await supabase
              .from("customer_cards")
              .select("id, customer_id, current_points, max_points, customers(full_name, level)")
              .eq("business_id", biz.id)
              .eq("is_active", true)
              .gte("current_points", maxPts);

            if (rewardCards && rewardCards.length > 0) {
              for (const card of rewardCards) {
                const cust = card.customers as any;
                if (auto.target_segment !== "all" && cust?.level !== auto.target_segment) continue;

                const cooldownCutoff = new Date(Date.now() - cooldownMs).toISOString();
                const { count } = await supabase
                  .from("notifications_log")
                  .select("*", { count: "exact", head: true })
                  .eq("customer_id", card.customer_id)
                  .eq("business_id", biz.id)
                  .gte("sent_at", cooldownCutoff);

                if ((count || 0) > 0) continue;

                const msg = auto.message.replace("{name}", cust?.full_name || "").replace("{business}", biz.name);

                await sendPush(sbUrl, sbKey, {
                  business_id: biz.id,
                  customer_id: card.customer_id,
                  action_type: "campaign",
                  change_message: msg,
                });

                await supabase.from("notifications_log").insert({
                  business_id: biz.id,
                  customer_id: card.customer_id,
                  type: "reward_earned" as any,
                  title: auto.title,
                  message: msg,
                  delivery_status: "sent",
                });

                totalRewardAlerts++;
              }

              await supabase.from("automations").update({ last_triggered_at: new Date().toISOString() } as any).eq("id", auto.id);
            }
          }

          // Birthday automations handled above in section 3
        }
      }
    }

    log("Done", { totalReminders, totalRewardAlerts, totalBirthdayNotifs });

    return jsonResponse({
      success: true,
      businesses_processed: businesses.length,
      reminders_sent: totalReminders,
      reward_alerts_sent: totalRewardAlerts,
      birthday_notifs_sent: totalBirthdayNotifs,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: msg });
    return jsonResponse({ error: msg }, 500);
  }
});