// Helpers front du module de prospection : accès aux données, libellés, export.
// La logique de scoring et l'export CSV sont partagés avec l'edge function
// (source unique de vérité dans supabase/functions/_shared/prospection).

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { versCsv } from "@prospection/core.ts";
import type {
  PrioriteProspect,
  Prospect,
  ProspectionFilters,
  StatutSite,
} from "@prospection/types.ts";

export type { Prospect, ProspectionFilters, PrioriteProspect, StatutSite };
export { SECTEURS_CIBLES, TRANCHES_EFFECTIF } from "@prospection/naf.ts";

/** Statut commercial + notes stockés en base en plus des données de l'API. */
export interface ProspectEnregistre extends Prospect {
  id: string;
  statut: StatutCommercial;
  notes: string | null;
  created_at: string;
  updated_at: string;
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

/** Date au format YYYY-MM-DD correspondant à « il y a N mois ». */
export function dateIlYaNMois(mois: number, maintenant = new Date()): string {
  const date = new Date(maintenant);
  date.setMonth(date.getMonth() - mois);
  return date.toISOString().slice(0, 10);
}

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
  const blob = new Blob(["﻿", versCsv(prospects)], { type: "text/csv;charset=utf-8;" });
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
