// Logique métier pure du module de prospection : construction des requêtes,
// normalisation des entreprises, scoring budget, audit HTML, export CSV.
// Aucun appel réseau ici — tout est testable unitairement (voir core.test.ts).

import { TRANCHES_EFFECTIF } from "./naf.ts";
import type {
  AuditSite,
  CibleProspection,
  EntrepriseApi,
  PrioriteProspect,
  Prospect,
  ProspectionFilters,
  StatutSite,
} from "./types.ts";

export const API_RECHERCHE_ENTREPRISES = "https://recherche-entreprises.api.gouv.fr/search";

/** Nombre maximum de résultats par page accepté par l'API. */
export const MAX_PER_PAGE = 25;
/** Garde-fou : on ne parcourt jamais plus de 10 pages par run (250 entreprises). */
export const MAX_PAGES = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Requête API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construit les paramètres de l'API Recherche d'entreprises pour une page donnée.
 * Les entreprises fermées sont systématiquement exclues (`etat_administratif=A`).
 */
export function construireParamsRecherche(
  filters: ProspectionFilters,
  page = 1,
): Record<string, string> {
  const params: Record<string, string> = {
    page: String(Math.max(1, page)),
    per_page: String(Math.min(MAX_PER_PAGE, Math.max(1, filters.perPage ?? MAX_PER_PAGE))),
    etat_administratif: "A",
  };

  const texte = filters.q?.trim();
  if (texte) params.q = texte;
  if (filters.departement) params.departement = filters.departement.trim();
  if (filters.codePostal) params.code_postal = filters.codePostal.trim();
  if (filters.codeCommune) params.code_commune = filters.codeCommune.trim();
  if (filters.region) params.region = filters.region.trim();
  if (filters.activitePrincipale?.length) {
    params.activite_principale = filters.activitePrincipale.join(",");
  }
  if (filters.sectionActivitePrincipale?.length) {
    params.section_activite_principale = filters.sectionActivitePrincipale.join(",");
  }
  if (filters.categorieEntreprise?.length) {
    params.categorie_entreprise = filters.categorieEntreprise.join(",");
  }
  if (filters.trancheEffectif?.length) {
    params.tranche_effectif_salarie = filters.trancheEffectif.join(",");
  }
  if (filters.creeApres) params.date_creation_min = filters.creeApres;
  if (filters.creeAvant) params.date_creation_max = filters.creeAvant;
  if (typeof filters.caMin === "number") params.ca_min = String(Math.round(filters.caMin));
  if (typeof filters.caMax === "number") params.ca_max = String(Math.round(filters.caMax));

  return params;
}

/** Vérifie qu'au moins un critère discriminant est fourni (l'API refuse une requête vide). */
export function filtresValides(filters: ProspectionFilters): boolean {
  return Boolean(
    filters.q?.trim() ||
      filters.departement ||
      filters.codePostal ||
      filters.codeCommune ||
      filters.region ||
      filters.activitePrincipale?.length ||
      filters.sectionActivitePrincipale?.length,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation
// ─────────────────────────────────────────────────────────────────────────────

function nombreOuNull(valeur: unknown): number | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const n = Number(valeur);
  return Number.isFinite(n) ? n : null;
}

/** Dernier exercice comptable publié (le plus récent). */
export function dernieresFinances(
  finances: EntrepriseApi["finances"],
): { annee: number; ca: number | null } | null {
  if (!finances) return null;
  const annees = Object.keys(finances)
    .map((a) => Number(a))
    .filter((a) => Number.isFinite(a))
    .sort((a, b) => b - a);
  if (!annees.length) return null;
  const annee = annees[0];
  return { annee, ca: nombreOuNull(finances[String(annee)]?.ca) };
}

/** Nom lisible du dirigeant principal (personne physique ou morale). */
export function dirigeantPrincipal(dirigeants: EntrepriseApi["dirigeants"]): string | null {
  if (!dirigeants?.length) return null;
  const d = dirigeants[0];
  if (d.denomination) return d.denomination;
  const nom = [d.prenoms, d.nom].filter(Boolean).join(" ").trim();
  return nom || null;
}

/** Convertit une entreprise de l'API en prospect normalisé (sans audit de site). */
export function mapEntreprise(raw: EntrepriseApi): Prospect | null {
  const siren = raw.siren?.trim();
  const nom = (raw.nom_complet || raw.nom_raison_sociale || "").trim();
  if (!siren || !nom) return null;

  const siege = raw.siege ?? {};
  const finances = dernieresFinances(raw.finances);
  const enseigne = siege.liste_enseignes?.find((e) => e && e.trim()) ?? null;
  const tranche = raw.tranche_effectif_salarie ?? null;

  const prospect: Prospect = {
    siren,
    siret_siege: siege.siret ?? null,
    nom,
    enseigne,
    activite_code: raw.activite_principale ?? siege.activite_principale ?? null,
    activite_section: raw.section_activite_principale ?? null,
    nature_juridique: raw.nature_juridique ?? null,
    categorie_entreprise: raw.categorie_entreprise ?? null,
    date_creation: raw.date_creation ?? null,
    tranche_effectif: tranche,
    effectif_estime: tranche ? (TRANCHES_EFFECTIF[tranche]?.moyenne ?? null) : null,
    chiffre_affaires: finances?.ca ?? null,
    annee_finances: finances?.annee ?? null,
    adresse: siege.adresse ?? null,
    code_postal: siege.code_postal ?? null,
    ville: siege.libelle_commune ?? null,
    departement: siege.departement ?? null,
    latitude: nombreOuNull(siege.latitude),
    longitude: nombreOuNull(siege.longitude),
    dirigeant: dirigeantPrincipal(raw.dirigeants),
    site_web: null,
    site_statut: "non_verifie",
    site_score: null,
    site_signaux: [],
    site_verifie_le: null,
    email_contact: null,
    telephone: null,
    budget_score: 0,
    score: 0,
    priorite: "froid",
  };

  prospect.budget_score = scoreBudget(prospect, raw.nombre_etablissements_ouverts ?? null);
  const { score, priorite } = scoreProspect(prospect);
  prospect.score = score;
  prospect.priorite = priorite;
  return prospect;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────────────────────

function borne(valeur: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(valeur)));
}

/** Âge de l'entreprise en mois, ou null si la date de création est inconnue. */
export function ageEnMois(dateCreation: string | null, maintenant = new Date()): number | null {
  if (!dateCreation) return null;
  const creation = new Date(dateCreation);
  if (Number.isNaN(creation.getTime())) return null;
  const mois =
    (maintenant.getFullYear() - creation.getFullYear()) * 12 +
    (maintenant.getMonth() - creation.getMonth());
  return Math.max(0, mois);
}

/**
 * Capacité estimée à financer un site web (0 → aucun budget, 100 → budget confortable).
 * Combine effectif, chiffre d'affaires, forme juridique, catégorie INSEE et fraîcheur.
 */
export function scoreBudget(
  prospect: Pick<
    Prospect,
    | "effectif_estime"
    | "chiffre_affaires"
    | "nature_juridique"
    | "categorie_entreprise"
    | "date_creation"
  >,
  nombreEtablissements: number | null = null,
  maintenant = new Date(),
): number {
  let score = 20; // socle : une entreprise active a toujours un minimum de capacité

  const effectif = prospect.effectif_estime;
  if (effectif !== null) {
    if (effectif >= 250) score += 15; // grands comptes : budget élevé mais cycle de vente long
    else if (effectif >= 50) score += 25;
    else if (effectif >= 10) score += 30;
    else if (effectif >= 3) score += 22;
    else if (effectif >= 1) score += 10;
  }

  const ca = prospect.chiffre_affaires;
  if (ca !== null) {
    if (ca >= 10_000_000) score += 14;
    else if (ca >= 2_000_000) score += 22;
    else if (ca >= 500_000) score += 26;
    else if (ca >= 150_000) score += 18;
    else if (ca >= 50_000) score += 8;
  }

  const nj = prospect.nature_juridique ?? "";
  if (nj.startsWith("57")) score += 12; // SAS / SASU
  else if (nj.startsWith("54")) score += 10; // SARL / EURL
  else if (nj.startsWith("55") || nj.startsWith("56")) score += 8; // SA
  else if (nj.startsWith("92")) score += 4; // associations
  else if (nj.startsWith("1")) score += 2; // entrepreneur individuel

  const categorie = prospect.categorie_entreprise ?? "";
  if (categorie === "PME") score += 6;
  else if (categorie === "ETI") score += 4;
  else if (categorie === "GE") score += 2;

  if ((nombreEtablissements ?? 0) >= 2) score += 6;

  // Entreprise récente : budget de lancement encore disponible.
  const age = ageEnMois(prospect.date_creation, maintenant);
  if (age !== null && age <= 18) score += 8;

  return borne(score);
}

/** Opportunité commerciale liée à l'état du site (0 → rien à vendre, 100 → besoin criant). */
export function opportuniteSite(statut: StatutSite, siteScore: number | null): number {
  switch (statut) {
    case "aucun_site":
      return 100;
    case "site_injoignable":
      return 90;
    case "non_verifie":
      return 50; // neutre : on ne pénalise ni ne survend
    default:
      return borne(siteScore ?? 50);
  }
}

/** Score global du prospect : 55 % opportunité site, 45 % capacité budgétaire. */
export function scoreProspect(
  prospect: Pick<Prospect, "site_statut" | "site_score" | "budget_score">,
): { score: number; priorite: PrioriteProspect } {
  const opportunite = opportuniteSite(prospect.site_statut, prospect.site_score);
  const score = borne(0.55 * opportunite + 0.45 * prospect.budget_score);
  const priorite: PrioriteProspect = score >= 70 ? "chaud" : score >= 50 ? "tiede" : "froid";
  return { score, priorite };
}

/** Applique un audit de site à un prospect et recalcule son score global. */
export function appliqueAudit(prospect: Prospect, audit: AuditSite): Prospect {
  const enrichi: Prospect = {
    ...prospect,
    site_web: audit.url,
    site_statut: audit.statut,
    site_score: audit.statut === "non_verifie" ? null : audit.score,
    site_signaux: audit.signaux,
    site_verifie_le: audit.verifieLe,
    email_contact: audit.emailContact ?? prospect.email_contact,
    telephone: audit.telephone ?? prospect.telephone,
  };
  const { score, priorite } = scoreProspect(enrichi);
  enrichi.score = score;
  enrichi.priorite = priorite;
  return enrichi;
}

/** Ne garde que les prospects correspondant à la cible commerciale demandée. */
export function filtreSelonCible(prospects: Prospect[], cible: CibleProspection = "tous"): Prospect[] {
  if (cible === "sans_site") {
    return prospects.filter((p) => p.site_statut === "aucun_site" || p.site_statut === "site_injoignable");
  }
  if (cible === "site_a_refaire") {
    return prospects.filter((p) => p.site_statut === "site_obsolete" || p.site_statut === "site_a_rafraichir");
  }
  return prospects;
}

// ─────────────────────────────────────────────────────────────────────────────
// Détection de domaine
// ─────────────────────────────────────────────────────────────────────────────

const FORMES_JURIDIQUES = [
  "sarl", "sas", "sasu", "eurl", "sci", "snc", "sa", "scop", "scm", "selarl",
  "ei", "eirl", "gie", "association", "societe", "ste", "ets", "etablissements",
  "entreprise", "groupe", "holding", "monsieur", "madame", "mr", "mme",
];

/** Retire accents, ponctuation et formes juridiques d'une raison sociale. */
export function normaliseNom(nom: string): string {
  const sansAccents = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const mots = sansAccents
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .filter((mot) => !FORMES_JURIDIQUES.includes(mot));
  return mots.join(" ").trim();
}

/**
 * Génère les domaines les plus probables pour une entreprise.
 * Volontairement conservateur : on privilégie la raison sociale complète et l'enseigne,
 * la vérification de correspondance (`domaineCorrespond`) écarte ensuite les faux positifs.
 */
export function candidatsDomaines(nom: string, enseigne?: string | null, max = 6): string[] {
  const bases = new Set<string>();
  for (const source of [enseigne, nom]) {
    if (!source) continue;
    const normalise = normaliseNom(source);
    if (normalise.length < 3) continue;
    const compact = normalise.replace(/ /g, "");
    if (compact.length >= 3 && compact.length <= 40) bases.add(compact);
    const tirets = normalise.replace(/ /g, "-");
    if (tirets !== compact && tirets.length <= 40) bases.add(tirets);
  }

  const domaines: string[] = [];
  for (const base of bases) {
    for (const tld of [".fr", ".com"]) {
      if (domaines.length >= max) break;
      domaines.push(base + tld);
    }
  }
  return domaines;
}

const MARQUEURS_PARKING = [
  "domain is for sale",
  "ce nom de domaine est",
  "domaine à vendre",
  "parkingcrew",
  "sedoparking",
  "buy this domain",
  "site en construction",
  "under construction",
  "page en cours de construction",
  "coming soon",
  "bientôt disponible",
  "default web page",
  "apache2 debian default page",
  "welcome to nginx",
];

/** Détecte une page parking / vitrine vide / page par défaut du serveur. */
export function estPageParking(html: string): boolean {
  const texte = html.toLowerCase();
  if (MARQUEURS_PARKING.some((m) => texte.includes(m))) return true;
  // Page quasi vide : moins de 200 caractères de texte visible.
  const visible = texte
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return visible.length < 200;
}

/** Vérifie que la page appartient bien à l'entreprise (au moins un mot significatif en commun). */
export function domaineCorrespond(html: string, nom: string, enseigne?: string | null): boolean {
  const texte = html
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const motsCles = new Set<string>();
  for (const source of [nom, enseigne]) {
    if (!source) continue;
    normaliseNom(source)
      .split(" ")
      .filter((mot) => mot.length >= 4)
      .forEach((mot) => motsCles.add(mot));
  }
  if (!motsCles.size) return false;
  return [...motsCles].some((mot) => texte.includes(mot));
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit HTML
// ─────────────────────────────────────────────────────────────────────────────

export interface ContexteAudit {
  /** URL finale après redirections. */
  urlFinale: string;
  statutHttp: number;
  dureeMs: number;
  /** Taille de la réponse en octets. */
  octets: number;
  anneeCourante?: number;
}

/**
 * Analyse le HTML d'une page d'accueil et retourne un score d'obsolescence
 * (0 = site moderne, 100 = site à refaire) accompagné des signaux détectés.
 */
export function analyseHtml(html: string, ctx: ContexteAudit): { score: number; signaux: string[] } {
  const signaux: string[] = [];
  let score = 0;
  const bas = html.toLowerCase();
  const annee = ctx.anneeCourante ?? new Date().getFullYear();

  const ajoute = (points: number, signal: string) => {
    score += points;
    signaux.push(signal);
  };

  if (!ctx.urlFinale.startsWith("https://")) {
    ajoute(25, "Pas de HTTPS (site non sécurisé)");
  }
  if (!/<meta[^>]+name=["']?viewport/i.test(html)) {
    ajoute(30, "Non responsive : aucune balise viewport");
  }
  if (/<(font|center|marquee|frameset|frame|blink)\b/i.test(html)) {
    ajoute(20, "Balises HTML obsolètes (font, center, frameset…)");
  }
  if (/\b(bgcolor|cellpadding|cellspacing)\s*=/i.test(html)) {
    ajoute(12, "Mise en page à base de tableaux HTML");
  }
  if (/application\/x-shockwave-flash|\.swf\b/i.test(html)) {
    ajoute(30, "Contenu Flash (technologie morte depuis 2020)");
  }

  const jquery = bas.match(/jquery[.-]?(\d+)\.(\d+)(?:\.(\d+))?(?:\.min)?\.js/);
  if (jquery && Number(jquery[1]) < 2) {
    ajoute(12, `jQuery ${jquery[1]}.${jquery[2]} (version abandonnée)`);
  }

  const generator = html.match(/<meta[^>]+name=["']?generator["']?[^>]+content=["']([^"']+)["']/i);
  if (generator) {
    const outil = generator[1];
    const wp = outil.match(/wordpress\s+(\d+)\.(\d+)/i);
    if (wp && Number(wp[1]) < 6) {
      ajoute(18, `WordPress ${wp[1]}.${wp[2]} obsolète (faille de sécurité probable)`);
    } else if (/joomla!?\s*[123]\./i.test(outil) || /drupal\s*[567]/i.test(outil)) {
      ajoute(18, `CMS obsolète : ${outil}`);
    } else if (/frontpage|dreamweaver|publisher|jimdo|1&1|ionos mywebsite/i.test(outil)) {
      ajoute(20, `Générateur daté : ${outil}`);
    }
  }

  const copyright = [...bas.matchAll(/(?:©|&copy;|copyright)[^0-9]{0,20}(19|20)(\d{2})/g)]
    .map((m) => Number(`${m[1]}${m[2]}`))
    .filter((a) => a >= 1990 && a <= annee);
  if (copyright.length) {
    const derniere = Math.max(...copyright);
    const ecart = annee - derniere;
    if (ecart >= 5) ajoute(25, `Copyright ${derniere} : site laissé à l'abandon depuis ${ecart} ans`);
    else if (ecart >= 3) ajoute(15, `Copyright ${derniere} : contenu non mis à jour`);
  }

  if (!/<meta[^>]+property=["']?og:/i.test(html)) {
    ajoute(8, "Pas de balises Open Graph (mauvais partage sur les réseaux)");
  }
  if (!/<meta[^>]+name=["']?description/i.test(html)) {
    ajoute(8, "Pas de meta description (SEO dégradé)");
  }
  if (!/<link[^>]+rel=["']?[^"'>]*icon/i.test(html)) {
    ajoute(5, "Pas de favicon");
  }
  if (ctx.dureeMs > 3000) {
    ajoute(10, `Page lente : ${(ctx.dureeMs / 1000).toFixed(1)} s de chargement`);
  }
  if (ctx.octets > 2_000_000) {
    ajoute(8, `Page très lourde : ${(ctx.octets / 1_000_000).toFixed(1)} Mo`);
  }
  if (ctx.statutHttp >= 400) {
    ajoute(35, `Erreur HTTP ${ctx.statutHttp} sur la page d'accueil`);
  }

  if (!signaux.length) signaux.push("Site moderne : aucun signal d'obsolescence détecté");
  return { score: borne(score), signaux };
}

/** Traduit un score d'obsolescence en statut exploitable commercialement. */
export function statutDepuisScoreSite(score: number): StatutSite {
  if (score >= 55) return "site_obsolete";
  if (score >= 30) return "site_a_rafraichir";
  return "site_recent";
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction de contacts
// ─────────────────────────────────────────────────────────────────────────────

const EMAILS_A_IGNORER = /(sentry|wixpress|example\.|@2x|\.png|\.jpg|\.jpeg|\.webp|\.gif|\.svg)/i;
const EMAILS_GENERIQUES = ["contact@", "info@", "bonjour@", "hello@", "accueil@", "commercial@"];

/** Extrait un email professionnel et un téléphone français depuis le HTML d'un site. */
export function extraitContacts(html: string): { email: string | null; telephone: string | null } {
  const emails = [...html.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)]
    .map((m) => m[0].toLowerCase())
    .filter((e) => !EMAILS_A_IGNORER.test(e));
  const uniques = [...new Set(emails)];
  const email =
    uniques.find((e) => EMAILS_GENERIQUES.some((prefixe) => e.startsWith(prefixe))) ??
    uniques[0] ??
    null;

  const tel = html.match(/(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/);
  const telephone = tel ? tel[0].replace(/[\s.-]+/g, " ").trim() : null;

  return { email, telephone };
}

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

const COLONNES_CSV: Array<[string, (p: Prospect) => unknown]> = [
  ["Score", (p) => p.score],
  ["Priorité", (p) => p.priorite],
  ["Nom", (p) => p.nom],
  ["Enseigne", (p) => p.enseigne],
  ["SIREN", (p) => p.siren],
  ["Activité", (p) => p.activite_code],
  ["Créée le", (p) => p.date_creation],
  ["Effectif", (p) => p.effectif_estime],
  ["CA", (p) => p.chiffre_affaires],
  ["Adresse", (p) => p.adresse],
  ["Code postal", (p) => p.code_postal],
  ["Ville", (p) => p.ville],
  ["Dirigeant", (p) => p.dirigeant],
  ["Site web", (p) => p.site_web],
  ["État du site", (p) => p.site_statut],
  ["Score site", (p) => p.site_score],
  ["Signaux", (p) => p.site_signaux.join(" | ")],
  ["Email", (p) => p.email_contact],
  ["Téléphone", (p) => p.telephone],
];

function celluleCsv(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return "";
  const texte = String(valeur);
  return /[";\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

/** Export CSV séparé par point-virgule (compatible Excel FR). */
export function versCsv(prospects: Prospect[]): string {
  const lignes = [COLONNES_CSV.map(([entete]) => entete).join(";")];
  for (const prospect of prospects) {
    lignes.push(COLONNES_CSV.map(([, valeur]) => celluleCsv(valeur(prospect))).join(";"));
  }
  return lignes.join("\n");
}
