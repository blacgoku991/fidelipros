// Helpers front du module de prospection : accès aux données, libellés, export.
// La logique de scoring et l'export CSV sont partagés avec l'edge function
// (source unique de vérité dans supabase/functions/_shared/prospection).

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { dateIlYaNMois, versCsv } from "@prospection/core.ts";
import type {
  PrioriteProspect,
  Prospect,
  ProspectionFilters,
  StatutSite,
} from "@prospection/types.ts";
import type {
  Accessibilite, Finding, Pilier, ResultatLighthouse, Severite, Urgence,
} from "@prospection/audit/types.ts";
import type { Devis, LigneDevis, Prestation } from "@prospection/proposition/types.ts";

export type {
  Prospect, ProspectionFilters, PrioriteProspect, StatutSite,
  Finding, Pilier, Severite, Urgence, ResultatLighthouse, Accessibilite,
  Devis, LigneDevis, Prestation,
};
export { dateIlYaNMois };
export { SECTEURS_CIBLES, TRANCHES_EFFECTIF } from "@prospection/naf.ts";
export {
  argumentsCles, LIBELLES_EFFORT, LIBELLES_PILIERS, LIBELLES_SEVERITE,
} from "@prospection/audit/index.ts";
export { euros } from "@prospection/proposition/devis.ts";

export const LIBELLES_URGENCE: Record<Urgence, { label: string; classe: string }> = {
  critique: { label: "Urgence critique", classe: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
  elevee: { label: "Urgence élevée", classe: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  moyenne: { label: "Urgence moyenne", classe: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  faible: { label: "Pas d'urgence", classe: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
};

/** Ce qu'on peut dire quand le site n'a pas pu être observé. */
export const LIBELLES_ACCESSIBILITE: Record<Accessibilite, { label: string; classe: string }> = {
  ok: { label: "Site analysé", classe: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  erreur_serveur: { label: "Site en erreur", classe: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
  bloque: { label: "Audit non concluant", classe: "bg-slate-200 text-slate-800 dark:bg-slate-700/60 dark:text-slate-200" },
  injoignable: { label: "Domaine hors ligne", classe: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
};

export const CLASSES_SEVERITE: Record<Severite, string> = {
  critique: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  majeur: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  mineur: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
};

/** Couleur d'un score sur 100, du rouge au vert. */
export function classeScore(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 55) return "text-amber-600 dark:text-amber-400";
  if (score >= 35) return "text-orange-600 dark:text-orange-400";
  return "text-rose-600 dark:text-rose-400";
}

/** Statut commercial, notes et notes d'audit stockés en base en plus des données de l'API. */
export interface ProspectEnregistre extends Prospect {
  id: string;
  statut: StatutCommercial;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Renseignés par l'edge function `audit-prospect`. */
  dernier_audit_id: string | null;
  score_audit: number | null;
  score_seo: number | null;
  score_design: number | null;
  score_securite: number | null;
  score_technique: number | null;
  audit_le: string | null;
}

export type StatutCommercial =
  | "nouveau"
  | "a_contacter"
  | "contacte"
  | "rdv"
  | "gagne"
  | "perdu"
  | "ignore";

// Les tables `prospects` / `prospection_runs` ne figurent pas encore dans
// src/integrations/supabase/types.ts (fichier généré) : on passe par un client
// non typé pour ces requêtes uniquement.
const db = supabase as unknown as SupabaseClient;

export interface ResultatProspection {
  run_id: string | null;
  total_disponible: number;
  analyses: number;
  sites_audites: number;
  retenus: number;
  nouveaux: number;
  tronque: boolean;
  duree_ms: number;
  prospects: Prospect[];
}

/** Lance un run de prospection (edge function, réservé aux super admins). */
export async function lancerProspection(filters: ProspectionFilters): Promise<ResultatProspection> {
  const { data, error } = await supabase.functions.invoke("prospect-companies", {
    body: { filters },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as ResultatProspection;
}

/** Charge les prospects enregistrés, les mieux notés d'abord. */
export async function chargeProspects(limite = 500): Promise<ProspectEnregistre[]> {
  const { data, error } = await db
    .from("prospects")
    .select("*")
    .order("score", { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return (data ?? []) as ProspectEnregistre[];
}

/** Met à jour le suivi commercial d'un prospect. */
export async function majProspect(
  id: string,
  patch: Partial<Pick<ProspectEnregistre, "statut" | "notes">>,
): Promise<void> {
  const { error } = await db.from("prospects").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Libellés ────────────────────────────────────────────────────────────────

export const PRIORITES: Record<
  PrioriteProspect,
  { label: string; classe: string }
> = {
  chaud: { label: "Chaud", classe: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
  tiede: { label: "Tiède", classe: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  froid: { label: "Froid", classe: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300" },
};

export const STATUTS_SITE: Record<StatutSite, { label: string; classe: string }> = {
  aucun_site: {
    label: "Aucun site",
    classe: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  },
  site_injoignable: {
    label: "Site en panne",
    classe: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  },
  site_obsolete: {
    label: "Site obsolète",
    classe: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  },
  site_a_rafraichir: {
    label: "À rafraîchir",
    classe: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  site_recent: {
    label: "Site correct",
    classe: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  non_verifie: {
    label: "Non vérifié",
    classe: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  },
};

export const STATUTS_COMMERCIAUX: Array<{ valeur: StatutCommercial; label: string }> = [
  { valeur: "nouveau", label: "Nouveau" },
  { valeur: "a_contacter", label: "À contacter" },
  { valeur: "contacte", label: "Contacté" },
  { valeur: "rdv", label: "Rendez-vous" },
  { valeur: "gagne", label: "Gagné" },
  { valeur: "perdu", label: "Perdu" },
  { valeur: "ignore", label: "Ignoré" },
];

export const ANCIENNETES: Array<{ valeur: string; label: string; mois: number | null }> = [
  { valeur: "3", label: "Créées depuis moins de 3 mois", mois: 3 },
  { valeur: "6", label: "Créées depuis moins de 6 mois", mois: 6 },
  { valeur: "12", label: "Créées depuis moins d'un an", mois: 12 },
  { valeur: "24", label: "Créées depuis moins de 2 ans", mois: 24 },
  { valeur: "toutes", label: "Toutes les entreprises", mois: null },
];

export function formateEuros(montant: number | null): string {
  if (montant === null || montant === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    notation: montant >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: montant >= 1_000_000 ? 1 : 0,
  }).format(montant);
}

export function formateDate(date: string | null): string {
  if (!date) return "—";
  const parsee = new Date(date);
  return Number.isNaN(parsee.getTime()) ? "—" : parsee.toLocaleDateString("fr-FR");
}

/** Télécharge la sélection au format CSV (séparateur `;`, BOM pour Excel). */
export function telechargeCsv(prospects: Prospect[], nomFichier = "prospects.csv"): void {
  const blob = new Blob(["\uFEFF" + versCsv(prospects)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}

// ── Audits et propositions commerciales ─────────────────────────────────────

export interface AuditEnregistre {
  id: string;
  prospect_id: string | null;
  url: string;
  profondeur: "rapide" | "complet";
  score_global: number;
  score_seo: number;
  score_design: number;
  score_securite: number;
  score_technique: number;
  urgence: Urgence;
  concluant: boolean;
  accessibilite: Accessibilite;
  findings: Finding[];
  lighthouse: ResultatLighthouse | null;
  fichiers_exposes: Array<{ chemin: string; indice: string }>;
  capture_path: string | null;
  erreurs: string[];
  duree_ms: number | null;
  created_at: string;
}

export interface DocumentProspect {
  id: string;
  prospect_id: string;
  audit_id: string | null;
  type: "rapport" | "devis" | "email" | "sms" | "script_appel";
  titre: string | null;
  contenu_md: string | null;
  contenu_html: string | null;
  lignes: LigneDevis[];
  total_ht: number | null;
  total_ttc: number | null;
  mensuel_ht: number | null;
  taux_tva: number | null;
  valide_jusqu_au: string | null;
  genere_par_ia: boolean;
  updated_at: string;
}

export interface ResultatAudit {
  audit_id: string | null;
  audit: {
    url: string;
    urlFinale: string | null;
    concluant: boolean;
    accessibilite: Accessibilite;
    scores: { global: number; seo: number; design: number; securite: number; technique: number; urgence: Urgence };
    findings: Finding[];
    erreurs: string[];
  } | null;
  /** Faux quand le site n'a pas pu être observé : aucune note n'est exploitable. */
  concluant?: boolean;
  accessibilite?: Accessibilite;
  /** Aucun site trouvé pour l'entreprise : c'est une opportunité de création. */
  sans_site?: boolean;
  message?: string;
  site_redecouvert?: boolean;
  duree_ms: number;
}

export interface ResultatProposition {
  devis: Devis;
  synthese: string;
  email: { objet: string; corps: string };
  sms: string;
  script_appel: string;
  rapport_html: string;
  genere_par_ia: boolean;
  arguments: Finding[];
  sans_audit: boolean;
}

/** Lance l'audit du site d'un prospect (edge function). */
export async function auditeProspect(
  cible: { prospect_id?: string; siren?: string; url?: string },
  profondeur: "rapide" | "complet" = "complet",
): Promise<ResultatAudit> {
  const { data, error } = await supabase.functions.invoke("audit-prospect", {
    body: { ...cible, profondeur },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as ResultatAudit;
}

/** Génère (ou régénère) le devis et les messages de démarchage. */
export async function genereProposition(
  prospectId: string,
  options: { avecIa?: boolean; prestationsSupplementaires?: string[] } = {},
): Promise<ResultatProposition> {
  const { data, error } = await supabase.functions.invoke("generate-proposal", {
    body: {
      prospect_id: prospectId,
      avec_ia: options.avecIa ?? true,
      prestations_supplementaires: options.prestationsSupplementaires ?? [],
    },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as ResultatProposition;
}

export async function chargeProspect(id: string): Promise<ProspectEnregistre | null> {
  const { data, error } = await db.from("prospects").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProspectEnregistre | null) ?? null;
}

export async function chargeDernierAudit(prospectId: string): Promise<AuditEnregistre | null> {
  const { data, error } = await db
    .from("prospect_audits")
    .select("*")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AuditEnregistre | null) ?? null;
}

export async function chargeDocuments(prospectId: string): Promise<DocumentProspect[]> {
  const { data, error } = await db.from("prospect_documents").select("*").eq("prospect_id", prospectId);
  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentProspect[];
}

export async function chargePrestations(): Promise<Prestation[]> {
  const { data, error } = await db.from("prestations").select("*").order("ordre");
  if (error) throw new Error(error.message);
  return (data ?? []) as Prestation[];
}

export async function majPrestation(
  id: string,
  patch: Partial<Pick<Prestation, "libelle" | "description" | "prix" | "unite" | "actif">>,
): Promise<void> {
  const { error } = await db.from("prestations").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/** URL signée (1 h) de la capture d'écran stockée dans le bucket privé. */
export async function urlCapture(chemin: string): Promise<string | null> {
  const { data } = await supabase.storage.from("prospect-audits").createSignedUrl(chemin, 3600);
  return data?.signedUrl ?? null;
}

/** Télécharge un contenu texte ou HTML sous forme de fichier. */
export function telechargeFichier(contenu: string, nomFichier: string, type = "text/html"): void {
  const blob = new Blob([contenu], { type: `${type};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}

/** Lien Google Maps vers l'adresse du siège. */
export function lienMaps(prospect: Prospect): string {
  const requete = [prospect.nom, prospect.adresse].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(requete)}`;
}
