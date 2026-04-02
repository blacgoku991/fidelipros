import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

    // Prevent self-deletion
    if (user_id === userData.user.id) throw new Error("Impossible de supprimer votre propre compte");

    console.log(`[delete-user] Deleting auth user: ${user_id}`);

    // Delete from auth.users using admin API
    const { error: deleteErr } = await supabase.auth.admin.deleteUser(user_id);
    if (deleteErr) {
      console.error(`[delete-user] Error:`, deleteErr.message);
      throw new Error(`Erreur suppression auth: ${deleteErr.message}`);
    }

    console.log(`[delete-user] Successfully deleted auth user: ${user_id}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[delete-user] ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
