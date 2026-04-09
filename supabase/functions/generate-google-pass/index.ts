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

const REQUIRED_SECRETS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_WALLET_ISSUER_ID",
] as const;

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

async function signJWT(payload: object, privateKeyPem: string): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const headerEncoded = base64urlEncode(JSON.stringify(header));
  const payloadEncoded = base64urlEncode(JSON.stringify(payload));
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

  return `${signingInput}.${base64urlEncode(new Uint8Array(signature))}`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Startup validation
  const missing = REQUIRED_SECRETS.filter((s) => !Deno.env.get(s));
  if (missing.length > 0) {
    console.error("[GOOGLE-PASS] Missing secrets:", missing);
    return new Response(JSON.stringify({ unavailable: true, error: "Google Wallet n'est pas encore configuré pour ce commerce." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const cardCode = url.searchParams.get("card_code");
    if (!cardCode) {
      return new Response(JSON.stringify({ error: "card_code required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const serviceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")!;
    const privateKeyPem = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")!.replace(/\\n/g, "\n");
    const issuerId = Deno.env.get("GOOGLE_WALLET_ISSUER_ID")!;

    // Fetch card + customer
    const { data: card, error: cardErr } = await supabase
      .from("customer_cards")
      .select("*, customers(*)")
      .eq("card_code", cardCode)
      .maybeSingle();

    if (cardErr || !card) {
      return new Response(JSON.stringify({ error: "Card not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", card.business_id)
      .maybeSingle();

    if (!business) {
      return new Response(JSON.stringify({ error: "Business not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customer = card.customers;
    const classId = `${issuerId}.loyalty_${business.id}`;
    const objectId = `${issuerId}.card_${card.id}`;

    // Fetch active rewards for this business
    const { data: rewards } = await supabase
      .from("rewards")
      .select("title, description, points_required")
      .eq("business_id", card.business_id)
      .eq("is_active", true)
      .order("points_required", { ascending: true });

    const pointsLabel = business.loyalty_type === "stamps" ? "Tampons" : "Points";
    const pointsCurrent = card.current_points || 0;
    const pointsMax = card.max_points || business.max_points_per_card || 10;
    const remaining = Math.max(0, pointsMax - pointsCurrent);
    const rewardDesc = business.reward_description || "Récompense offerte !";
    const customerName = customer?.full_name || "Client";

    const loyaltyClass = {
      id: classId,
      issuerName: business.name,
      programName: `Fidélité ${business.name}`,
      programLogo: business.logo_url
        ? {
            sourceUri: { uri: business.logo_url },
            contentDescription: { defaultValue: { language: "fr", value: business.name } },
          }
        : undefined,
      hexBackgroundColor: business.primary_color || "#7c3aed",
      localizedIssuerName: { defaultValue: { language: "fr", value: business.name } },
      secondaryLoyaltyPoints: remaining > 0
        ? { balance: { int: remaining }, label: `${pointsLabel} restants` }
        : undefined,
    };

    // Build info module rows with rewards
    const infoModuleRows: any[] = [
      {
        header: pointsLabel,
        body: `${pointsCurrent} / ${pointsMax}`,
      },
    ];

    if (rewards && rewards.length > 0) {
      const nextReward = rewards.find((r: any) => r.points_required > pointsCurrent) || rewards[0];
      if (nextReward) {
        infoModuleRows.push({
          header: "Prochaine récompense",
          body: nextReward.title,
        });
      }
      for (const r of rewards) {
        infoModuleRows.push({
          header: `🎁 ${r.title}`,
          body: `${r.points_required} ${business.loyalty_type === "stamps" ? "tampons" : "points"}${r.description ? ` — ${r.description}` : ""}`,
        });
      }
    } else if (business.reward_description) {
      infoModuleRows.push({
        header: "Récompense",
        body: business.reward_description,
      });
    }

    const loyaltyObject: any = {
      id: objectId,
      classId,
      loyaltyPoints: {
        balance: { int: pointsCurrent },
        label: pointsLabel,
      },
      secondaryLoyaltyPoints: {
        balance: { int: remaining },
        label: remaining > 0 ? "Restants" : "Complet ✓",
      },
      barcode: {
        type: "QR_CODE",
        value: card.card_code || card.id,
        alternateText: card.card_code || card.id,
      },
      accountId: customerName,
      accountName: customerName,
      textModulesData: [
        {
          id: "progress",
          header: "Progression",
          body: remaining > 0
            ? `${pointsCurrent}/${pointsMax} — Plus que ${remaining} pour votre récompense !`
            : `${pointsCurrent}/${pointsMax} — ${rewardDesc} 🎉`,
        },
        ...(business.address ? [{
          id: "address",
          header: "Adresse",
          body: `${business.address}${business.city ? `, ${business.city}` : ""}`,
        }] : []),
      ],
      linksModuleData: business.website ? {
        uris: [{
          uri: business.website,
          description: `Site web ${business.name}`,
          id: "website",
        }],
      } : undefined,
      heroImage: business.card_bg_image_url
        ? {
            sourceUri: { uri: business.card_bg_image_url },
            contentDescription: { defaultValue: { language: "fr", value: business.name } },
          }
        : business.logo_url
        ? {
            sourceUri: { uri: business.logo_url },
            contentDescription: { defaultValue: { language: "fr", value: business.name } },
          }
        : undefined,
      hexBackgroundColor: business.primary_color || "#7c3aed",
      state: "ACTIVE",
      infoModuleData: {
        labelValueRows: infoModuleRows.map((row: any) => ({
          columns: [{ label: row.header, value: row.body }],
        })),
        showLastUpdateTime: true,
      },
    };

    const jwtPayload = {
      iss: serviceAccountEmail,
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(Date.now() / 1000),
      payload: {
        loyaltyClasses: [loyaltyClass],
        loyaltyObjects: [loyaltyObject],
      },
      origins: [Deno.env.get("APP_ORIGIN") || "https://fidelipros.lovable.app"],
    };

    const jwt = await signJWT(jwtPayload, privateKeyPem);
    const saveUrl = `https://pay.google.com/gp/v/save/${jwt}`;

    return new Response(
      JSON.stringify({
        success: true,
        saveUrl,
        card: {
          points: pointsCurrent,
          maxPoints: pointsMax,
          customerName,
          businessName: business.name,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[GOOGLE-PASS] Error:", err);
    return new Response(JSON.stringify({ error: "Failed to generate Google Wallet pass" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
