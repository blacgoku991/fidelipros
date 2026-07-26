// Types partagés du module de prospection.
// Utilisés par l'edge function `prospect-companies`, le script CLI `scripts/prospect.ts`
// et les tests unitaires. Aucun import Deno/Node ici : ce fichier doit rester portable.

/** Cible commerciale de la recherche. */
export type CibleProspection = "sans_site" | "site_a_refaire" | "tous";

/** État du site web détecté pour un prospect. */
export type StatutSite =
  | "non_verifie"
  | "aucun_site"
  | "site_injoignable"
  | "site_obsolete"
  | "site_a_rafraichir"
  | "site_recent";

/** Température commerciale calculée à partir du score global. */
export type PrioriteProspect = "chaud" | "tiede" | "froid";

/** Filtres de recherche envoyés à l'API Recherche d'entreprises. */
export interface ProspectionFilters {
  /** Recherche plein texte (nom, enseigne, dirigeant…). */
  q?: string;
  /** Département sur 2 ou 3 caractères (ex. "33", "2A", "971"). */
  departement?: string;
  codePostal?: string;
  codeCommune?: string;
  region?: string;
  /** Codes NAF complets (ex. "56.10A"). */
  activitePrincipale?: string[];
  /** Sections NAF (ex. "I" pour hébergement/restauration). */
  sectionActivitePrincipale?: string[];
  /** Catégories INSEE : PME / ETI / GE. */
  categorieEntreprise?: string[];
  /** Tranches d'effectif INSEE (ex. "02" pour 3 à 5 salariés). */
  trancheEffectif?: string[];
  /** Date de création minimale, format YYYY-MM-DD. */
  creeApres?: string;
  /** Date de création maximale, format YYYY-MM-DD. */
  creeAvant?: string;
  caMin?: number;
  caMax?: number;
  cible?: CibleProspection;
  /** Nombre de pages de résultats à parcourir (25 entreprises par page). */
  pages?: number;
  perPage?: number;
  /** Détecter et auditer le site web de chaque entreprise. */
  auditSites?: boolean;
}

/** Entreprise telle que renvoyée par l'API (sous-ensemble utilisé). */
export interface EntrepriseApi {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  sigle?: string | null;
  date_creation?: string | null;
  activite_principale?: string | null;
  section_activite_principale?: string | null;
  nature_juridique?: string | null;
  categorie_entreprise?: string | null;
  tranche_effectif_salarie?: string | null;
  etat_administratif?: string | null;
  nombre_etablissements_ouverts?: number | null;
  dirigeants?: Array<{
    nom?: string | null;
    prenoms?: string | null;
    denomination?: string | null;
    qualite?: string | null;
  }> | null;
  finances?: Record<string, { ca?: number | null; resultat_net?: number | null }> | null;
  siege?: {
    siret?: string | null;
    adresse?: string | null;
    code_postal?: string | null;
    libelle_commune?: string | null;
    departement?: string | null;
    latitude?: string | number | null;
    longitude?: string | number | null;
    liste_enseignes?: string[] | null;
    activite_principale?: string | null;
  } | null;
}

/** Résultat d'audit d'un site web. */
export interface AuditSite {
  url: string | null;
  statut: StatutSite;
  /** 0 = site nickel, 100 = site à refaire d'urgence. */
  score: number;
  signaux: string[];
  emailContact: string | null;
  telephone: string | null;
  verifieLe: string | null;
}

/** Prospect normalisé, prêt à être stocké ou exporté. */
export interface Prospect {
  siren: string;
  siret_siege: string | null;
  nom: string;
  enseigne: string | null;
  activite_code: string | null;
  activite_section: string | null;
  nature_juridique: string | null;
  categorie_entreprise: string | null;
  date_creation: string | null;
  tranche_effectif: string | null;
  effectif_estime: number | null;
  chiffre_affaires: number | null;
  annee_finances: number | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  departement: string | null;
  latitude: number | null;
  longitude: number | null;
  dirigeant: string | null;
  site_web: string | null;
  site_statut: StatutSite;
  site_score: number | null;
  site_signaux: string[];
  site_verifie_le: string | null;
  email_contact: string | null;
  telephone: string | null;
  budget_score: number;
  score: number;
  priorite: PrioriteProspect;
}
