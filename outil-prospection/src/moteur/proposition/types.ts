// Types de la proposition commerciale (devis et documents de démarchage).

import type { AuditSiteComplet, Finding } from "../audit/types.ts";
import type { Prospect } from "../types.ts";

/** Prestation du catalogue (table `prestations`). */
export interface Prestation {
  code: string;
  libelle: string;
  description?: string | null;
  prix: number;
  unite: "forfait" | "mois";
  categorie: string;
  actif?: boolean;
  ordre?: number;
}

export interface LigneDevis {
  code: string;
  libelle: string;
  description: string | null;
  quantite: number;
  prix_unitaire: number;
  unite: "forfait" | "mois";
  total: number;
  /** Défauts d'audit qui justifient cette ligne (affichés dans le rapport). */
  motifs: string[];
}

export interface Devis {
  /** Prestations facturées une fois (le projet). */
  lignes_projet: LigneDevis[];
  /** Prestations mensuelles (l'accompagnement). */
  lignes_recurrentes: LigneDevis[];
  sous_total_ht: number;
  remise: number;
  taux_remise: number;
  total_ht: number;
  taux_tva: number;
  tva: number;
  total_ttc: number;
  mensuel_ht: number;
  valide_jusqu_au: string;
}

/** Identité de l'émetteur, lue dans `site_settings`. */
export interface Emetteur {
  raison_sociale: string;
  siret: string;
  adresse: string;
  email: string;
  telephone: string;
  /** Site web de l'émetteur, montré dans les emails et le rapport (ex. https://smartfixx.fr). */
  site_web: string;
  taux_tva: number;
  validite_jours: number;
  mentions: string;
}

export interface ContexteProposition {
  prospect: Pick<
    Prospect,
    "nom" | "enseigne" | "ville" | "code_postal" | "activite_code" | "dirigeant" | "site_web" | "site_statut"
  >;
  audit: AuditSiteComplet | null;
  devis: Devis;
  emetteur: Emetteur;
  /** Défauts mis en avant (3 par défaut). */
  arguments: Finding[];
}

export interface DocumentsProposition {
  synthese: string;
  email: { objet: string; corps: string };
  /** Même message que `email`, mis en page pour un client mail (styles en ligne). */
  email_html: string;
  /** Email d'approche (premier contact) : présentation de l'agence, pas de devis. */
  email_intro: { objet: string; corps: string };
  /** Version HTML de l'email d'approche. */
  email_intro_html: string;
  sms: string;
  script_appel: string;
  rapport_html: string;
  genere_par_ia: boolean;
}
