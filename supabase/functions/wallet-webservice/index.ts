// Apple PassKit Web Service — handles device registration, pass updates
// Spec: https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import forge from "https://esm.sh/node-forge@1.3.1";
import JSZip from "https://esm.sh/jszip@3.10.1";

const PASS_TYPE_ID = Deno.env.get("APPLE_PASS_TYPE_ID") || "pass.app.lovable.fidelispro";

// Apple Worldwide Developer Relations Certification Authority G4
// Required in the PKCS7 signature chain for valid .pkpass files
const WWDR_G4_PEM = `-----BEGIN CERTIFICATE-----
MIIEVTCCAz2gAwIBAgIUE9x3lVJx5T3GMujM/+Uh88zFztIwDQYJKoZIhvcNAQEL
BQAwYjELMAkGA1UEBhMCVVMxEzARBgNVBAoTCkFwcGxlIEluYy4xJjAkBgNVBAsT
HUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRYwFAYDVQQDEw1BcHBsZSBS
b290IENBMB4XDTIwMTIxNjE5MzYwNFoXDTMwMTIxMDAwMDAwMFowdTFEMEIGA1UE
Aww7QXBwbGUgV29ybGR3aWRlIERldmVsb3BlciBSZWxhdGlvbnMgQ2VydGlmaWNh
dGlvbiBBdXRob3JpdHkxCzAJBgNVBAsMAkc0MRMwEQYDVQQKDApBcHBsZSBJbmMu
MQswCQYDVQQGEwJVUzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANAf
eKp6JzKwRl/nF3bYoJ0OKY6tPTKlxGs3yeRBkWq3eXFdDDQEYHX3rkOPR8SGHgjo
v9Y5Ui8eZ/xx8YJtPH4GUnadLLzVQ+mxtLxAOnhRXVGhJeG+bJGdayFZGEHVD41t
QSo5SiHgkJ9OE0/QjJoyuNdqkh4laqQyziIZhQVg3AJK8lrrd3kCfcCXVGySjnYB
5kaP5eYq+6KwrRitbTOFOCOL6oqW7Z+uZk+jDEAnbZXQYojZQykn/e2kv1MukBVl
PNkuYmQzHWxq3Y4hqqRfFcYw7V/mjDaSlLfcOQIA+2SM1AyB8j/VNJeHdSbCb64D
YyEMe9QbsWLFApy9/a8CAwEAAaOB7zCB7DASBgNVHRMBAf8ECDAGAQH/AgEAMB8G
A1UdIwQYMBaAFCvQaUeUdgn+9GuNLkCm90dNfwheMEQGCCsGAQUFBwEBBDgwNjA0
BggrBgEFBQcwAYYoaHR0cDovL29jc3AuYXBwbGUuY29tL29jc3AwMy1hcHBsZXJv
b3RjYTAuBgNVHR8EJzAlMCOgIaAfhh1odHRwOi8vY3JsLmFwcGxlLmNvbS9yb290
LmNybDAdBgNVHQ4EFgQUW9n6HeeaGgujmXYiUIY+kchbd6gwDgYDVR0PAQH/BAQD
AgEGMBAGCiqGSIb3Y2QGAgEEAgUAMA0GCSqGSIb3DQEBCwUAA4IBAQA/Vj2e5bbD
eeZFIGi9v3OLLBKeAuOugCKMBB7DUshwgKj7zqew1UJEggOCTwb8O0kU+9h0UoWv
p50h5wESA5/NQFjQAde/MoMrU1goPO6cn1R2PWQnxn6NHThNLa6B5rmluJyJlPef
x4elUWY0GzlxOSTjh2fvpbFoe4zuPfeutnvi0v/fYcZqdUmVIkSoBPyUuAsuORFJ
EtHlgepZAE9bPFo22noicwkJac3AfOriJP6YRLj477JxPxpd1F1+M02cHSS+APCQ
A1iZQT0xWmJArzmoUUOSqwSonMJNsUvSq3xKX+udO7xPiEAGE/+QF4oIRynoYpgp
pU8RBWk6z/Kf
-----END CERTIFICATE-----`;

const ICON_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAB0AAAAdCAYAAABWk2cPAAAAgklEQVR4nGPkF9f6z0BnwERvCwfMUhZcEh9eXL1LqeECEtrK2MSx+pQaFuIzhxE9ISErxOVSUi1EN4eJWIWkAmT96D7GGryUWkjInJGTZUYtHbV01NJRS0ctHSSW0rrlgGIpvoqXEgvR61WM5go1LEQG2CryAWk5YPUprcHgSb20BgDttTV1QCPBRwAAAABJRU5ErkJggg==";

const ICON_2X_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAADoAAAA6CAYAAADhu0ooAAAA7ElEQVR4nO2aOxLCMAxECUMPHenp4P5HoaSn5AZJReMJjj7Bclb7eo/1Zh2lkIbz9T4dEnCMLqAVFEWDomikET15Dn/ez9dWhUi4jI+b9exg+Y+2FiyxCKufbrSktQZxoj0ILiFNN00zEiVaS9PTIDR4a1gV/XVBK8ESaz2mpxsl6bm7KtprA1pirVZ1opFpempI03UpigZF0aAoGhRFg6JoUBQNiqJBUTQoigZF0aAoGhRFI80guCraw/hByl+maZGpWu/mIFhzUSTcYShQ7xn1kqz2k0kzCDZtjn2BX5HbI2maEUXRoCgaaURn7+ldg7yB9K8AAAAASUVORK5CYII=";

/**
 * Clean image URL — only strip Supabase storage cache-busting ?t= params.
 * Preserve all other query params (needed for Google Images, CDN, etc.)
 */
function cleanImageUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has("t") && u.searchParams.size === 1) {
      u.searchParams.delete("t");
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const rawPathname = url.pathname;

  // ── GLOBAL REQUEST LOG — fires on every single request ──────────────────
  const allHeaders: Record<string, string> = {};
  req.headers.forEach((v, k) => { allHeaders[k] = k.toLowerCase() === "authorization" ? v.slice(0, 30) + "..." : v; });
  console.log(`[PassKit WS] ════ INCOMING REQUEST ════`);
  console.log(`[PassKit WS]   method=${req.method}`);
  console.log(`[PassKit WS]   url=${req.url}`);
  console.log(`[PassKit WS]   rawPathname=${rawPathname}`);
  console.log(`[PassKit WS]   headers=${JSON.stringify(allHeaders)}`);

  // ── Diagnostic ping — call GET /ping to confirm function is alive ────────
  if (req.method === "GET" && rawPathname.endsWith("/ping")) {
    const config = {
      alive: true,
      timestamp: new Date().toISOString(),
      has_p12: !!Deno.env.get("APPLE_PASS_CERTIFICATE"),
      has_team_id: !!Deno.env.get("APPLE_TEAM_ID"),
      has_service_role: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    };
    console.log(`[PassKit WS] PING →`, JSON.stringify(config));
    return new Response(JSON.stringify(config, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // Supabase Edge Functions receive the full URL pathname, e.g.:
  //   /functions/v1/wallet-webservice/v1/devices/{id}/registrations/{passType}/{serial}
  // Strip the Supabase function prefix to isolate the Apple PassKit sub-path.
  const pathParts = rawPathname
    .replace(/^\/functions\/v1\/wallet-webservice\/?/, "")  // Supabase standard prefix
    .replace(/^\/wallet-webservice\/?/, "")                  // Fallback: function-name only
    .replace(/^\//, "");                                      // Remove any remaining leading slash
  const segments = pathParts.split("/").filter(Boolean);

  console.log(`[PassKit WS]   pathParts="${pathParts}" segments=[${segments.join(",")}]`);
  console.log(`[PassKit WS]   Authorization=${req.headers.get("Authorization")?.slice(0, 30)}...`);

  // Route: POST /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}
  if (req.method === "POST" && segments[0] === "v1" && segments[1] === "devices" && segments[3] === "registrations") {
    return handleRegisterDevice(req, segments[2], segments[4], segments[5]);
  }

  // Route: DELETE /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}
  if (req.method === "DELETE" && segments[0] === "v1" && segments[1] === "devices" && segments[3] === "registrations") {
    return handleUnregisterDevice(req, segments[2], segments[4], segments[5]);
  }

  // Route: GET /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}?passesUpdatedSince=...
  if (req.method === "GET" && segments[0] === "v1" && segments[1] === "devices" && segments[3] === "registrations") {
    return handleGetSerialNumbers(segments[2], segments[4], url);
  }

  // Route: GET /v1/passes/{passTypeIdentifier}/{serialNumber}
  if (req.method === "GET" && segments[0] === "v1" && segments[1] === "passes") {
    return handleGetLatestPass(req, segments[2], segments[3]);
  }

  // Route: POST /v1/log
  if (req.method === "POST" && segments[0] === "v1" && segments[1] === "log") {
    const body = await req.json().catch(() => ({}));
    console.log("[PassKit WS] Device log:", JSON.stringify(body));
    return new Response("", { status: 200 });
  }

  console.log(`[PassKit WS] ✗ No route matched — method=${req.method} segments=[${segments.join(",")}]`);
  return new Response("Not found", { status: 404 });
});

// ── Register device ────────────────────────────────────────────────

async function handleRegisterDevice(
  req: Request,
  deviceLibraryId: string,
  passTypeId: string,
  serialNumber: string
): Promise<Response> {
  console.log(`[PassKit WS] ── REGISTER device=${deviceLibraryId?.slice(0, 12)}... pass=${passTypeId} serial=${serialNumber}`);

  const authToken = extractAuthToken(req);
  if (!authToken) {
    console.log("[PassKit WS]   ✗ No ApplePass auth token in header");
    return new Response("Unauthorized", { status: 401 });
  }
  console.log(`[PassKit WS]   authToken present, length=${authToken.length}`);

  const supabase = getSupabase();

  const { data: card, error: cardErr } = await supabase
    .from("customer_cards")
    .select("id, business_id, customer_id, wallet_auth_token")
    .eq("id", serialNumber)
    .maybeSingle();

  if (cardErr) {
    console.error("[PassKit WS]   ✗ DB error fetching card:", cardErr.message);
    return new Response("Server error", { status: 500 });
  }
  if (!card) {
    console.log(`[PassKit WS]   ✗ No card found for serialNumber=${serialNumber}`);
    return new Response("Unauthorized", { status: 401 });
  }
  if (!card.wallet_auth_token || card.wallet_auth_token !== authToken) {
    console.log(`[PassKit WS]   ✗ Auth token MISMATCH or NULL`);
    console.log(`[PassKit WS]     DB wallet_auth_token IS NULL: ${card.wallet_auth_token === null}`);
    return new Response("Unauthorized", { status: 401 });
  }
  console.log(`[PassKit WS]   ✓ Auth token MATCH (len=${authToken.length})`);
  console.log(`[PassKit WS]   ✓ Card found, business=${card.business_id}`);

  const body = await req.json().catch(() => ({}));
  const pushToken = body?.pushToken;
  if (!pushToken) {
    console.log("[PassKit WS]   ✗ Missing pushToken in request body");
    return new Response("Missing pushToken", { status: 400 });
  }
  console.log(`[PassKit WS]   pushToken present, suffix=...${pushToken.slice(-8)}`);

  const { error } = await supabase.from("wallet_registrations").upsert(
    {
      device_library_id: deviceLibraryId,
      pass_type_id: passTypeId,
      serial_number: serialNumber,
      push_token: pushToken,
      authentication_token: authToken,
      customer_id: card.customer_id,
      business_id: card.business_id,
      card_id: card.id,
    },
    { onConflict: "device_library_id,pass_type_id,serial_number" }
  );

  if (error) {
    console.error("[PassKit WS]   ✗ Upsert error:", error.message, error.code);
    return new Response("Server error", { status: 500 });
  }
  console.log(`[PassKit WS]   ✓ Registration upserted successfully`);

  await supabase
    .from("customer_cards")
    .update({ wallet_installed_at: new Date().toISOString() })
    .eq("id", card.id);

  // ── Notification de bienvenue automatique ───────────────────────────
  try {
    const { data: business } = await supabase
      .from("businesses")
      .select("welcome_push_enabled, welcome_push_message, name")
      .eq("id", card.business_id)
      .single();

    if (business?.welcome_push_enabled !== false) {
      const welcomeMsg = business?.welcome_push_message ||
        `Bienvenue chez ${business?.name || "nous"} ! Votre carte de fidélité est prête 🎉`;

      // Petit délai pour laisser iOS finir l'enregistrement du pass
      await new Promise((r) => setTimeout(r, 3000));

      const sbUrl = Deno.env.get("SUPABASE_URL")!;
      const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const pushRes = await fetch(`${sbUrl}/functions/v1/wallet-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sbKey}`,
        },
        body: JSON.stringify({
          business_id: card.business_id,
          card_ids: [card.id],
          change_message: welcomeMsg,
          action_type: "campaign",
        }),
      });
      const pushData = await pushRes.json().catch(() => ({}));
      console.log(`[PassKit WS] ✓ Welcome push sent: pushed=${pushData.pushed || 0}`);
    }
  } catch (welcomeErr) {
    console.error(`[PassKit WS] Welcome push error (non-blocking):`, welcomeErr);
  }

  console.log(`[PassKit WS] Device registered successfully`);
  return new Response("", { status: 201 });
}

// ── Unregister device ──────────────────────────────────────────────

async function handleUnregisterDevice(
  req: Request,
  deviceLibraryId: string,
  passTypeId: string,
  serialNumber: string
): Promise<Response> {
  console.log(`[PassKit WS] Unregister device=${deviceLibraryId} serial=${serialNumber}`);

  const authToken = extractAuthToken(req);
  if (!authToken) return new Response("Unauthorized", { status: 401 });

  const supabase = getSupabase();

  const { error } = await supabase
    .from("wallet_registrations")
    .delete()
    .eq("device_library_id", deviceLibraryId)
    .eq("pass_type_id", passTypeId)
    .eq("serial_number", serialNumber);

  if (error) console.error("[PassKit WS] Unregister error:", error);

  return new Response("", { status: 200 });
}

// ── Get updated serial numbers ─────────────────────────────────────

async function handleGetSerialNumbers(
  deviceId: string,
  passTypeId: string,
  url: URL
): Promise<Response> {
  const rawSince = url.searchParams.get("passesUpdatedSince");
  const since = normalizePassesUpdatedSince(rawSince);
  console.log(`[PassKit WS] Get serials device=${deviceId} rawSince=${rawSince} normalized=${since}`);

  const supabase = getSupabase();

  let query = supabase
    .from("wallet_registrations")
    .select("serial_number, updated_at")
    .eq("device_library_id", deviceId)
    .eq("pass_type_id", passTypeId);

  if (since) {
    query = query.gt("updated_at", since);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[PassKit WS] Get serials error:", error);
    return new Response("Server error", { status: 500 });
  }

  if (!data || data.length === 0) {
    console.log("[PassKit WS] No updated serials found → 204");
    return new Response(null, { status: 204 });
  }

  // Use the max updated_at from results as the update tag (not current time)
  // This prevents the device from missing updates that happen between query and response
  const maxUpdated = data.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), data[0].updated_at);

  const response = {
    serialNumbers: data.map((r) => r.serial_number),
    lastUpdated: maxUpdated,
  };

  console.log(`[PassKit WS] Returning ${data.length} serial(s) → 200`, response);

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizePassesUpdatedSince(value: string | null): string | null {
  if (!value) return null;
  // URLSearchParams turns '+' into ' ' in timezone offsets like +00:00
  let normalized = value.replace(/\s(\d{2}:\d{2})$/, "+$1");
  // Also handle case where the whole thing got mangled
  try {
    const d = new Date(normalized);
    if (isNaN(d.getTime())) {
      console.log(`[PassKit WS] Could not parse passesUpdatedSince: ${value}, returning null to fetch all`);
      return null;
    }
    return d.toISOString();
  } catch {
    return null;
  }
}

// ── Get latest pass ────────────────────────────────────────────────

async function handleGetLatestPass(
  req: Request,
  passTypeId: string,
  serialNumber: string
): Promise<Response> {
  console.log(`[PassKit WS] Get latest pass type=${passTypeId} serial=${serialNumber}`);

  const authToken = extractAuthToken(req);
  if (!authToken) return new Response("Unauthorized", { status: 401 });

  const supabase = getSupabase();

  const { data: card } = await supabase
    .from("customer_cards")
    .select("*, customers(*)")
    .eq("id", serialNumber)
    .maybeSingle();

  if (!card || card.wallet_auth_token !== authToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", card.business_id)
    .maybeSingle();

  if (!business) return new Response("Not found", { status: 404 });

  // Fetch active rewards for this business (same as generate-pass)
  const { data: rewards } = await supabase
    .from("rewards")
    .select("title, description, points_required")
    .eq("business_id", card.business_id)
    .eq("is_active", true)
    .order("points_required", { ascending: true });

  // Fetch claimed reward IDs for this card from reward_instances
  const { data: claimedInstances } = await supabase
    .from("reward_instances")
    .select("reward_id")
    .eq("card_id", card.id)
    .eq("status", "claimed");
  const claimedRewardIds = new Set((claimedInstances || []).map((c: any) => c.reward_id));

  await supabase
    .from("customer_cards")
    .update({
      wallet_last_fetched_at: new Date().toISOString(),
      wallet_change_message: null, // Clear campaign message after iOS fetches the pass
    })
    .eq("id", card.id);

  try {
    const pkpass = await buildPkpassForUpdate(card, business, card.customers, card.wallet_auth_token, rewards || [], claimedRewardIds);
    return new Response(pkpass as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Last-Modified": new Date().toUTCString(),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: any) {
    console.error("[PassKit WS] Error building pass:", err);
    return new Response("Server error", { status: 500 });
  }
}

// ── Build pkpass (same logic as generate-pass, with logo + strip) ──

async function buildPkpassForUpdate(
  card: any,
  business: any,
  customer: any,
  authToken: string,
  rewards: any[] = [],
  claimedRewardIds: Set<string> = new Set()
): Promise<Uint8Array> {
  const teamId = (Deno.env.get("APPLE_TEAM_ID") || "").trim();
  if (!teamId) throw new Error("APPLE_TEAM_ID is not configured");
  const p12Base64 = Deno.env.get("APPLE_PASS_CERTIFICATE")!;
  const p12Password = Deno.env.get("APPLE_PASS_PASSWORD")!;

  const { signerCert, signerKey, certificateChain } = extractSigningMaterial(p12Base64, p12Password);
  const wwdrCert = forge.pki.certificateFromPem(WWDR_G4_PEM);

  // Fetch business logo for icons and logo
  const { iconPng, icon2xPng, icon3xPng } = await fetchOrGenerateIcons(business);
  const { logoPng, logo2xPng } = await fetchOrGenerateLogo(business);
  const { stripPng, strip2xPng } = await fetchOrGenerateStrip(business, card);

  const bgColor = hexToRgb(business.primary_color || "#6B46C1");
  const fgColor = business.foreground_color ? hexToRgb(business.foreground_color) : autoForeground(business.primary_color || "#6B46C1");
  const lblColor = business.label_color ? hexToRgb(business.label_color) : autoLabelColor(business.primary_color || "#6B46C1");
  const level = (customer?.level || "bronze").toLowerCase();
  const pointsCurrent = card.current_points || 0;
  const pointsMax = card.max_points || 10;
  const pointsToReward = pointsMax - pointsCurrent;
  const latestOffer = card.wallet_change_message || "";
  const levelEmoji = level === "gold" ? "⭐" : level === "silver" ? "🥈" : "🥉";

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  const passJson: any = {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE_ID,
    serialNumber: card.id,
    teamIdentifier: teamId,
    organizationName: business.name,
    description: `Carte de fidélité ${business.name}`,
    logoText: business.name,
    foregroundColor: fgColor,
    backgroundColor: bgColor,
    labelColor: lblColor,
    webServiceURL: `${supabaseUrl}/functions/v1/wallet-webservice`,
    authenticationToken: authToken,
    barcode: { message: card.card_code, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1" },
    barcodes: [{ message: card.card_code, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1" }],
    storeCard: {
      headerFields: [
        {
          key: "points",
          label: business.loyalty_type === "stamps" ? "TAMPONS" : business.loyalty_type === "cashback" ? "CAGNOTTE" : business.loyalty_type === "subscription" ? "PLAN" : "POINTS",
          value: business.loyalty_type === "cashback" ? `${pointsCurrent},00 €` : business.loyalty_type === "subscription" ? "Premium ✓" : pointsCurrent,
          textAlignment: "PKTextAlignmentRight",
          changeMessage: business.loyalty_type === "cashback" ? "💰 Cagnotte mise à jour : %@" : business.loyalty_type === "stamps" ? "✅ Tampons mis à jour : %@" : "⭐ Points mis à jour : %@",
        },
      ],
      primaryFields: [],
      secondaryFields: [
        { key: "member", label: "MEMBRE", value: customer?.full_name || "Client" },
        { key: "reward", label: "RÉCOMPENSE", value: `${card.rewards_earned || 0}`, textAlignment: "PKTextAlignmentRight" },
      ],
      auxiliaryFields: [
        ...(rewards.length > 0 ? (() => {
          const unclaimedUnlocked = [...rewards].reverse().find((r: any) => r.points_required <= pointsCurrent && !claimedTitles.includes(r.title));
          const nextReward = rewards.find((r: any) => r.points_required > pointsCurrent);
          const fields: any[] = [];
          if (unclaimedUnlocked) {
            fields.push({
              key: "unlocked_reward",
              label: "🎉 À RÉCUPÉRER",
              value: unclaimedUnlocked.title,
            });
          }
          if (nextReward) {
            fields.push({
              key: "next_reward",
              label: "PROCHAINE RÉCOMPENSE",
              value: nextReward.title,
            });
          }
          return fields;
        })() : business.reward_description ? [{
          key: "next_reward",
          label: "RÉCOMPENSE",
          value: business.reward_description,
        }] : []),
      ],
      backFields: [
        ...(latestOffer ? [{
          key: "latest_offer",
          label: "📢 Dernière notification",
          value: latestOffer,
          changeMessage: "%@",
        }] : []),
        {
          key: "reward_info",
          label: "🎁 Récompense",
          value: business.reward_description || "Récompense offerte !",
        },
        ...(rewards.length > 0 ? [{
          key: "rewards_catalog",
          label: "🏆 Récompenses disponibles",
          value: rewards.map((r: any) => `• ${r.title} — ${r.points_required} ${business.loyalty_type === "stamps" ? "tampons" : "pts"}${r.description ? ` (${r.description})` : ""}`).join("\n"),
        }] : []),
        {
          key: "stats",
          label: "📊 Statistiques",
          value: `Points : ${pointsCurrent}/${pointsMax}\nVisites : ${customer?.total_visits || 0}\nNiveau : ${level.toUpperCase()}\nStreak : ${customer?.current_streak || 0} jours`,
        },
        {
          key: "info",
          label: "ℹ️ À propos",
          value: `Programme de fidélité ${business.name}.\n${business.address ? `Adresse : ${business.address}` : ""}\n${business.phone ? `Tél : ${business.phone}` : ""}`.trim(),
        },
        { key: "powered", label: "", value: "Propulsé par FidéliPro" },
      ],
    },
  };

  // Apple Wallet native geofencing with satellite points
  if (business.geofence_enabled && business.latitude && business.longitude) {
    const lat = parseFloat(String(business.latitude));
    const lng = parseFloat(String(business.longitude));
    const relevantText = business.geofence_message || `Passez nous voir chez ${business.name} !`;

    const locations: any[] = [{ latitude: lat, longitude: lng, relevantText }];

    // Add manually placed satellite points
    const satellites = Array.isArray(business.geofence_satellite_points) ? business.geofence_satellite_points : [];
    for (const pt of satellites) {
      if (pt?.lat && pt?.lng && locations.length < 10) {
        locations.push({
          latitude: parseFloat(String(pt.lat)),
          longitude: parseFloat(String(pt.lng)),
          relevantText,
        });
      }
    }

    passJson.locations = locations;
    passJson.maxDistance = business.geofence_radius || 200;
  }

  const passJsonStr = JSON.stringify(passJson);
  const passJsonBytes = new TextEncoder().encode(passJsonStr);

  const manifest: Record<string, string> = {
    "pass.json": sha1Hex(passJsonBytes),
    "icon.png": sha1Hex(iconPng),
    "icon@2x.png": sha1Hex(icon2xPng),
    "icon@3x.png": sha1Hex(icon3xPng),
    "logo.png": sha1Hex(logoPng),
    "logo@2x.png": sha1Hex(logo2xPng),
    "strip.png": sha1Hex(stripPng),
    "strip@2x.png": sha1Hex(strip2xPng),
  };
  const manifestStr = JSON.stringify(manifest);
  const manifestBytes = new TextEncoder().encode(manifestStr);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestStr, "utf8");
  p7.addCertificate(signerCert);
  p7.addCertificate(wwdrCert); // WWDR G4 required in Apple Wallet signature chain
  for (const cert of certificateChain) p7.addCertificate(cert);
  p7.addSigner({
    key: signerKey,
    certificate: signerCert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign({ detached: true });

  const sigDer = forge.asn1.toDer(p7.toAsn1()).getBytes();
  const sigBytes = new Uint8Array(sigDer.length);
  for (let i = 0; i < sigDer.length; i++) sigBytes[i] = sigDer.charCodeAt(i);

  const zip = new JSZip();
  zip.file("pass.json", passJsonBytes);
  zip.file("manifest.json", manifestBytes);
  zip.file("signature", sigBytes);
  zip.file("icon.png", iconPng);
  zip.file("icon@2x.png", icon2xPng);
  zip.file("icon@3x.png", icon3xPng);
  zip.file("logo.png", logoPng);
  zip.file("logo@2x.png", logo2xPng);
  zip.file("strip.png", stripPng);
  zip.file("strip@2x.png", strip2xPng);

  return zip.generateAsync({ type: "uint8array" });
}

// ── Icon helpers (square, for notification icon) ─────────────────

async function fetchOrGenerateIcons(business: any): Promise<{ iconPng: Uint8Array; icon2xPng: Uint8Array; icon3xPng: Uint8Array }> {
  if (business.logo_url) {
    try {
      const logoUrl = cleanImageUrl(business.logo_url);
      console.log("[Pass WS] Fetching logo for icons:", logoUrl);
      const response = await fetch(logoUrl);
      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.startsWith("image/")) {
          console.error("[Pass WS] Icon fetch returned non-image content-type:", contentType);
        } else {
          const imageBytes = new Uint8Array(await response.arrayBuffer());
          console.log("[Pass WS] Icon image fetched:", imageBytes.byteLength, "bytes");
          if (imageBytes.byteLength <= 100_000) {
            return { iconPng: imageBytes, icon2xPng: imageBytes, icon3xPng: imageBytes };
          }
          console.warn("[Pass WS] Icon image too large (" + imageBytes.byteLength + " bytes), using fallback");
        }
      } else {
        console.error(`[Pass WS] Icon fetch failed: HTTP ${response.status} for ${logoUrl}`);
      }
    } catch (err) {
      console.error("[Pass WS] Failed to fetch logo for icons, using fallback:", err);
    }
  }
  const color = business.primary_color || "#6B46C1";
  const iconPng   = generateSolidColorPng(29, 29, color);
  const icon2xPng = generateSolidColorPng(58, 58, color);
  const icon3xPng = generateSolidColorPng(87, 87, color);
  return { iconPng, icon2xPng, icon3xPng };
}

// ── Logo helpers (rectangular, shown on card front) ──────────────

async function fetchOrGenerateLogo(business: any): Promise<{ logoPng: Uint8Array; logo2xPng: Uint8Array }> {
  if (business.logo_url) {
    try {
      const logoUrl = cleanImageUrl(business.logo_url);
      console.log("[Pass WS] Fetching logo:", logoUrl);
      const response = await fetch(logoUrl);
      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.startsWith("image/")) {
          console.error("[Pass WS] Logo fetch returned non-image content-type:", contentType);
        } else {
          const imageBytes = new Uint8Array(await response.arrayBuffer());
          console.log("[Pass WS] Logo fetched:", imageBytes.byteLength, "bytes");
          if (imageBytes.byteLength <= 100_000) {
            return { logoPng: imageBytes, logo2xPng: imageBytes };
          }
          console.warn("[Pass WS] Logo image too large (" + imageBytes.byteLength + " bytes), using fallback");
        }
      } else {
        console.error(`[Pass WS] Logo fetch failed: HTTP ${response.status} for ${logoUrl}`);
      }
    } catch (err) {
      console.error("[Pass WS] Failed to fetch logo, using fallback:", err);
    }
  }
  const logoPng = generateSolidColorPng(160, 50, business.primary_color || "#6B46C1");
  const logo2xPng = generateSolidColorPng(320, 100, business.primary_color || "#6B46C1");
  return { logoPng, logo2xPng };
}

// ── Strip image — use card_bg_image_url if available, else generate visual ─────

const MAX_STRIP_BYTES = 800_000;

async function fetchOrGenerateStrip(business: any, card: any): Promise<{ stripPng: Uint8Array; strip2xPng: Uint8Array }> {
  const loyaltyType = business.loyalty_type || "stamps";
  const current = card.current_points || 0;
  const max = card.max_points || 10;

  // For stamp-type cards, ALWAYS generate the visual strip with stamp circles
  if (loyaltyType !== "stamps" && business.card_bg_image_url) {
    try {
      const imgUrl = cleanImageUrl(business.card_bg_image_url);
      console.log("[Pass WS] Fetching strip image:", imgUrl);
      const response = await fetch(imgUrl);
      if (response.ok) {
        const imageBytes = new Uint8Array(await response.arrayBuffer());
        console.log("[Pass WS] Strip image fetched:", imageBytes.byteLength, "bytes");
        if (imageBytes.byteLength <= MAX_STRIP_BYTES) {
          return { stripPng: imageBytes, strip2xPng: imageBytes };
        }
        console.warn(`[Pass WS] Strip image too large (${imageBytes.byteLength} bytes > ${MAX_STRIP_BYTES}), using generated`);
      } else {
        console.error(`[Pass WS] Strip fetch failed: HTTP ${response.status} for ${imgUrl}`);
      }
    } catch (err) {
      console.error("[Pass WS] Failed to fetch strip image:", err);
    }
  }

  if (loyaltyType === "stamps") {
    console.log("[Pass WS] Generating stamp-visual strip (stamps mode)");
  }

  const hexColor = business.primary_color || "#6B46C1";
  const stripPng = generateStripWithVisuals(320, 123, hexColor, loyaltyType, current, max);
  const strip2xPng = generateStripWithVisuals(640, 246, hexColor, loyaltyType, current, max);
  return { stripPng, strip2xPng };
}

// ── Strip with stamp circles or progress bar (same as generate-pass) ──

interface StampCircle { cx: number; cy: number; radius: number; filled: boolean; }
interface ProgressBarDef { x: number; y: number; w: number; h: number; fillRatio: number; }

function generateStripWithVisuals(
  width: number, height: number, hexColor: string,
  loyaltyType: string, current: number, max: number
): Uint8Array {
  const hex = /^#[0-9A-Fa-f]{6}$/.test(hexColor) ? hexColor : "#6B46C1";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const rawData: number[] = [];
  const scale = width / 320;

  const stamps = loyaltyType === "stamps" ? buildStampPositions(width, height, current, max, scale) : null;
  const progressBar = (loyaltyType === "points" || loyaltyType === "cashback")
    ? buildProgressBar(width, height, current, max, scale) : null;

  for (let y = 0; y < height; y++) {
    rawData.push(0);
    for (let x = 0; x < width; x++) {
      const gradientDarken = Math.floor((y / height) * 25);
      let pr = Math.max(0, r - gradientDarken);
      let pg = Math.max(0, g - gradientDarken);
      let pb = Math.max(0, b - gradientDarken);

      // Subtle dot pattern
      if (isDotPixel(x, y, scale)) {
        pr = Math.min(255, pr + 12);
        pg = Math.min(255, pg + 12);
        pb = Math.min(255, pb + 12);
      }

      if (stamps) {
        const stampResult = getStampPixel(x, y, stamps, pr, pg, pb);
        if (stampResult) { pr = stampResult.r; pg = stampResult.g; pb = stampResult.b; }
      } else if (progressBar) {
        const barResult = getProgressPixel(x, y, progressBar, pr, pg, pb);
        if (barResult) { pr = barResult.r; pg = barResult.g; pb = barResult.b; }
      }

      rawData.push(pr, pg, pb, 255);
    }
  }

  return buildPngFromRaw(width, height, new Uint8Array(rawData));
}

function buildStampPositions(w: number, h: number, current: number, max: number, scale: number): StampCircle[] {
  const circles: StampCircle[] = [];
  const count = Math.min(max, 12);
  const maxPerRow = count <= 5 ? count : count <= 10 ? 5 : 6;
  const rows = Math.ceil(count / maxPerRow);
  const radius = Math.floor((rows > 1 ? 12 : 18) * scale);
  const rowSpacing = Math.floor(h / (rows + 1));

  let idx = 0;
  for (let row = 0; row < rows; row++) {
    const itemsInRow = Math.min(maxPerRow, count - idx);
    const colSpacing = Math.floor(w / (itemsInRow + 1));
    const cy = rowSpacing * (row + 1);
    for (let col = 0; col < itemsInRow; col++) {
      circles.push({ cx: colSpacing * (col + 1), cy, radius, filled: idx < current });
      idx++;
    }
  }
  return circles;
}

function getStampPixel(x: number, y: number, stamps: StampCircle[], bgR: number, bgG: number, bgB: number) {
  for (const s of stamps) {
    const dx = x - s.cx;
    const dy = y - s.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const borderWidth = Math.max(2, Math.floor(s.radius * 0.15));

    if (s.filled) {
      if (dist <= s.radius) return { r: 255, g: 255, b: 255 };
      if (dist <= s.radius + 2) return { r: Math.min(255, bgR + 80), g: Math.min(255, bgG + 80), b: Math.min(255, bgB + 80) };
    } else {
      if (dist <= s.radius && dist > s.radius - borderWidth) return { r: 255, g: 255, b: 255 };
      if (dist <= s.radius - borderWidth) return { r: Math.min(255, bgR + 15), g: Math.min(255, bgG + 15), b: Math.min(255, bgB + 15) };
    }
  }
  return null;
}

function buildProgressBar(canvasW: number, canvasH: number, current: number, max: number, scale: number): ProgressBarDef {
  const barH = Math.floor(30 * scale);
  const margin = Math.floor(25 * scale);
  return {
    x: margin,
    y: Math.floor(canvasH / 2) - Math.floor(barH / 2),
    w: canvasW - margin * 2,
    h: barH,
    fillRatio: Math.min(1, max > 0 ? current / max : 0),
  };
}

// Subtle dot pattern on background for visual richness
function isDotPixel(x: number, y: number, scale: number): boolean {
  const spacing = Math.floor(16 * scale);
  const dotRadius = Math.floor(1.5 * scale);
  const offsetRow = Math.floor(y / spacing) % 2 === 1 ? Math.floor(spacing / 2) : 0;
  const cx = ((x + offsetRow) % spacing);
  const cy = (y % spacing);
  const dx = cx - Math.floor(spacing / 2);
  const dy = cy - Math.floor(spacing / 2);
  return (dx * dx + dy * dy) <= (dotRadius * dotRadius);
}

function getProgressPixel(x: number, y: number, bar: ProgressBarDef, bgR: number, bgG: number, bgB: number) {
  const fillWidth = bar.w * bar.fillRatio;
  const barRadius = Math.floor(bar.h / 2);

  // Glow effect around the filled portion of the bar
  if (bar.fillRatio > 0) {
    const glowRadius = Math.floor(bar.h * 0.8);
    const barCenterY = bar.y + bar.h / 2;
    const fillEndX = bar.x + fillWidth;
    // Only glow near the bar area
    if (y >= bar.y - glowRadius && y <= bar.y + bar.h + glowRadius &&
        x >= bar.x - glowRadius && x <= fillEndX + glowRadius) {
      const dy = Math.abs(y - barCenterY);
      const maxDist = barRadius + glowRadius;
      if (dy > barRadius && dy <= maxDist && x >= bar.x && x <= fillEndX) {
        const glowStrength = 1 - (dy - barRadius) / glowRadius;
        const boost = Math.floor(30 * glowStrength * glowStrength);
        return { r: Math.min(255, bgR + boost), g: Math.min(255, bgG + boost), b: Math.min(255, bgB + boost) };
      }
    }
  }

  if (x >= bar.x && x <= bar.x + bar.w && y >= bar.y && y <= bar.y + bar.h) {
    // Rounded ends check
    const relX = x - bar.x;
    const relY = y - bar.y;
    const centerY = bar.h / 2;

    // Left rounded end
    if (relX < barRadius) {
      const dx = relX - barRadius;
      const dy = relY - centerY;
      if (dx * dx + dy * dy > barRadius * barRadius) return null;
    }
    // Right rounded end
    if (relX > bar.w - barRadius) {
      const dx = relX - (bar.w - barRadius);
      const dy = relY - centerY;
      if (dx * dx + dy * dy > barRadius * barRadius) return null;
    }

    if (relX <= fillWidth) {
      // Filled portion: white with subtle inner gradient (brighter at top)
      const gradientBoost = Math.floor((1 - relY / bar.h) * 30);
      const v = Math.min(255, 225 + gradientBoost);
      return { r: v, g: v, b: v };
    }
    // Unfilled portion: subtle outline
    return { r: Math.min(255, bgR + 35), g: Math.min(255, bgG + 35), b: Math.min(255, bgB + 35) };
  }
  return null;
}

function generateSolidColorPng(width: number, height: number, hexColor: string): Uint8Array {
  const hex = /^#[0-9A-Fa-f]{6}$/.test(hexColor) ? hexColor : "#6B46C1";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const rawData: number[] = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0);
    for (let x = 0; x < width; x++) {
      rawData.push(r, g, b, 255);
    }
  }

  return buildPngFromRaw(width, height, new Uint8Array(rawData));
}

function buildPngFromRaw(width: number, height: number, rawBytes: Uint8Array): Uint8Array {
  const compressed = deflateRaw(rawBytes);
  const chunks: Uint8Array[] = [];
  chunks.push(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));

  const ihdr = new Uint8Array(13);
  writeUint32BE(ihdr, 0, width);
  writeUint32BE(ihdr, 4, height);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  chunks.push(makeChunk("IHDR", ihdr));
  chunks.push(makeChunk("IDAT", compressed));
  chunks.push(makeChunk("IEND", new Uint8Array(0)));

  let totalLen = 0;
  for (const c of chunks) totalLen += c.length;
  const png = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) { png.set(c, offset); offset += c.length; }
  return png;
}

// ── PNG helpers ───────────────────────────────────────────────────

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  writeUint32BE(chunk, 0, data.length);
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
  chunk.set(data, 8);
  const crc = crc32(chunk.subarray(4, 8 + data.length));
  writeUint32BE(chunk, 8 + data.length, crc);
  return chunk;
}

function writeUint32BE(buf: Uint8Array, offset: number, val: number) {
  buf[offset] = (val >>> 24) & 0xff;
  buf[offset + 1] = (val >>> 16) & 0xff;
  buf[offset + 2] = (val >>> 8) & 0xff;
  buf[offset + 3] = val & 0xff;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function deflateRaw(data: Uint8Array): Uint8Array {
  const blocks: number[] = [];
  const MAX_BLOCK = 65535;
  blocks.push(0x78, 0x01);

  let offset = 0;
  while (offset < data.length) {
    const remaining = data.length - offset;
    const blockSize = Math.min(remaining, MAX_BLOCK);
    const isFinal = offset + blockSize >= data.length;
    blocks.push(isFinal ? 0x01 : 0x00);
    blocks.push(blockSize & 0xff, (blockSize >> 8) & 0xff);
    blocks.push((~blockSize) & 0xff, ((~blockSize) >> 8) & 0xff);
    for (let i = 0; i < blockSize; i++) {
      blocks.push(data[offset + i]);
    }
    offset += blockSize;
  }

  let a = 1, b2 = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b2 = (b2 + a) % 65521;
  }
  const adler = ((b2 << 16) | a) >>> 0;
  blocks.push((adler >>> 24) & 0xff, (adler >>> 16) & 0xff, (adler >>> 8) & 0xff, adler & 0xff);

  return new Uint8Array(blocks);
}

// ── Helpers ────────────────────────────────────────────────────────

function extractAuthToken(req: Request): string | null {
  const auth = req.headers.get("Authorization") || "";
  if (auth.startsWith("ApplePass ")) return auth.slice(10);
  return null;
}

function sha1Hex(data: Uint8Array): string {
  const md = forge.md.sha1.create();
  const CHUNK = 8192;
  for (let i = 0; i < data.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, data.length);
    let str = "";
    for (let j = i; j < end; j++) str += String.fromCharCode(data[j]);
    md.update(str);
  }
  return md.digest().toHex();
}

function decodeBase64(b64: string): Uint8Array {
  const raw = forge.util.decode64(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function extractSigningMaterial(p12Base64: string, p12Password: string) {
  const p12Der = forge.util.decode64(p12Base64);
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, p12Password);
  let signerKey: any = null;
  const certs: any[] = [];
  for (const sc of p12.safeContents) {
    for (const sb of sc.safeBags) {
      if (sb.type === forge.pki.oids.certBag && sb.cert) certs.push(sb.cert);
      if (sb.type === forge.pki.oids.pkcs8ShroudedKeyBag && sb.key) signerKey = sb.key;
    }
  }
  if (!signerKey || certs.length === 0) throw new Error("Cannot extract .p12");
  const signerCert =
    certs.find((c) => c?.publicKey?.n && signerKey?.n && c.publicKey.n.compareTo(signerKey.n) === 0) ||
    certs.find((c) => (c?.subject?.getField?.("CN")?.value || "").includes("Pass Type ID")) ||
    certs[0];
  return { signerCert, signerKey, certificateChain: certs.filter((c) => c !== signerCert) };
}

function hexToRgb(hex: string): string {
  const n = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : "#6B46C1";
  return `rgb(${parseInt(n.slice(1, 3), 16)}, ${parseInt(n.slice(3, 5), 16)}, ${parseInt(n.slice(5, 7), 16)})`;
}

function hexBrightness(hex: string): number {
  const n = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : "#6B46C1";
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function autoForeground(bgHex: string): string {
  return hexBrightness(bgHex) > 160 ? "rgb(26, 26, 26)" : "rgb(255, 255, 255)";
}

function autoLabelColor(bgHex: string): string {
  return hexBrightness(bgHex) > 160 ? "rgb(100, 100, 100)" : "rgb(200, 200, 200)";
}
