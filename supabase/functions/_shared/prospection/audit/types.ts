// Types du moteur d'audit (SEO, design, sécurité, technique).
// Portable Deno / Node : aucun import spécifique à un runtime.

export type Pilier = "seo" | "design" | "securite" | "technique";
export type Severite = "critique" | "majeur" | "mineur";
export type Effort = "faible" | "moyen" | "eleve";
export type Urgence = "critique" | "elevee" | "moyenne" | "faible";
export type Profondeur = "rapide" | "complet";

/** Règle d'audit : ce qui est vérifié, ce que ça coûte au client, ce que ça nous fait vendre. */
export interface Regle {
  pilier: Pilier;
  severite: Severite;
  /** Points retirés au score du pilier quand la règle est en défaut (0-100). */
  poids: number;
  /** Titre lisible par le prospect. */
  titre: string;
  /** Conséquence commerciale, formulée pour être lue par le dirigeant. */
  impact: string;
  effort: Effort;
  /** Codes de prestations du catalogue qui corrigent ce défaut. */
  prestations: string[];
}

/** Règle constatée sur un site donné. */
export interface Finding extends Regle {
  regle: string;
  /** Détail mesuré (« title de 12 caractères », « jQuery 1.7.2 »…). */
  constat: string;
}

export interface ScoresAudit {
  global: number;
  seo: number;
  design: number;
  securite: number;
  technique: number;
  urgence: Urgence;
}

/** Réponse HTTP normalisée (en-têtes en minuscules). */
export interface ReponseHttp {
  url: string;
  urlFinale: string;
  statut: number;
  html: string;
  entetes: Record<string, string>;
  cookies: string[];
  dureeMs: number;
  octets: number;
}

export interface DonneesDns {
  mx: string[];
  spf: string | null;
  dmarc: string | null;
}

export interface ResultatLighthouse {
  performance: number | null;
  seo: number | null;
  accessibilite: number | null;
  bonnesPratiques: number | null;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  octets: number | null;
  requetes: number | null;
  /** Sous-ensemble d'audits Lighthouse : id → réussi ou non. */
  audits: Record<string, { note: number | null; reussi: boolean }>;
  captureDataUri: string | null;
}

export interface FichierExpose {
  chemin: string;
  statut: number;
  indice: string;
}

/** Tout ce qui a été collecté sur un site, avant application des règles. */
export interface ContexteAudit {
  url: string;
  accueil: ReponseHttp | null;
  /** null si non testable (site déjà en HTTPS non joignable en HTTP). */
  redirigeVersHttps: boolean | null;
  robots: { present: boolean; contenu: string } | null;
  sitemap: { present: boolean; urls: number } | null;
  pageInterne: ReponseHttp | null;
  page404: { statut: number; personnalisee: boolean } | null;
  dns: DonneesDns | null;
  lighthouse: ResultatLighthouse | null;
  fichiersExposes: FichierExpose[] | null;
  anneeCourante: number;
  erreurs: string[];
}

/** Résultat complet d'un audit, tel que stocké et affiché. */
export interface AuditSiteComplet {
  url: string;
  urlFinale: string | null;
  profondeur: Profondeur;
  scores: ScoresAudit;
  findings: Finding[];
  lighthouse: ResultatLighthouse | null;
  fichiersExposes: FichierExpose[];
  captureDataUri: string | null;
  emailContact: string | null;
  telephone: string | null;
  erreurs: string[];
  dureeMs: number;
}
