// Edge function « audit-prospect »
// Audite le site d'un prospect (SEO, design, sécurité, technique), enregistre le résultat
// et reporte les notes sur la fiche prospect.
//
// Accès réservé aux super admins. L'audit est strictement passif : lecture de pages
// publiques, d'en-têtes HTTP et d'enregistrements DNS, sans aucune intrusion.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { auditeSite } from "../_shared/prospection/audit/index.ts";
import { scoreProspect } from "../_shared/prospection/core.ts";
import { detecteEtAuditeSite } from "../_shared/prospection/website.ts";
import type { AuditSiteComplet, Profondeur } from "../_shared/prospection/audit/types.ts";

const ALLOWED_ORIGINS = [
  "https://fidelipros.lovable.app",
  "https://fidelipro.com",
  "https://www.fidelipro.com",
  ...(Deno.env.get("EXTRA_ALLOWED_ORIGINS") || "").split(",").filter(Boolean),
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin":
      ALLOWED_ORIGINS.includes(origin) || /\.lovable\.(app|dev)$/.test(origin)
        ? origin
        : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const BUDGET_MS = 55_000;
const BUCKET_CAPTURES = "prospect-audits";

interface ProspectRow {
  id: string;
  siren: string;
  nom: string;
  enseigne: string | null;
  site_web: string | null;
  site_statut: string;
  budget_score: number;
}

/** Enregistre la capture Lighthouse dans le bucket privé et retourne son chemin. */
async function stockeCapture(
  supabase: ReturnType<typeof createClient>,
  siren: string,
  dataUri: string,
): Promise<string | null> {
  const correspondance = dataUri.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
  if (!correspondance) return null;
  const [, extension, base64] = correspondance;
  const octets = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const chemin = `${siren}/${Date.now()}.${extension === "jpeg" ? "jpg" : extension}`;

  const { error } = await supabase.storage
    .from(BUCKET_CAPTURES)
    .upload(chemin, octets, { contentType: `image/${extension}`, upsert: true });
  if (error) {
    console.error("[audit-prospect] capture:", error.message);
    return null;
  }
  return chemin;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (donnees: unknown, statut = 200) =>
    new Response(JSON.stringify(donnees), {
      status: statut,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const debut = Date.now();
  const echeance = debut + BUDGET_MS;

  try {
    // ── Auth : super admin uniquement ────────────────────────────────────
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!token) return json({ error: "Non authentifié" }, 401);

    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !userData?.user) return json({ error: "Non authentifié" }, 401);

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "super_admin")
      .maybeSingle();
    if (roleRow?.role !== "super_admin") {
      return json({ error: "Accès réservé aux super admins" }, 403);
    }

    // ── Cible de l'audit ─────────────────────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const profondeur: Profondeur = body.profondeur === "rapide" ? "rapide" : "complet";
    const prospectId = typeof body.prospect_id === "string" ? body.prospect_id : null;
    const siren = typeof body.siren === "string" ? body.siren.trim() : null;
    const urlDemandee = typeof body.url === "string" ? body.url.trim() : null;

    let prospect: ProspectRow | null = null;
    if (prospectId || siren) {
      const requete = supabase
        .from("prospects")
        .select("id, siren, nom, enseigne, site_web, site_statut, budget_score");
      const { data } = prospectId
        ? await requete.eq("id", prospectId).maybeSingle()
        : await requete.eq("siren", siren!).maybeSingle();
      prospect = (data as ProspectRow | null) ?? null;
      if (!prospect) return json({ error: "Prospect introuvable" }, 404);
    }
    if (!prospect && !urlDemandee) {
      return json({ error: "Fournissez un prospect_id, un siren ou une url" }, 400);
    }

    // ── Détection du site si le prospect n'en a pas encore ────────────────
    let url = urlDemandee ?? prospect?.site_web ?? null;
    let siteRedecouvert = false;
    if (!url && prospect) {
      const detection = await detecteEtAuditeSite(prospect.nom, prospect.enseigne, {
        timeoutMs: 8000,
      });
      url = detection.url;
      siteRedecouvert = Boolean(url);
    }

    // ── Aucun site : on l'enregistre tel quel, c'est une opportunité de création ──
    if (!url) {
      if (prospect) {
        const { score, priorite } = scoreProspect({
          site_statut: "aucun_site",
          site_score: 100,
          budget_score: prospect.budget_score,
        });
        await supabase
          .from("prospects")
          .update({
            site_statut: "aucun_site",
            site_score: 100,
            site_verifie_le: new Date().toISOString(),
            score,
            priorite,
            audit_le: new Date().toISOString(),
            score_audit: 0,
          })
          .eq("id", prospect.id);
      }
      return json({
        audit: null,
        sans_site: true,
        message: "Aucun site web détecté : la proposition portera sur une création de site.",
        duree_ms: Date.now() - debut,
      });
    }

    // ── Audit ────────────────────────────────────────────────────────────
    console.log(`[audit-prospect] audit ${profondeur} de ${url}`);
    const audit: AuditSiteComplet = await auditeSite(url, {
      profondeur,
      echeance,
      clePageSpeed: Deno.env.get("PAGESPEED_API_KEY") ?? undefined,
    });

    // ── Persistance ──────────────────────────────────────────────────────
    let capturePath: string | null = null;
    if (audit.captureDataUri && prospect) {
      capturePath = await stockeCapture(supabase, prospect.siren, audit.captureDataUri);
    }

    const { data: auditRow, error: insertErr } = await supabase
      .from("prospect_audits")
      .insert({
        prospect_id: prospect?.id ?? null,
        siren: prospect?.siren ?? null,
        url: audit.urlFinale ?? audit.url,
        profondeur: audit.profondeur,
        score_global: audit.scores.global,
        score_seo: audit.scores.seo,
        score_design: audit.scores.design,
        score_securite: audit.scores.securite,
        score_technique: audit.scores.technique,
        urgence: audit.scores.urgence,
        concluant: audit.concluant,
        accessibilite: audit.accessibilite,
        findings: audit.findings,
        lighthouse: audit.lighthouse,
        fichiers_exposes: audit.fichiersExposes,
        capture_path: capturePath,
        erreurs: audit.erreurs,
        duree_ms: audit.dureeMs,
        cree_par: userData.user.id,
      })
      .select("id")
      .maybeSingle();
    if (insertErr) console.error("[audit-prospect] insert:", insertErr.message);

    // Audit non concluant : on garde la trace de la tentative, mais on ne touche pas à la
    // qualification du prospect — écrire une note issue d'un site qu'on n'a pas vu reviendrait
    // à fabriquer un faux diagnostic.
    if (!audit.concluant) {
      if (prospect) {
        await supabase
          .from("prospects")
          .update({ audit_le: new Date().toISOString(), dernier_audit_id: auditRow?.id ?? null })
          .eq("id", prospect.id);
      }
      return json({
        audit_id: auditRow?.id ?? null,
        concluant: false,
        accessibilite: audit.accessibilite,
        message: audit.erreurs[0] ?? "Le site n'a pas pu être analysé.",
        audit,
        duree_ms: Date.now() - debut,
      });
    }

    if (prospect) {
      // L'opportunité commerciale est l'inverse de la qualité du site : un site noté 20/100
      // pèse 80 points d'opportunité dans le score du prospect.
      const opportunite = 100 - audit.scores.global;
      const { score, priorite } = scoreProspect({
        site_statut: audit.scores.global < 55 ? "site_obsolete" : "site_a_rafraichir",
        site_score: opportunite,
        budget_score: prospect.budget_score,
      });
      await supabase
        .from("prospects")
        .update({
          site_web: audit.urlFinale ?? url,
          site_statut: audit.scores.global < 55 ? "site_obsolete" : "site_a_rafraichir",
          site_score: opportunite,
          site_signaux: audit.findings.slice(0, 8).map((f) => f.titre),
          site_verifie_le: new Date().toISOString(),
          email_contact: audit.emailContact ?? undefined,
          telephone: audit.telephone ?? undefined,
          score,
          priorite,
          score_audit: audit.scores.global,
          score_seo: audit.scores.seo,
          score_design: audit.scores.design,
          score_securite: audit.scores.securite,
          score_technique: audit.scores.technique,
          audit_le: new Date().toISOString(),
          dernier_audit_id: auditRow?.id ?? null,
        })
        .eq("id", prospect.id);
    }

    return json({
      audit_id: auditRow?.id ?? null,
      concluant: true,
      accessibilite: audit.accessibilite,
      site_redecouvert: siteRedecouvert,
      audit,
      duree_ms: Date.now() - debut,
    });
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    console.error("[audit-prospect] erreur:", message);
    return json({ error: message }, 400);
  }
});
