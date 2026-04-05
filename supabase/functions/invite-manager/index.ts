import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://fidelipros.lovable.app",
  "https://fidelipro.com",
  "https://www.fidelipro.com",
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
    const { data: biz } = await admin.from("businesses").select("id, owner_id, name, subscription_plan, is_franchise").eq("id", business_id).single();
    if (!biz || biz.owner_id !== user.id) throw new Error("Vous n'êtes pas propriétaire de cette enseigne");

    // Only franchise plans can invite managers
    if (!(biz as any).is_franchise && (biz as any).subscription_plan !== "franchise") {
      throw new Error("Cette fonctionnalité est réservée au plan Franchise");
    }

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

    const inviteTimestamp = new Date().toISOString();

    // Assign location_manager role
    const { error: roleErr } = await admin.from("user_roles").upsert(
      { user_id: managerId, role: "location_manager" },
      { onConflict: "user_id,role" },
    );
    if (roleErr) throw new Error("Impossible d'attribuer le rôle manager: " + roleErr.message);

    // Link to location_managers (store invite_email for display in frontend)
    const { error: lmErr } = await admin.from("location_managers").upsert({
      location_id,
      user_id: managerId,
      role: "manager",
      invited_at: inviteTimestamp,
      invite_email: email.toLowerCase(),
    }, { onConflict: "location_id,user_id" });
    if (lmErr) throw new Error("Erreur lors de l'association: " + lmErr.message);

    // Create profile so ManagersPage can detect "Actif" status
    const { error: profileErr } = await admin.from("profiles").upsert({
      id: managerId,
      email: email.toLowerCase(),
    }, { onConflict: "id" });
    if (profileErr) {
      console.warn("[INVITE] Profile upsert warning:", profileErr.message);
    }

    // Generate magic link for the manager
    const siteUrl = Deno.env.get("SITE_URL") || "https://fidelipro.com";
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: email.toLowerCase(),
      options: { redirectTo: `${siteUrl}/dashboard` },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      throw new Error("Impossible de générer le lien d'invitation");
    }

    const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        templateName: "manager-invitation",
        recipientEmail: email.toLowerCase(),
        idempotencyKey: `manager-invitation-${location_id}-${managerId}-${inviteTimestamp}`,
        templateData: {
          businessName: biz.name,
          locationName: loc.name,
          actionLink: linkData.properties.action_link,
        },
      }),
    });

    const emailPayload = await emailRes.json().catch(() => ({}));
    if (!emailRes.ok || emailPayload?.success === false) {
      console.error("[INVITE] App email error:", emailPayload);
      throw new Error(emailPayload?.error || "Impossible d'envoyer l'email d'invitation");
    }

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
