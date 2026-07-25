// Edge function « prospect-companies »
// Recherche des entreprises françaises correspondant à des critères commerciaux
// (nouvelles sociétés avec du budget, ou entreprises au site web dépassé),
// audite leur site web puis enregistre les prospects qualifiés.
//
// Accès réservé aux super admins. Source de données : API publique Recherche d'entreprises.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { appliqueAudit, filtreSelonCible, MAX_PAGES } from "../_shared/prospection/core.ts";
import { rechercheEntreprises } from "../_shared/prospection/sirene.ts";
import { auditeProspects } from "../_shared/prospection/website.ts";
import type { ProspectionFilters } from "../_shared/prospection/types.ts";

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

/** Budget de temps du run : au-delà, on renvoie les résultats déjà collectés. */
const BUDGET_MS = 50_000;

function nettoieFiltres(brut: Record<string, unknown>): ProspectionFilters {
  const liste = (valeur: unknown): string[] | undefined => {
    if (!Array.isArray(valeur)) return undefined;
    const propre = valeur.map((v) => String(v).trim()).filter(Boolean).slice(0, 50);
    return propre.length ? propre : undefined;
  };
  const texte = (valeur: unknown, max = 120): string | undefined => {
    if (typeof valeur !== "string") return undefined;
    const propre = valeur.trim().slice(0, max);
    return propre || undefined;
  };
  const nombre = (valeur: unknown): number | undefined => {
    const n = Number(valeur);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const date = (valeur: unknown): string | undefined => {
    const propre = texte(valeur, 10);
    return propre && /^\d{4}-\d{2}-\d{2}$/.test(propre) ? propre : undefined;
  };

  const cible = texte(brut.cible);
  return {
    q: texte(brut.q),
    departement: texte(brut.departement, 3),
    codePostal: texte(brut.codePostal, 5),
    codeCommune: texte(brut.codeCommune, 5),
    region: texte(brut.region, 3),
    activitePrincipale: liste(brut.activitePrincipale),
    sectionActivitePrincipale: liste(brut.sectionActivitePrincipale),
    categorieEntreprise: liste(brut.categorieEntreprise),
    trancheEffectif: liste(brut.trancheEffectif),
    creeApres: date(brut.creeApres),
    creeAvant: date(brut.creeAvant),
    caMin: nombre(brut.caMin),
    caMax: nombre(brut.caMax),
    cible:
      cible === "sans_site" || cible === "site_a_refaire" || cible === "tous" ? cible : "tous",
    pages: Math.min(MAX_PAGES, Math.max(1, Math.round(nombre(brut.pages) ?? 2))),
    perPage: Math.min(25, Math.max(1, Math.round(nombre(brut.perPage) ?? 25))),
    auditSites: brut.auditSites !== false,
  };
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

    // ── Filtres ──────────────────────────────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const filters = nettoieFiltres((body.filters as Record<string, unknown>) ?? {});
    const enregistrer = body.enregistrer !== false;

    console.log("[prospect-companies] filtres:", JSON.stringify(filters));

    // ── Recherche Sirene ─────────────────────────────────────────────────
    const recherche = await rechercheEntreprises(filters, { echeance });
    console.log(
      `[prospect-companies] ${recherche.prospects.length} entreprise(s) sur ${recherche.totalDisponible} disponible(s)`,
    );

    // ── Audit des sites web ──────────────────────────────────────────────
    let prospects = recherche.prospects;
    let sitesAudites = 0;
    if (filters.auditSites && prospects.length) {
      const audits = await auditeProspects(prospects, { concurrence: 5, echeance });
      prospects = prospects.map((prospect, i) => {
        const audit = audits[i];
        if (!audit) return prospect;
        sitesAudites++;
        return appliqueAudit(prospect, audit);
      });
    }

    // Le filtre par cible n'a de sens qu'avec l'audit (sinon tous les sites sont "non vérifiés").
    const retenus = filters.auditSites
      ? filtreSelonCible(prospects, filters.cible)
      : prospects;
    retenus.sort((a, b) => b.score - a.score);

    // ── Persistance ──────────────────────────────────────────────────────
    let runId: string | null = null;
    let nouveaux = 0;
    if (enregistrer && retenus.length) {
      const { data: run } = await supabase
        .from("prospection_runs")
        .insert({
          lance_par: userData.user.id,
          filtres: filters,
          nb_resultats: retenus.length,
          nb_sites_audites: sitesAudites,
          total_disponible: recherche.totalDisponible,
        })
        .select("id")
        .maybeSingle();
      runId = run?.id ?? null;

      const { data: existants } = await supabase
        .from("prospects")
        .select("siren")
        .in("siren", retenus.map((p) => p.siren));
      const dejaConnus = new Set((existants ?? []).map((e: { siren: string }) => e.siren));
      nouveaux = retenus.filter((p) => !dejaConnus.has(p.siren)).length;

      // `statut` et `notes` ne figurent pas dans le payload : le suivi commercial
      // existant n'est jamais écrasé par un nouveau run.
      const { error: upsertErr } = await supabase
        .from("prospects")
        .upsert(
          retenus.map((p) => ({ ...p, run_id: runId, source: "recherche-entreprises" })),
          { onConflict: "siren" },
        );
      if (upsertErr) console.error("[prospect-companies] upsert:", upsertErr.message);

      if (runId) {
        await supabase
          .from("prospection_runs")
          .update({ nb_nouveaux: nouveaux, duree_ms: Date.now() - debut })
          .eq("id", runId);
      }
    }

    return json({
      run_id: runId,
      total_disponible: recherche.totalDisponible,
      analyses: recherche.prospects.length,
      sites_audites: sitesAudites,
      retenus: retenus.length,
      nouveaux,
      tronque: recherche.tronque || Date.now() > echeance,
      duree_ms: Date.now() - debut,
      prospects: retenus,
    });
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    console.error("[prospect-companies] erreur:", message);
    return json({ error: message }, 400);
  }
});
