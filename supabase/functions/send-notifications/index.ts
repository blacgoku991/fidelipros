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

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── Auth : vérifier que l'appelant possède le business ────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) return json({ error: "Non authentifié" }, 401);

    const supabase = createClient(sbUrl, sbKey, { auth: { persistSession: false } });

    // Check if this is a service-role call (internal) via getClaims
    let verifiedBusinessId: string | null = null;

    const body = await req.json();
    const { business_id, message, change_message } = body;

    if (!business_id) return json({ error: "business_id required" }, 400);

    // Check if token is the service role key (internal call)
    const isServiceRole = token === sbKey;

    if (isServiceRole) {
      verifiedBusinessId = business_id;
    } else {
      // Validate user JWT and verify business ownership
      const { data: userData, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !userData?.user) return json({ error: "Token invalide" }, 401);

      const { data: biz } = await supabase
        .from("businesses")
        .select("id")
        .eq("id", business_id)
        .eq("owner_id", userData.user.id)
        .maybeSingle();

      if (!biz) return json({ error: "Commerce introuvable ou accès refusé" }, 403);
      verifiedBusinessId = biz.id;
    }

    // ── Envoi Apple Wallet push ───────────────────────────────────────────
    let walletSent = 0;
    let walletError: string | null = null;
    try {
      const wr = await fetch(`${sbUrl}/functions/v1/wallet-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sbKey}`,
        },
        body: JSON.stringify({
          business_id: verifiedBusinessId,
          action_type: "campaign",
          change_message: change_message || message,
        }),
      });
      const wrText = await wr.text();
      try {
        const walletResult = JSON.parse(wrText);
        if (!walletResult.success && walletResult.error) {
          walletError = walletResult.error;
          console.error("Wallet push failed:", walletError);
        }
        walletSent = walletResult.pushed || 0;
      } catch {
        walletError = "Wallet push returned non-JSON response";
        console.error("Wallet push returned non-JSON:", wrText.substring(0, 200));
      }
    } catch (e) {
      walletError = String(e);
      console.error("Wallet push error:", e);
    }

    // ── Mise à jour Google Wallet passes ─────────────────────────────────
    let googleUpdated = 0;
    try {
      const gr = await fetch(`${sbUrl}/functions/v1/update-google-pass`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sbKey}`,
        },
        body: JSON.stringify({
          business_id: verifiedBusinessId,
          message: change_message || message,
        }),
      });
      const grText = await gr.text();
      try {
        const googleResult = JSON.parse(grText);
        googleUpdated = googleResult.updated || 0;
        if (googleResult.skipped) {
          console.log("Google Wallet update skipped (not configured)");
        }
      } catch {
        console.error("Google Wallet update returned non-JSON:", grText.substring(0, 200));
      }
    } catch (e) {
      console.error("Google Wallet update error:", e);
    }

    return json({ wallet: walletSent, google: googleUpdated, webpush: 0, ...(walletError ? { wallet_error: walletError } : {}) });
  } catch (err) {
    console.error("send-notifications error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
