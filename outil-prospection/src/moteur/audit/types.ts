// Types du moteur d'audit (SEO, design, sécurité, technique).
// Aucun import spécifique à un runtime : ce fichier doit rester portable.

import type { ArchiveSite } from "./archive.ts";
import type { CertificatTls } from "./certificat.ts";
import type { Contacts } from "./contacts.ts";

export type Pilier = "seo" | "design" | "securite" | "technique";
export type Severite = "critique" | "majeur" | "mineur";
export type Effort = "faible" | "moyen" | "eleve";
export type Urgence = "critique" | "elevee" | "moyenne" | "faible";
export type Profondeur = "rapide" | "complet";

/**
 * Ce qu'on sait de l'accès au site :
 * - `ok` : page récupérée, l'audit est exploitable ;
 * - `erreur_serveur` : le serveur répond en erreur, c'est un vrai défaut du site ;
 * - `bloque` : nous n'avons pas pu voir le site (pare-feu applicatif, réseau) alors que le
 *   domaine existe — aucune conclusion possible, l'audit est non concluant ;
 * - `injoignable` : le domaine ne résout pas, le site est réellement hors ligne.
 */
export type Accessibilite = "ok" | "erreur_serveur" | "bloque" | "injoignable";

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
  /**
   * Volets dont une source de mesure a manqué : leur note est optimiste par construction
   * (un défaut non cherché n'est pas retiré). Affiché tel quel dans l'interface et le rapport.
   */
  partiels?: Pilier[];
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

/**
 * Enregistrement DNS interrogé. `verifie: false` signifie que la requête n'a pas abouti :
 * les règles doivent alors s'abstenir de conclure à une absence de protection.
 */
export interface EnregistrementDns<T> {
  verifie: boolean;
  valeur: T;
}

export interface DonneesDns {
  mx: EnregistrementDns<string[]>;
  spf: EnregistrementDns<string | null>;
  dmarc: EnregistrementDns<string | null>;
}

/**
 * Mesures issues des vrais visiteurs (Chrome UX Report), renvoyées par PageSpeed dans le même
 * appel et sans clé. Plus crédibles qu'un test en laboratoire : ce sont les temps que les
 * clients du prospect subissent réellement, sur leurs téléphones et leurs réseaux.
 */
export interface MesuresTerrain {
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  categorie: "FAST" | "AVERAGE" | "SLOW" | null;
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
  /** Données des visiteurs réels sur les 28 derniers jours, null si le trafic est trop faible. */
  terrain: MesuresTerrain | null;
  captureDataUri: string | null;
}

/** Lien interne qui ne mène nulle part. */
export interface LienCasse {
  url: string;
  statut: number;
  texte: string;
}

/** Image de la page d'accueil et son poids réel, lu dans l'en-tête `content-length`. */
export interface ImageMesuree {
  url: string;
  octets: number;
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
  accessibilite: Accessibilite;
  /** Le domaine résout-il ? `null` si le résolveur n'a pas répondu. */
  resolutionDns: boolean | null;
  /** null si non testable (site déjà en HTTPS non joignable en HTTP). */
  redirigeVersHttps: boolean | null;
  /** L'adresse avec et sans « www » servent la même page sans redirection. null = non tranché. */
  wwwDuplique: boolean | null;
  /** Motif d'échec TLS (« certificat expiré »…), null si la connexion HTTPS a abouti. */
  erreurCertificat: string | null;
  /** Liens internes vérifiés et ceux qui sont cassés. null = vérification non effectuée. */
  liens: { verifies: number; casses: LienCasse[] } | null;
  /** Poids réel des images, la plus lourde d'abord. null = mesure non effectuée. */
  imagesMesurees: ImageMesuree[] | null;
  /** Historique Internet Archive. null = site inconnu de l'archive ou requête non faite. */
  archive: ArchiveSite | null;
  /** Certificat TLS présenté par le site. null = lecture impossible ou site en HTTP. */
  certificat: CertificatTls | null;
  robots: { present: boolean; contenu: string } | null;
  sitemap: { present: boolean; urls: number } | null;
  pageInterne: ReponseHttp | null;
  /** Pages « Contact » / « Mentions légales », lues pour les coordonnées. */
  pagesContact: ReponseHttp[];
  contacts: Contacts;
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
  accessibilite: Accessibilite;
  /**
   * Faux quand le site n'a pas pu être observé : les scores ne veulent alors rien dire,
   * aucun défaut n'est affirmé et aucune proposition commerciale n'est construite.
   */
  concluant: boolean;
  scores: ScoresAudit;
  findings: Finding[];
  lighthouse: ResultatLighthouse | null;
  fichiersExposes: FichierExpose[];
  captureDataUri: string | null;
  /** Plateforme identifiée (Wix, WordPress, Shopify…) : un argument, pas un défaut. */
  technologie: string | null;
  /** Historique public du site (Internet Archive), null si inconnu. */
  archive: ArchiveSite | null;
  /** Certificat TLS : émetteur, expiration, version du protocole. */
  certificat: CertificatTls | null;
  /** Coordonnées publiées sur le site : c'est avec ça qu'on démarche. */
  contacts: Contacts;
  /** Raccourcis vers le meilleur contact trouvé (compatibilité et affichage). */
  emailContact: string | null;
  telephone: string | null;
  erreurs: string[];
  dureeMs: number;
}
