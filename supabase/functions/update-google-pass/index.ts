// Edge function: Update Google Wallet loyalty passes via REST API
// Called after points change or during campaigns to keep Google Wallet passes in sync

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://fidelipros.lovable.app",
  ...(Deno.env.get("EXTRA_ALLOWED_ORIGINS") || "").split(",").filter(Boolean),
];
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

/** Constant-time string comparison to prevent timing attacks */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function base64urlEncode(data: string | Uint8Array): string {
  let b64: string;
  if (typeof data === "string") {
    b64 = btoa(unescape(encodeURIComponent(data)));
  } else {
    let binary = "";
    for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
    b64 = btoa(binary);
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, "")
    .replace(/-----END RSA PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buffer;
}

async function getGoogleAccessToken(serviceAccountEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    iss: serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const header = { alg: "RS256", typ: "JWT" };
  const headerEncoded = base64urlEncode(JSON.stringify(header));
  const payloadEncoded = base64urlEncode(JSON.stringify(jwtPayload));
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  const keyBuffer = pemToArrayBuffer(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${base64urlEncode(new Uint8Array(signature))}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google OAuth token exchange failed: ${err}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
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
    const serviceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const privateKeyPemRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
    const issuerId = Deno.env.get("GOOGLE_WALLET_ISSUER_ID");

    if (!serviceAccountEmail || !privateKeyPemRaw || !issuerId) {
      console.log("[update-google-pass] Google Wallet secrets not configured, skipping");
      return json({ skipped: true, reason: "Google Wallet not configured" });
    }

    const privateKeyPem = privateKeyPemRaw.replace(/\\n/g, "\n");

    // Auth: service_role or JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Non authentifié" }, 401);

    const supabase = createClient(sbUrl, sbKey, { auth: { persistSession: false } });

    const body = await req.json();
    const { business_id, card_ids, message } = body;

    if (!business_id) return json({ error: "business_id required" }, 400);

    const isServiceRole = safeEqual(token, sbKey);
    if (!isServiceRole) {
      const { data: userData, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !userData?.user) return json({ error: "Token invalide" }, 401);

      const { data: biz } = await supabase
        .from("businesses")
        .select("id")
        .eq("id", business_id)
        .eq("owner_id", userData.user.id)
        .maybeSingle();
      if (!biz) return json({ error: "Accès refusé" }, 403);
    }

    // Get business info
    const { data: business } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", business_id)
      .maybeSingle();

    if (!business) return json({ error: "Business not found" }, 404);

    // Get rewards
    const { data: rewards } = await supabase
      .from("rewards")
      .select("title, description, points_required")
      .eq("business_id", business_id)
      .eq("is_active", true)
      .order("points_required", { ascending: true });

    // Get cards to update
    let cardsQuery = supabase
      .from("customer_cards")
      .select("*, customers(*)")
      .eq("business_id", business_id);

    if (card_ids && card_ids.length > 0) {
      cardsQuery = cardsQuery.in("id", card_ids);
    }

    const { data: cards, error: cardsErr } = await cardsQuery;

    if (cardsErr || !cards || cards.length === 0) {
      return json({ success: true, updated: 0, reason: "No cards found" });
    }

    // Get Google access token
    const accessToken = await getGoogleAccessToken(serviceAccountEmail, privateKeyPem);

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const card of cards) {
      const customer = card.customers;
      const objectId = `${issuerId}.card_${card.id}`;
      const pointsCurrent = card.current_points || 0;
      const pointsMax = card.max_points || 10;
      const pointsToReward = pointsMax - pointsCurrent;

      // Build info module rows
      const infoModuleRows: any[] = [
        { columns: [{ label: business.loyalty_type === "stamps" ? "Tampons" : "Points", value: `${pointsCurrent} / ${pointsMax}` }] },
      ];

      if (rewards && rewards.length > 0) {
        const nextReward = rewards.find((r: any) => r.points_required > pointsCurrent) || rewards[0];
        if (nextReward) {
          infoModuleRows.push({
            columns: [{ label: "Prochaine récompense", value: nextReward.title }],
          });
        }
      }

      const updateBody: any = {
        loyaltyPoints: {
          balance: { int: pointsCurrent },
          label: business.loyalty_type === "stamps" ? "Tampons" : "Points",
        },
        accountName: customer?.full_name || "Client",
        infoModuleData: {
          labelValueRows: infoModuleRows,
          showLastUpdateTime: true,
        },
      };

      // Add campaign message if provided
      if (message) {
        updateBody.messages = [{
          header: business.name,
          body: message,
          id: `msg_${Date.now()}`,
          messageType: "TEXT",
        }];
      }

      try {
        // Try PATCH first (update existing object)
        const patchRes = await fetch(
          `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${objectId}`,
          {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updateBody),
          }
        );

        if (patchRes.ok) {
          updated++;
          console.log(`[update-google-pass] Updated ${objectId}`);
        } else if (patchRes.status === 404) {
          // Object doesn't exist yet (user hasn't added to Google Wallet), skip
          console.log(`[update-google-pass] Object ${objectId} not found, skipping (user hasn't added pass)`);
        } else {
          const errBody = await patchRes.text();
          console.error(`[update-google-pass] Failed to update ${objectId}: ${patchRes.status} ${errBody}`);
          errors.push(`${objectId}: ${patchRes.status}`);
          failed++;
        }
      } catch (err: any) {
        console.error(`[update-google-pass] Error updating ${objectId}:`, err.message);
        errors.push(`${objectId}: ${err.message}`);
        failed++;
      }
    }

    return json({
      success: true,
      updated,
      failed,
      total: cards.length,
      ...(errors.length > 0 ? { errors: errors.slice(0, 5) } : {}),
    });
  } catch (err: any) {
    console.error("[update-google-pass] Error:", err.message);
    return json({ error: "Internal error" }, 500);
  }
});
