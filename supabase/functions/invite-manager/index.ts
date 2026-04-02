import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://fidelipros.lovable.app",
  ...(Deno.env.get("EXTRA_ALLOWED_ORIGINS") || "").split(",").filter(Boolean),
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client (to verify caller identity)
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error("Non authentifié");

    // Admin client
    const admin = createClient(supabaseUrl, serviceKey);

    const { email, location_id, business_id } = await req.json();
    if (!email || !location_id || !business_id) throw new Error("email, location_id et business_id requis");

    // Verify caller owns the business
    const { data: biz } = await admin.from("businesses").select("id, owner_id, name").eq("id", business_id).single();
    if (!biz || biz.owner_id !== user.id) throw new Error("Vous n'êtes pas propriétaire de cette enseigne");

    // Verify location belongs to business
    const { data: loc } = await admin.from("merchant_locations").select("id, name").eq("id", location_id).eq("business_id", business_id).single();
    if (!loc) throw new Error("Établissement introuvable");

    // Find or create the user by email
    let managerId: string;
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u: any) => u.email === email.toLowerCase());

    if (existing) {
      managerId = existing.id;
    } else {
      // Create user with a random password (they'll reset via email)
      const tempPassword = crypto.randomUUID();
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email: email.toLowerCase(),
        password: tempPassword,
        email_confirm: true,
      });
      if (createErr || !newUser.user) throw new Error("Impossible de créer le compte: " + (createErr?.message || ""));
      managerId = newUser.user.id;
    }

    // Assign location_manager role
    await admin.from("user_roles").upsert({ user_id: managerId, role: "location_manager" }, { onConflict: "user_id" });

    // Link to location_managers
    const { error: lmErr } = await admin.from("location_managers").upsert({
      location_id,
      user_id: managerId,
      role: "manager",
      invited_at: new Date().toISOString(),
    }, { onConflict: "location_id,user_id" });
    if (lmErr) throw new Error("Erreur lors de l'association: " + lmErr.message);

    // Send invitation email via send-email function (or password reset)
    const { error: resetErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: email.toLowerCase(),
      options: { redirectTo: `${Deno.env.get("SITE_URL") || "https://fidelipros.lovable.app"}/dashboard` },
    });

    return new Response(JSON.stringify({
      success: true,
      message: `Invitation envoyée à ${email}`,
      manager_id: managerId,
      is_new_user: !existing,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
