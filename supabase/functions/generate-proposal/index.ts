// Edge function « generate-proposal »
// Transforme le dernier audit d'un prospect en proposition commerciale : devis chiffré
// depuis le catalogue de prestations, rapport d'audit, email, SMS et script d'appel.
//
// Accès réservé aux super admins. La reformulation IA est optionnelle : sans clé
// LOVABLE_API_KEY, les textes déterministes sont conservés.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { calculeScores } from "../_shared/prospection/audit/index.ts";
import {
  construitProposition, emetteurDepuisSettings,
} from "../_shared/prospection/proposition/index.ts";
import type { Prestation } from "../_shared/prospection/proposition/types.ts";
import type { AuditSiteComplet, Finding } from "../_shared/prospection/audit/types.ts";

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

const BUCKET_CAPTURES = "prospect-audits";

interface LigneAudit {
  id: string;
  url: string;
  profondeur: "rapide" | "complet";
  findings: Finding[];
  lighthouse: AuditSiteComplet["lighthouse"];
  fichiers_exposes: AuditSiteComplet["fichiersExposes"];
  erreurs: string[];
  duree_ms: number | null;
  capture_path: string | null;
}

/** Reconstitue un audit exploitable par le moteur depuis la ligne stockée. */
function auditDepuisLigne(ligne: LigneAudit, captureDataUri: string | null): AuditSiteComplet {
  const findings = ligne.findings ?? [];
  return {
    url: ligne.url,
    urlFinale: ligne.url,
    profondeur: ligne.profondeur,
    scores: calculeScores(findings),
    findings,
    lighthouse: ligne.lighthouse ?? null,
    fichiersExposes: ligne.fichiers_exposes ?? [],
    captureDataUri,
    emailContact: null,
    telephone: null,
    erreurs: ligne.erreurs ?? [],
    dureeMs: ligne.duree_ms ?? 0,
  };
}

function enBase64(octets: Uint8Array): string {
  let binaire = "";
  for (const octet of octets) binaire += String.fromCharCode(octet);
  return btoa(binaire);
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

    // ── Paramètres ───────────────────────────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const prospectId = typeof body.prospect_id === "string" ? body.prospect_id : null;
    if (!prospectId) return json({ error: "prospect_id requis" }, 400);
    const auditId = typeof body.audit_id === "string" ? body.audit_id : null;
    const avecIa = body.avec_ia !== false;
    const prestationsSupplementaires = Array.isArray(body.prestations_supplementaires)
      ? body.prestations_supplementaires.map((p) => String(p)).slice(0, 20)
      : [];

    const { data: prospect } = await supabase
      .from("prospects")
      .select(
        "id, siren, nom, enseigne, ville, code_postal, activite_code, dirigeant, site_web, site_statut, dernier_audit_id",
      )
      .eq("id", prospectId)
      .maybeSingle();
    if (!prospect) return json({ error: "Prospect introuvable" }, 404);

    // ── Audit de référence ───────────────────────────────────────────────
    const idAudit = auditId ?? (prospect.dernier_audit_id as string | null);
    let ligneAudit: LigneAudit | null = null;
    if (idAudit) {
      const { data } = await supabase
        .from("prospect_audits")
        .select("id, url, profondeur, findings, lighthouse, fichiers_exposes, erreurs, duree_ms, capture_path")
        .eq("id", idAudit)
        .maybeSingle();
      ligneAudit = (data as LigneAudit | null) ?? null;
    }

    let audit: AuditSiteComplet | null = null;
    if (ligneAudit) {
      let captureDataUri: string | null = null;
      if (ligneAudit.capture_path) {
        const { data: fichier } = await supabase.storage
          .from(BUCKET_CAPTURES)
          .download(ligneAudit.capture_path);
        if (fichier) {
          captureDataUri = `data:image/jpeg;base64,${enBase64(new Uint8Array(await fichier.arrayBuffer()))}`;
        }
      }
      audit = auditDepuisLigne(ligneAudit, captureDataUri);
    }

    // ── Catalogue et identité de l'émetteur ──────────────────────────────
    const { data: catalogue } = await supabase
      .from("prestations")
      .select("code, libelle, description, prix, unite, categorie, actif, ordre")
      .eq("actif", true)
      .order("ordre");

    const { data: reglages } = await supabase
      .from("site_settings")
      .select("key, value")
      .like("key", "devis_%");
    const settings: Record<string, string> = {};
    (reglages ?? []).forEach((row: { key: string; value: string }) => {
      settings[row.key] = row.value;
    });

    // ── Génération ───────────────────────────────────────────────────────
    const proposition = await construitProposition(
      prospect as never,
      audit,
      (catalogue ?? []) as Prestation[],
      {
        emetteur: emetteurDepuisSettings(settings),
        prestationsSupplementaires,
        ia: avecIa ? { cle: Deno.env.get("LOVABLE_API_KEY") ?? undefined } : {},
      },
    );

    // ── Enregistrement des livrables (un par type et par prospect) ───────
    const lignesDevis = [...proposition.devis.lignes_projet, ...proposition.devis.lignes_recurrentes];
    const documents = [
      {
        type: "rapport",
        titre: `Audit de présence en ligne — ${prospect.nom}`,
        contenu_md: proposition.synthese,
        contenu_html: proposition.rapport_html,
      },
      { type: "devis", titre: `Devis — ${prospect.nom}`, contenu_md: null, contenu_html: null },
      { type: "email", titre: proposition.email.objet, contenu_md: proposition.email.corps, contenu_html: null },
      { type: "sms", titre: null, contenu_md: proposition.sms, contenu_html: null },
      { type: "script_appel", titre: null, contenu_md: proposition.script_appel, contenu_html: null },
    ].map((document) => ({
      ...document,
      prospect_id: prospect.id,
      audit_id: ligneAudit?.id ?? null,
      lignes: document.type === "devis" ? lignesDevis : [],
      total_ht: document.type === "devis" ? proposition.devis.total_ht : null,
      total_ttc: document.type === "devis" ? proposition.devis.total_ttc : null,
      mensuel_ht: document.type === "devis" ? proposition.devis.mensuel_ht : null,
      taux_tva: document.type === "devis" ? proposition.devis.taux_tva : null,
      valide_jusqu_au: document.type === "devis" ? proposition.devis.valide_jusqu_au : null,
      genere_par_ia: proposition.genere_par_ia,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertErr } = await supabase
      .from("prospect_documents")
      .upsert(documents, { onConflict: "prospect_id,type" });
    if (upsertErr) console.error("[generate-proposal] upsert:", upsertErr.message);

    console.log(
      `[generate-proposal] ${prospect.nom} — ${lignesDevis.length} ligne(s), ` +
        `${proposition.devis.total_ht} € HT, IA : ${proposition.genere_par_ia}`,
    );

    return json({
      devis: proposition.devis,
      synthese: proposition.synthese,
      email: proposition.email,
      sms: proposition.sms,
      script_appel: proposition.script_appel,
      rapport_html: proposition.rapport_html,
      genere_par_ia: proposition.genere_par_ia,
      arguments: proposition.contexte.arguments,
      sans_audit: !audit,
    });
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    console.error("[generate-proposal] erreur:", message);
    return json({ error: message }, 400);
  }
});
