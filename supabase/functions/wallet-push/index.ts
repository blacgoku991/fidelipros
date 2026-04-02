// Edge function: Real APNs push for Apple Wallet pass updates
// Uses token-based (P8/JWT) authentication — works with Deno's HTTP/2 fetch

import { createClient } from "npm:@supabase/supabase-js@2";

const PASS_TYPE_ID = Deno.env.get("APPLE_PASS_TYPE_ID") || "pass.app.lovable.fidelispro";

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

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const jsonResponse = (data: any, status: number) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── Auth : service_role (appel interne) ou JWT utilisateur ────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) return jsonResponse({ error: "Non authentifié" }, 401);

    const supabase = createClient(sbUrl, sbKey, { auth: { persistSession: false } });

    const body = await req.json();
    const { business_id, campaign_id, change_message, card_ids, test_mode, action_type, customer_id } = body;

    if (!business_id) {
      return jsonResponse({ error: "business_id required" }, 400);
    }

    // Check if token is the service role key (internal call)
    const isServiceRole = token === sbKey;

    if (!isServiceRole) {
      // Validate user JWT and verify business ownership
      const { data: userData, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !userData?.user) return jsonResponse({ error: "Token invalide" }, 401);

      const { data: biz } = await supabase
        .from("businesses")
        .select("id")
        .eq("id", business_id)
        .eq("owner_id", userData.user.id)
        .maybeSingle();

      if (!biz) return jsonResponse({ error: "Commerce introuvable ou accès refusé" }, 403);
    }

    const act = action_type || "test";

    // ── Fetch old field values BEFORE update for changeMessage validation ──
    let oldFieldValues: Record<string, any> = {};

    // ── Resolve target serial numbers ─────────────────────────────
    let serialQuery = supabase
      .from("wallet_registrations")
      .select("serial_number")
      .eq("business_id", business_id);

    if (customer_id) {
      serialQuery = serialQuery.eq("customer_id", customer_id);
    } else if (card_ids && card_ids.length > 0) {
      serialQuery = serialQuery.in("card_id", card_ids);
    }

    if (act === "send_test_notification" && !customer_id && (!card_ids || card_ids.length === 0)) {
      serialQuery = serialQuery.order("updated_at", { ascending: false }).limit(1);
    }

    const { data: targetSerials, error: targetErr } = await serialQuery;

    if (targetErr) {
      console.error("[Wallet Push] Error fetching target serials:", targetErr);
      return jsonResponse({ error: "Failed to fetch wallet targets" }, 500);
    }

    // ── COUNT total registrations in table for this business (diagnostic) ──
    const { count: totalRegCount } = await supabase
      .from("wallet_registrations")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business_id);

    console.log(`[Wallet Push] business_id=${business_id}`);
    console.log(`[Wallet Push] wallet_registrations for this business: ${totalRegCount ?? "ERROR"}`);
    console.log(`[Wallet Push] targetSerials found: ${targetSerials?.length ?? 0}`);

    if (!targetSerials || targetSerials.length === 0) {
      console.log(`[Wallet Push] ✗ No wallet registrations → pushed=0. Table total=${totalRegCount ?? "?"}`);
      return jsonResponse({
        success: true,
        message: "No wallet registrations found",
        pushed: 0,
        total_registrations: 0,
        diagnostic: {
          business_id,
          total_registrations_in_table: totalRegCount ?? 0,
          hint: totalRegCount === 0
            ? "wallet_registrations table is EMPTY for this business. iPhone must add pass to Wallet first."
            : "Registrations exist but query returned nothing — check filters.",
        },
      }, 200);
    }

    // ── Apply card updates based on action_type ──────────────────
    const serialNumbers = [...new Set(targetSerials.map((r: any) => r.serial_number))];
    const now = new Date().toISOString();
    const cardUpdateResults: any[] = [];

    for (const sn of serialNumbers) {
      let cardUpdate: Record<string, any> = {};
      let effectiveMessage = "";

      // Fetch old values BEFORE update for changeMessage validation
      const { data: cardData } = await supabase
        .from("customer_cards")
        .select("current_points, max_points, wallet_change_message")
        .eq("id", sn)
        .single();

      const oldPts = cardData?.current_points || 0;
      const maxPts = cardData?.max_points || 10;
      const oldChangeMessage = cardData?.wallet_change_message || "";
      let newPts = oldPts;
      let fieldValueActuallyChanged = false;

      if (act === "points_increment" || act === "full_test" || act === "send_test_notification") {
        // Actually increment points — the VALUE must change for visible notification
        newPts = Math.min(oldPts + 1, maxPts);
        cardUpdate.current_points = newPts;
        fieldValueActuallyChanged = newPts !== oldPts;
        console.log(`[Wallet Push] Points ${oldPts} → ${newPts} for card ${sn} (changed=${fieldValueActuallyChanged})`);
      }

      // Only set wallet_change_message for campaigns (user-facing notifications)
      // For other actions (points_increment, geofence, etc.), update the card silently
      const isCampaign = act === "campaign";

      if (isCampaign && change_message) {
        effectiveMessage = change_message;
        // If message is identical to previous, append timestamp to force unique value
        if (effectiveMessage === oldChangeMessage) {
          effectiveMessage = `${effectiveMessage} (${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })})`;
          console.log(`[Wallet Push] ⚠ Message identical — appended timestamp`);
        }
        cardUpdate.wallet_change_message = effectiveMessage;
        fieldValueActuallyChanged = true;
      }

      cardUpdate.updated_at = now;

      const { error: updateErr } = await supabase
        .from("customer_cards")
        .update(cardUpdate)
        .eq("id", sn);

      cardUpdateResults.push({
        serial_number: sn,
        action: act,
        updated: !updateErr,
        message: effectiveMessage,
        field_value_changed: fieldValueActuallyChanged,
        old_points: oldPts,
        new_points: newPts,
        old_change_message: oldChangeMessage,
        new_change_message: effectiveMessage,
        changeMessage_on_points: "Vous avez gagné %@ points !",
        changeMessage_on_offer: "%@",
        ...(updateErr ? { error: updateErr.message } : {}),
      });

      await supabase
        .from("wallet_registrations")
        .update({ updated_at: now })
        .eq("business_id", business_id)
        .eq("serial_number", sn);

      // Mark pass as updated in wallet_pass_updates
      await supabase.from("wallet_pass_updates").upsert(
        {
          serial_number: sn,
          pass_type_id: PASS_TYPE_ID,
          last_updated: now,
          change_message: effectiveMessage,
          campaign_id: campaign_id || null,
        },
        { onConflict: "serial_number,pass_type_id" }
      );
    }

    // Fetch push tokens AFTER DB update (required for proper Wallet update ordering)
    let registrationsQuery = supabase
      .from("wallet_registrations")
      .select("*")
      .eq("business_id", business_id)
      .in("serial_number", serialNumbers);

    if (customer_id) {
      registrationsQuery = registrationsQuery.eq("customer_id", customer_id);
    }

    if (act === "send_test_notification") {
      registrationsQuery = registrationsQuery.order("updated_at", { ascending: false }).limit(1);
    }

    const { data: registrations, error: regErr } = await registrationsQuery;

    if (regErr) {
      console.error("[Wallet Push] Error fetching registrations after DB update:", regErr);
      return jsonResponse({ error: "Failed to fetch registrations" }, 500);
    }

    if (!registrations || registrations.length === 0) {
      return jsonResponse({
        success: true,
        action_type: act,
        total_registrations: 0,
        unique_passes: serialNumbers.length,
        unique_devices: 0,
        pushed: 0,
        failed: 0,
        card_updates: cardUpdateResults,
      }, 200);
    }

    // ── REAL APNs Push via Token-Based Auth ──────────────────────────
    const p8Key = Deno.env.get("APPLE_P8_KEY")!;
    const keyId = Deno.env.get("APPLE_KEY_ID")!;
    const teamId = Deno.env.get("APPLE_TEAM_ID")!.trim();

    if (!p8Key || !keyId) {
      console.error("[Wallet Push] Missing APPLE_P8_KEY or APPLE_KEY_ID");
      return jsonResponse({
        success: false,
        error: "APNs credentials not configured (P8 key / Key ID missing)",
        total_registrations: registrations.length,
      }, 500);
    }

    // Generate JWT for APNs
    const jwt = await createApnsJwt(teamId, keyId, p8Key);

    const apnsHost = test_mode
      ? "api.sandbox.push.apple.com"
      : "api.push.apple.com";

    let successCount = 0;
    let failCount = 0;
    const pushResults: any[] = [];

    // Deduplicate by push_token to avoid sending duplicates
    const uniqueTokens = new Map<string, any>();
    for (const reg of registrations) {
      if (!uniqueTokens.has(reg.push_token)) {
        uniqueTokens.set(reg.push_token, reg);
      }
    }

    for (const [pushToken, reg] of uniqueTokens) {
      const logEntry: any = {
        business_id,
        serial_number: reg.serial_number,
        push_token: pushToken,
        campaign_id: campaign_id || null,
        status: "pending",
      };

      try {
        const result = await sendApnsPush(pushToken, PASS_TYPE_ID, jwt, apnsHost);

        logEntry.status = result.success ? "sent" : "failed";
        logEntry.apns_response = JSON.stringify(result);

        if (result.success) {
          successCount++;
        } else {
          failCount++;
          // If token is invalid, mark registration
          if (result.status === 410 || result.reason === "Unregistered") {
            logEntry.error_message = "Token invalid/unregistered";
            await supabase
              .from("wallet_registrations")
              .delete()
              .eq("push_token", pushToken);
          }
        }

        pushResults.push({
          serial_number: reg.serial_number,
          device: reg.device_library_id,
          token_suffix: pushToken.slice(-8),
          timestamp: new Date().toISOString(),
          ...result,
        });
      } catch (err: any) {
        logEntry.status = "error";
        logEntry.error_message = String(err);
        failCount++;
        pushResults.push({
          serial_number: reg.serial_number,
          device: reg.device_library_id,
          token_suffix: pushToken.slice(-8),
          timestamp: new Date().toISOString(),
          success: false,
          error: String(err),
        });
      }

      // Log the attempt
      await supabase.from("wallet_apns_logs").insert(logEntry);
    }

    const testNotificationLog = act === "send_test_notification"
      ? {
          db_update_status: cardUpdateResults[0]?.updated ? "updated" : "failed",
          apns_http_status: pushResults[0]?.status ?? null,
          device_token_last8: pushResults[0]?.token_suffix ?? null,
          timestamp: new Date().toISOString(),
        }
      : null;

    return jsonResponse({
      success: true,
      action_type: act,
      total_registrations: registrations.length,
      unique_passes: serialNumbers.length,
      unique_devices: uniqueTokens.size,
      pushed: successCount,
      failed: failCount,
      card_updates: cardUpdateResults,
      apns_results: pushResults,
      ...(testNotificationLog ? { test_notification_log: testNotificationLog } : {}),
    }, 200);
  } catch (err: any) {
    console.error("[Wallet Push] Error:", err);
    return jsonResponse({ error: "Internal error", details: String(err) }, 500);
  }
});

// ── APNs JWT Token-Based Auth ─────────────────────────────────────

async function createApnsJwt(
  teamId: string,
  keyId: string,
  p8Key: string
): Promise<string> {
  // Clean the P8 key — handle literal "\n", PEM headers, and whitespace
  const pemContent = p8Key
    .replace(/\\n/g, "\n")                          // literal backslash-n → real newline
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/[\s\r\n]+/g, "");                     // strip all whitespace

  console.log(`[APNs JWT] Cleaned PEM length: ${pemContent.length} chars, first 20: "${pemContent.substring(0, 20)}", last 20: "${pemContent.substring(pemContent.length - 20)}"`);

  // Decode base64 — try standard atob first, fall back to manual
  let bin: Uint8Array;
  try {
    const std = pemContent.replace(/-/g, "+").replace(/_/g, "/");
    const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
    bin = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  } catch (e) {
    // If atob still fails, the key might have been double-encoded or contain invalid chars
    console.error(`[APNs JWT] atob failed, attempting manual decode. Error: ${e}`);
    // Try removing any non-base64 characters
    const cleaned = pemContent.replace(/[^A-Za-z0-9+/=]/g, "");
    console.log(`[APNs JWT] After extra cleaning: ${cleaned.length} chars`);
    const padded = cleaned + "=".repeat((4 - (cleaned.length % 4)) % 4);
    bin = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  }

  // Import as ECDSA P-256 key
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    bin,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // JWT header + payload
  const header = { alg: "ES256", kid: keyId };
  const payload = { iss: teamId, iat: Math.floor(Date.now() / 1000) };

  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Sign with ECDSA SHA-256
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  // crypto.subtle returns IEEE P1363 format (r || s), which is what JWT ES256 expects
  const sigB64 = base64urlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${headerB64}.${payloadB64}.${sigB64}`;
}

// ── APNs Push ─────────────────────────────────────────────────────

async function sendApnsPush(
  pushToken: string,
  topic: string,
  jwt: string,
  apnsHost: string
): Promise<{ success: boolean; status?: number; reason?: string }> {
  const apnsUrl = `https://${apnsHost}/3/device/${pushToken}`;

  console.log(`[APNs] POST ${apnsUrl} topic=${topic}`);

  // Apple Wallet pass update: send empty JSON payload
  // The push tells iOS to contact webServiceURL for updated passes
  const response = await fetch(apnsUrl, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": topic,
      "apns-push-type": "background",
      "apns-priority": "5",
    },
    body: "{}",
  });

  const status = response.status;
  let reason = "";

  if (status !== 200) {
    try {
      const body = await response.json();
      reason = body?.reason || "";
    } catch {
      reason = await response.text().catch(() => "unknown");
    }
    console.error(`[APNs] Failed: status=${status} reason=${reason}`);
    return { success: false, status, reason };
  }

  // Consume response body
  await response.text().catch(() => {});

  console.log(`[APNs] Success: status=${status} token=${pushToken.slice(0, 8)}...`);
  return { success: true, status };
}

// ── Helpers ───────────────────────────────────────────────────────

function base64urlEncode(str: string): string {
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

