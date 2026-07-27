#!/usr/bin/env node
// Serveur local de l'outil de prospection : API JSON + interface statique, un seul processus,
// zéro dépendance d'exécution (uniquement les modules `node:`).
//
//   npm start                → http://127.0.0.1:4000
//   PORT=4100 npm start      → autre port
//
// Écoute volontairement sur 127.0.0.1 : l'outil manipule des données de prospection et n'a
// aucune authentification — il ne doit pas être exposé sur le réseau.

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import process from "node:process";

import {
  ageEnMois, appliqueAudit, appliqueFiltres, categorieEcart, dateIlYaNMois, filtreSelonCible, filtresValides,
  respecteFiltres, scoreProspect, versCsv,
} from "../moteur/core.ts";
import { nafDesSecteurs, SECTEURS_CIBLES, TRANCHES_EFFECTIF } from "../moteur/naf.ts";
import { rechercheEntreprises } from "../moteur/sirene.ts";
import {
  CATEGORIES_OSM, chercheCommerces, prospectDepuisCommerce, type FiltresOsm,
} from "../moteur/osm.ts";
import { auditeProspects, detecteEtAuditeSite } from "../moteur/website.ts";
import type { CibleProspection, ProspectionFilters, StatutSite } from "../moteur/types.ts";
import { auditeSite, normaliseUrl } from "../moteur/audit/index.ts";
import { domaine as domaineDe, nomDepuisDomaine } from "../moteur/audit/http.ts";
import { echappeHtml } from "../moteur/audit/html.ts";
import { rechercheGoogleMaps } from "../moteur/audit/contacts.ts";
import { LIBELLES_EFFORT, LIBELLES_PILIERS, LIBELLES_SEVERITE } from "../moteur/audit/regles.ts";
import type { AuditSiteComplet, Profondeur } from "../moteur/audit/types.ts";
import { construitProposition } from "../moteur/proposition/index.ts";
import type { Emetteur, Prestation } from "../moteur/proposition/types.ts";
import { Stockage, type ProspectStocke, type StatutCommercial } from "./stockage.ts";

const PORT = Number(process.env.PORT ?? 4000);
/**
 * Lève le garde-fou anti-SSRF pour auditer un serveur local (127.0.0.1, réseau privé).
 * Réservé aux tests : l'outil refuse ces adresses par défaut.
 */
const AUTORISE_LOCAL = process.env.AUTORISE_LOCAL === "1";
const RACINE_PUBLIQUE = resolve(import.meta.dirname, "..", "..", "public");
const TAILLE_MAX_CORPS = 1_000_000;

const nombreFr = (valeur: number) => new Intl.NumberFormat("fr-FR").format(valeur);

const STATUTS: StatutCommercial[] = [
  "nouveau", "a_contacter", "contacte", "rdv", "gagne", "perdu", "ignore",
];

/** États de site corrigeables à la main depuis la fiche. */
const STATUTS_SITE: StatutSite[] = [
  "non_verifie", "aucun_site", "site_injoignable", "site_obsolete", "site_a_rafraichir", "site_recent",
];

/** Opportunité commerciale associée à un état déclaré à la main. */
/**
 * Jusqu'où descendre dans le classement de l'API quand l'objectif n'est pas atteint.
 * 60 pages × 25 = 1 500 entreprises examinées au maximum ; c'est la durée ci-dessous qui
 * arrête réellement la recherche, ce plafond n'est qu'un garde-fou.
 */
const PAGES_MAX_RECHERCHE = 60;
/** Au-delà, on rend ce qu'on a trouvé : mieux vaut un résultat partiel qu'une page qui tourne. */
const DUREE_MAX_RECHERCHE_MS = 25_000;
/** Nombre d'entreprises « les plus jeunes trouvées » remontées quand rien ne passe le filtre. */
const NB_PLUS_JEUNES = 8;

const OPPORTUNITE_PAR_STATUT: Record<StatutSite, number> = {
  non_verifie: 50,
  aucun_site: 100,
  site_injoignable: 90,
  site_obsolete: 75,
  site_a_rafraichir: 45,
  site_recent: 15,
};

const stockage = new Stockage(
  process.env.DONNEES ? resolve(process.env.DONNEES) : undefined,
);

const TYPES_MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

// ── Utilitaires HTTP ────────────────────────────────────────────────────────

function envoieJson(res: ServerResponse, donnees: unknown, statut = 200): void {
  const corps = JSON.stringify(donnees);
  res.writeHead(statut, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(corps),
    "Cache-Control": "no-store",
  });
  res.end(corps);
}

function envoieHtml(res: ServerResponse, html: string, statut = 200): void {
  res.writeHead(statut, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(html),
    "Cache-Control": "no-store",
  });
  res.end(html);
}

async function litCorps(req: IncomingMessage): Promise<Record<string, unknown>> {
  const morceaux: Buffer[] = [];
  let taille = 0;
  for await (const morceau of req) {
    taille += (morceau as Buffer).length;
    if (taille > TAILLE_MAX_CORPS) throw new Error("Corps de requête trop volumineux");
    morceaux.push(morceau as Buffer);
  }
  if (!morceaux.length) return {};
  const texte = Buffer.concat(morceaux).toString("utf8");
  try {
    const valeur = JSON.parse(texte) as unknown;
    return valeur && typeof valeur === "object" ? (valeur as Record<string, unknown>) : {};
  } catch {
    throw new Error("Corps de requête JSON invalide");
  }
}

/** Sert un fichier de `public/`, sans jamais sortir du dossier. */
function servFichierStatique(res: ServerResponse, chemin: string): void {
  const relatif = normalize(decodeURIComponent(chemin)).replace(/^(\.\.[/\\])+/, "");
  const cible = join(RACINE_PUBLIQUE, relatif === "/" || relatif === "\\" ? "index.html" : relatif);
  if (!cible.startsWith(RACINE_PUBLIQUE) || !existsSync(cible) || !statSync(cible).isFile()) {
    envoieJson(res, { error: "Introuvable" }, 404);
    return;
  }
  res.writeHead(200, {
    "Content-Type": TYPES_MIME[extname(cible)] ?? "application/octet-stream",
    "Content-Length": statSync(cible).size,
    "Cache-Control": "no-cache",
  });
  createReadStream(cible).pipe(res);
}

// ── Lecture des paramètres ──────────────────────────────────────────────────

function texte(valeur: unknown, max = 200): string | null {
  if (typeof valeur !== "string") return null;
  const propre = valeur.trim().slice(0, max);
  return propre || null;
}

function nombre(valeur: unknown): number | undefined {
  const converti = Number(valeur);
  return Number.isFinite(converti) ? converti : undefined;
}

/** Construit les filtres Sirene depuis le corps envoyé par l'interface. */
function litFiltres(brut: Record<string, unknown>): ProspectionFilters {
  const secteurs = Array.isArray(brut.secteurs) ? brut.secteurs.map(String) : [];
  const inconnus = secteurs.filter((id) => !SECTEURS_CIBLES.some((s) => s.id === id));
  if (inconnus.length) throw new Error(`Secteur(s) inconnu(s) : ${inconnus.join(", ")}`);

  const depuis = nombre(brut.depuis);
  const cible = (["sans_site", "site_a_refaire", "tous"] as CibleProspection[])
    .find((valeur) => valeur === brut.cible) ?? "tous";

  // Une date explicite l'emporte sur l'ancienneté en mois (l'interface propose les deux).
  const creeApres = dateIso(brut.creeApres) ?? (depuis && depuis > 0 ? dateIlYaNMois(depuis) : undefined);

  return {
    q: texte(brut.q) ?? undefined,
    departement: texte(brut.departement, 3) ?? undefined,
    codePostal: texte(brut.codePostal, 5) ?? undefined,
    activitePrincipale: secteurs.length ? nafDesSecteurs(secteurs) : undefined,
    trancheEffectif: Array.isArray(brut.trancheEffectif)
      ? brut.trancheEffectif.map(String).filter((code) => code in TRANCHES_EFFECTIF)
      : undefined,
    creeApres,
    creeAvant: dateIso(brut.creeAvant),
    caMin: nombre(brut.caMin),
    caMax: nombre(brut.caMax),
    cible,
    // Plafond de pages : la recherche s'arrête avant si l'objectif de prospects est atteint.
    pages: Math.min(Math.max(nombre(brut.pages) ?? 10, 1), 10),
    auditSites: brut.auditSites !== false,
  };
}

/** Date au format YYYY-MM-DD, ou rien : une date bancale ne doit pas filtrer au hasard. */
function dateIso(valeur: unknown): string | undefined {
  const brut = texte(valeur, 10);
  return brut && /^\d{4}-\d{2}-\d{2}$/.test(brut) ? brut : undefined;
}

// ── Traitements longs ───────────────────────────────────────────────────────
// Une recherche sur dix pages, ou l'audit de vingt sites, dure des minutes. Plutôt qu'une
// requête qui semble figée, le travail tourne en tâche de fond et l'interface interroge son
// avancement. En mémoire volontairement : au redémarrage, il n'y a rien à reprendre.

interface Travail {
  id: string;
  genre: "prospection" | "audits";
  etape: string;
  faits: number;
  total: number;
  fini: boolean;
  erreur: string | null;
  resultat: unknown;
  debut: number;
}

const travaux = new Map<string, Travail>();
const MAX_TRAVAUX_CONSERVES = 20;

function creeTravail(genre: Travail["genre"], etape: string): Travail {
  const travail: Travail = {
    id: randomUUID(), genre, etape, faits: 0, total: 0, fini: false,
    erreur: null, resultat: null, debut: Date.now(),
  };
  travaux.set(travail.id, travail);
  // On ne garde que les derniers : l'historique n'a pas d'intérêt après lecture.
  for (const cle of [...travaux.keys()].slice(0, Math.max(0, travaux.size - MAX_TRAVAUX_CONSERVES))) {
    travaux.delete(cle);
  }
  return travail;
}

/** Lance le travail sans attendre, en consignant l'échec plutôt qu'en le perdant. */
function lance(travail: Travail, execution: (travail: Travail) => Promise<unknown>): void {
  execution(travail)
    .then((resultat) => {
      travail.resultat = resultat;
      travail.etape = "terminé";
    })
    .catch((erreur) => {
      travail.erreur = erreur instanceof Error ? erreur.message : String(erreur);
      travail.etape = "échec";
      console.error(`[travail ${travail.genre}] ${travail.erreur}`);
    })
    .finally(() => {
      travail.fini = true;
    });
}

// ── Vues d'un prospect renvoyées à l'interface ──────────────────────────────

/**
 * Vue allégée pour le tableau : uniquement ce qu'il affiche. La vue complète embarque tous les
 * défauts de l'audit et les documents générés — sur mille prospects, cela représentait près de
 * cinq mégaoctets à charger pour dessiner une liste.
 */
function vueListe(prospect: ProspectStocke) {
  const audit = stockage.dernierAudit(prospect.id);
  return {
    id: prospect.id,
    nom: prospect.nom,
    enseigne: prospect.enseigne,
    siren: prospect.siren,
    ville: prospect.ville,
    code_postal: prospect.code_postal,
    departement: prospect.departement,
    activite_code: prospect.activite_code,
    date_creation: prospect.date_creation,
    effectif_estime: prospect.effectif_estime,
    chiffre_affaires: prospect.chiffre_affaires,
    dirigeant: prospect.dirigeant,
    domaine: prospect.domaine,
    site_web: prospect.site_web,
    site_statut: prospect.site_statut,
    email_contact: prospect.email_contact,
    telephone: prospect.telephone,
    google_maps_url: prospect.google_maps_url,
    google_recherche: rechercheGoogleMaps(prospect.nom, prospect.ville, prospect.code_postal),
    score: prospect.score,
    priorite: prospect.priorite,
    statut: prospect.statut,
    score_audit: prospect.score_audit,
    audit_le: prospect.audit_le,
    /** null si jamais audité : le tableau distingue « non audité » et « non concluant ». */
    audit_concluant: audit ? audit.audit.concluant : null,
    proposition_prete: Boolean(stockage.documents(prospect.id)),
  };
}

function vueProspect(prospect: ProspectStocke) {
  const audit = stockage.dernierAudit(prospect.id);
  return {
    ...prospect,
    audit: audit
      ? {
        id: audit.id,
        cree_le: audit.cree_le,
        capture: audit.capture ? `/api/capture/${audit.id}` : null,
        ...audit.audit,
      }
      : null,
    documents: stockage.documents(prospect.id) ?? null,
    // Le lien publié par le site s'il existe, sinon une recherche : l'interface distingue les deux.
    google_recherche: rechercheGoogleMaps(prospect.nom, prospect.ville, prospect.code_postal),
  };
}

// ── Actions ─────────────────────────────────────────────────────────────────

/** Recherche Sirene, audit rapide des sites, puis enregistrement. */
async function lanceProspection(corps: Record<string, unknown>, travail: Travail) {
  const filtres = litFiltres(corps);
  // L'API refuse une recherche sans critère discriminant : on le dit avant de l'appeler.
  if (!filtresValides(filtres)) {
    throw new Error(
      "Précisez au moins un critère de localisation ou d'activité : département, code postal, " +
        "secteur, ou recherche libre.",
    );
  }
  const debut = Date.now();

  // L'API n'applique pas tous les critères (la date de création notamment) : on lui demande
  // page après page jusqu'à réunir l'objectif de prospects réellement conformes.
  const objectif = Math.min(Math.max(nombre(corps.objectif) ?? 50, 1), 250);
  travail.etape = "recherche des entreprises";
  travail.total = objectif;
  const recherche = await rechercheEntreprises(filtres, {
    objectif,
    endpoint: process.env.SIRENE_URL || undefined,
    // L'API classe par pertinence : sur « créées il y a moins de 2 mois », les grosses
    // entreprises anciennes occupent tout le haut du classement. Tant que l'objectif n'est
    // pas atteint, on descend donc bien plus loin que les 10 pages nominales — le temps,
    // et non le nombre de pages, sert de garde-fou.
    pagesMax: PAGES_MAX_RECHERCHE,
    echeance: debut + DUREE_MAX_RECHERCHE_MS,
    retenir: (prospect) => respecteFiltres(prospect, filtres) === null,
    onPage: (page, total) => {
      travail.etape = `page ${page} — ${nombreFr(total)} entreprise(s) correspondent aux critères de l'API`;
    },
  });
  let prospects = recherche.prospects;
  travail.faits = prospects.length;

  if (filtres.auditSites && prospects.length) {
    travail.etape = `analyse des sites (${prospects.length} entreprises)`;
    travail.faits = 0;
    travail.total = prospects.length;
    const audits = await auditeProspects(prospects, {
      concurrence: 6,
      onProgres: (faits, total) => {
        travail.faits = faits;
        travail.etape = `analyse des sites ${faits} / ${total}`;
      },
    });
    prospects = prospects.map((prospect, i) => (audits[i] ? appliqueAudit(prospect, audits[i]!) : prospect));
  }

  // Les critères ont déjà été vérifiés page par page ; on repasse ici pour la comptabilité
  // et pour couvrir les prospects enrichis entre-temps.
  const { retenus: conformes, ecartes: ecartesFinaux } = appliqueFiltres(prospects, filtres);
  const ecartes = [
    ...appliqueFiltres(recherche.ecartes, filtres).ecartes,
    ...ecartesFinaux,
  ];
  const cibles = filtres.auditSites ? filtreSelonCible(conformes, filtres.cible) : conformes;
  const retenus = [...cibles].sort((a, b) => b.score - a.score);
  const { nouveaux } = stockage.enregistreProspects(retenus);

  // Raisons d'exclusion regroupées, pour expliquer un écart entre le total annoncé et la liste.
  const raisons: Record<string, number> = {};
  for (const ecart of ecartes) {
    const categorie = categorieEcart(ecart.raison);
    raisons[categorie] = (raisons[categorie] ?? 0) + 1;
  }

  // Rien ne passe le filtre d'âge : plutôt qu'un écran vide, on montre les entreprises les
  // plus jeunes réellement trouvées. Le prospecteur voit l'âge du gisement et sait de combien
  // élargir, au lieu de deviner.
  const plusJeunes = (filtres.creeApres && !retenus.length)
    ? recherche.ecartes
      .filter((p) => p.date_creation)
      .sort((a, b) => (b.date_creation! < a.date_creation! ? -1 : 1))
      .slice(0, NB_PLUS_JEUNES)
      .map((p) => ({
        nom: p.enseigne?.trim() || p.nom,
        ville: p.ville,
        date_creation: p.date_creation,
        age_mois: ageEnMois(p.date_creation),
      }))
    : [];

  return {
    total_disponible: recherche.totalDisponible,
    analyses: recherche.analysees,
    pages_parcourues: recherche.pagesParcourues,
    objectif,
    // Faux quand l'API a ignoré la fenêtre de dates : sans ça, un « 0 retenu » se lit comme
    // « la base est vide » alors que c'est le tri par pertinence qui est en cause.
    filtre_date_applique: recherche.filtreDateApplique,
    plus_jeunes: plusJeunes,
    hors_criteres: ecartes.length,
    raisons_ecart: Object.entries(raisons).map(([raison, nombre]) => ({ raison, nombre }))
      .sort((a, b) => b.nombre - a.nombre),
    hors_cible: conformes.length - cibles.length,
    retenus: retenus.length,
    nouveaux,
    tronque: recherche.tronque,
    duree_ms: Date.now() - debut,
  };
}

/**
 * Recherche de commerces dans OpenStreetMap : source complémentaire de Sirene, qui apporte
 * l'adresse exacte, le téléphone et — quand il existe — le site web.
 */
async function lanceProspectionOsm(corps: Record<string, unknown>, travail: Travail) {
  const filtres: FiltresOsm = {
    ville: texte(corps.ville, 80) ?? undefined,
    codePostal: texte(corps.codePostal, 5) ?? undefined,
    categories: Array.isArray(corps.categories) ? corps.categories.map(String) : undefined,
    sansSiteSeulement: corps.sansSiteSeulement === true,
    limite: Math.min(Math.max(nombre(corps.limite) ?? 200, 1), 500),
  };
  const debut = Date.now();

  travail.etape = `interrogation d'OpenStreetMap (${filtres.ville ?? filtres.codePostal ?? "zone"})`;
  const commerces = await chercheCommerces(filtres, {
    timeoutMs: 90_000,
    // Overpass a plusieurs miroirs : celui par défaut sature aux heures pleines.
    endpoint: process.env.OVERPASS_URL || undefined,
  });

  travail.total = commerces.length;
  travail.etape = `${commerces.length} commerce(s) trouvé(s)`;
  const { nouveaux } = stockage.enregistreCommerces(
    commerces.map((commerce) => ({ prospect: prospectDepuisCommerce(commerce), osmId: commerce.osmId })),
  );
  travail.faits = commerces.length;

  return {
    trouves: commerces.length,
    nouveaux,
    sans_site: commerces.filter((commerce) => !commerce.siteWeb).length,
    avec_telephone: commerces.filter((commerce) => commerce.telephone).length,
    duree_ms: Date.now() - debut,
  };
}

/**
 * Audite un site, l'enregistre et reporte les notes sur la fiche prospect.
 * Accepte `{url, nom}` (le site devient un prospect, dédoublonné sur le domaine) ou
 * `{prospect_id}` (site connu, ou détecté depuis la raison sociale).
 */
async function lanceAudit(corps: Record<string, unknown>) {
  const profondeur: Profondeur = corps.profondeur === "rapide" ? "rapide" : "complet";
  const prospectId = texte(corps.prospect_id, 60);
  const urlDemandee = texte(corps.url, 500);

  let prospect: ProspectStocke | undefined;
  if (prospectId) {
    prospect = stockage.prospect(prospectId);
    if (!prospect) throw new Error("Prospect introuvable");
  } else {
    if (!urlDemandee) throw new Error("Fournissez une adresse de site ou un prospect_id");
    const url = normaliseUrl(urlDemandee, AUTORISE_LOCAL);
    const hote = url ? domaineDe(url) : null;
    if (!url || !hote) throw new Error(`Adresse invalide : ${urlDemandee}`);
    prospect = stockage.prospectDepuisDomaine(hote, texte(corps.nom, 120) ?? nomDepuisDomaine(hote), url);
  }

  // Site inconnu : on tente de le deviner depuis la raison sociale avant de conclure.
  let url = urlDemandee ?? prospect.site_web;
  let siteRedecouvert = false;
  if (!url) {
    const detection = await detecteEtAuditeSite(prospect.nom, prospect.enseigne, { timeoutMs: 8000 });
    url = detection.url;
    siteRedecouvert = Boolean(url);
  }

  // Aucun site : ce n'est pas un échec, c'est l'opportunité la plus forte du catalogue.
  if (!url) {
    const { score, priorite } = scoreProspect({
      site_statut: "aucun_site", site_score: 100, budget_score: prospect.budget_score,
    });
    const maj = stockage.majProspect(prospect.id, {
      site_statut: "aucun_site", site_score: 100, site_verifie_le: new Date().toISOString(),
      score, priorite, audit_le: new Date().toISOString(), score_audit: 0, dernier_audit_id: null,
    })!;
    return {
      prospect: vueProspect(maj),
      audit: null,
      sans_site: true,
      message: "Aucun site web détecté : la proposition portera sur une création de site.",
    };
  }

  const audit: AuditSiteComplet = await auditeSite(url, {
    profondeur,
    clePageSpeed: process.env.PAGESPEED_API_KEY,
    autoriseHotesPrives: AUTORISE_LOCAL,
  });
  const ligne = stockage.enregistreAudit(prospect.id, audit);

  // Audit non concluant : on garde la trace de la tentative sans requalifier le prospect —
  // écrire une note issue d'un site qu'on n'a pas vu reviendrait à fabriquer un diagnostic.
  if (!audit.concluant) {
    const maj = stockage.majProspect(prospect.id, {
      audit_le: ligne.cree_le, dernier_audit_id: ligne.id,
    })!;
    return {
      prospect: vueProspect(maj),
      audit,
      audit_id: ligne.id,
      concluant: false,
      message: audit.erreurs[0] ?? "Le site n'a pas pu être analysé.",
    };
  }

  // L'opportunité commerciale est l'inverse de la qualité du site : un site noté 20/100
  // pèse 80 points d'opportunité dans le score du prospect.
  const opportunite = 100 - audit.scores.global;
  const statutSite = audit.scores.global < 55 ? "site_obsolete" : "site_a_rafraichir";
  const { score, priorite } = scoreProspect({
    site_statut: statutSite, site_score: opportunite, budget_score: prospect.budget_score,
  });
  const maj = stockage.majProspect(prospect.id, {
    site_web: audit.urlFinale ?? url,
    emails: audit.contacts.emails,
    telephones: audit.contacts.telephones,
    google_maps_url: audit.contacts.googleMaps ?? prospect.google_maps_url,
    reseaux: audit.contacts.reseaux,
    site_statut: statutSite,
    site_score: opportunite,
    site_signaux: audit.findings.slice(0, 8).map((f) => f.titre),
    site_verifie_le: ligne.cree_le,
    email_contact: audit.emailContact ?? prospect.email_contact,
    telephone: audit.telephone ?? prospect.telephone,
    score,
    priorite,
    score_audit: audit.scores.global,
    score_seo: audit.scores.seo,
    score_design: audit.scores.design,
    score_securite: audit.scores.securite,
    score_technique: audit.scores.technique,
    audit_le: ligne.cree_le,
    dernier_audit_id: ligne.id,
  })!;

  return {
    prospect: vueProspect(maj),
    audit,
    audit_id: ligne.id,
    concluant: true,
    site_redecouvert: siteRedecouvert,
  };
}

/** Un audit d'il y a plus d'un mois ne dit plus rien du site : il redevient candidat. */
const AGE_AUDIT_PERIME_MS = 30 * 24 * 60 * 60 * 1000;

function candidatsAudit(limite: number): string[] {
  const maintenant = Date.now();
  const jamais = stockage.prospects().filter((p) => !p.audit_le);
  const perimes = stockage.prospects()
    .filter((p) => p.audit_le && maintenant - Date.parse(p.audit_le) > AGE_AUDIT_PERIME_MS)
    .sort((a, b) => (a.audit_le ?? "").localeCompare(b.audit_le ?? ""));
  return [...jamais, ...perimes].slice(0, limite).map((p) => p.id);
}

/** Audite plusieurs prospects à la suite : un seul à la fois, pour rester poli avec les sites. */
async function auditeEnLot(ids: string[], travail: Travail) {
  const bilan = { audites: 0, non_concluants: 0, sans_site: 0, echecs: [] as string[] };

  for (const id of ids) {
    const prospect = stockage.prospect(id);
    travail.etape = `audit de ${prospect?.nom ?? id}`;
    try {
      const resultat = await lanceAudit({ prospect_id: id });
      if (resultat.sans_site) bilan.sans_site++;
      else if (resultat.concluant === false) bilan.non_concluants++;
      else bilan.audites++;
    } catch (erreur) {
      bilan.echecs.push(`${prospect?.nom ?? id} : ${erreur instanceof Error ? erreur.message : erreur}`);
    }
    travail.faits++;
  }
  return bilan;
}

/** Devis, rapport, email, SMS et script d'appel depuis le dernier audit du prospect. */
async function genereProposition(prospectId: string, corps: Record<string, unknown>) {
  const prospect = stockage.prospect(prospectId);
  if (!prospect) throw new Error("Prospect introuvable");

  const ligne = prospect.dernier_audit_id
    ? stockage.audit(prospect.dernier_audit_id)
    : stockage.dernierAudit(prospect.id);
  const audit = ligne ? stockage.auditAvecCapture(ligne.id)! : null;

  const proposition = await construitProposition(
    prospect,
    audit,
    stockage.prestations().filter((p) => p.actif !== false),
    {
      emetteur: stockage.emetteur(),
      ia: corps.avec_ia === false ? {} : { cle: process.env.LOVABLE_API_KEY },
    },
  );

  const documents = stockage.enregistreDocuments({
    prospect_id: prospect.id,
    audit_id: ligne?.id ?? null,
    synthese: proposition.synthese,
    email: proposition.email,
    email_html: proposition.email_html,
    email_intro: proposition.email_intro,
    email_intro_html: proposition.email_intro_html,
    sms: proposition.sms,
    script_appel: proposition.script_appel,
    rapport_html: proposition.rapport_html,
    devis: proposition.devis,
    genere_par_ia: proposition.genere_par_ia,
  });

  return {
    ...documents,
    arguments: proposition.contexte.arguments,
    sans_audit: !audit,
  };
}

/** Page imprimable : le fragment de rapport stocké, dans un document complet. */
function pageRapport(prospectId: string): string | null {
  const prospect = stockage.prospect(prospectId);
  const documents = stockage.documents(prospectId);
  if (!prospect || !documents) return null;
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Audit — ${echappeHtml(prospect.nom)}</title></head>
<body style="margin:0;background:#f5f5f5">
<div style="position:fixed;top:12px;right:12px;z-index:99" class="sans-impression">
  <button onclick="window.print()" style="font:600 14px system-ui;padding:9px 16px;border:0;border-radius:8px;background:#2f6df6;color:#fff;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.15)">
    Enregistrer en PDF</button>
</div>
<style>@media print { .sans-impression { display:none !important } }</style>
${documents.rapport_html}
</body></html>`;
}

function litPrestations(corps: Record<string, unknown>): { prestations?: Prestation[]; emetteur?: Partial<Emetteur> } {
  const resultat: { prestations?: Prestation[]; emetteur?: Partial<Emetteur> } = {};

  if (Array.isArray(corps.prestations)) {
    resultat.prestations = corps.prestations.map((brut) => {
      const ligne = brut as Record<string, unknown>;
      const code = texte(ligne.code, 60);
      const libelle = texte(ligne.libelle, 200);
      const prix = nombre(ligne.prix);
      if (!code || !libelle || prix === undefined || prix < 0) {
        throw new Error("Prestation invalide : code, libellé et prix positif sont requis");
      }
      return {
        code,
        libelle,
        description: texte(ligne.description, 500),
        prix,
        unite: ligne.unite === "mois" ? "mois" : "forfait",
        categorie: texte(ligne.categorie, 40) ?? "autre",
        actif: ligne.actif !== false,
        ordre: nombre(ligne.ordre) ?? 0,
      } satisfies Prestation;
    });
  }

  if (corps.emetteur && typeof corps.emetteur === "object") {
    const brut = corps.emetteur as Record<string, unknown>;
    resultat.emetteur = {
      raison_sociale: texte(brut.raison_sociale, 120) ?? undefined,
      siret: texte(brut.siret, 20) ?? "",
      adresse: texte(brut.adresse, 200) ?? "",
      email: texte(brut.email, 120) ?? undefined,
      telephone: texte(brut.telephone, 30) ?? "",
      site_web: texte(brut.site_web, 200) ?? undefined,
      taux_tva: nombre(brut.taux_tva),
      validite_jours: nombre(brut.validite_jours),
      mentions: texte(brut.mentions, 500) ?? undefined,
    };
    // Une clé absente ne doit pas écraser la valeur en place.
    for (const [cle, valeur] of Object.entries(resultat.emetteur)) {
      if (valeur === undefined) delete resultat.emetteur[cle as keyof Emetteur];
    }
  }

  return resultat;
}

// ── Routage ─────────────────────────────────────────────────────────────────

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const chemin = url.pathname;
  const methode = req.method ?? "GET";

  // Les pages servies hors interface (rapport, email) déclenchent une requête de favicon :
  // on répond une fois pour toutes plutôt que de laisser un 404 dans la console.
  if (chemin === "/favicon.ico" || chemin === "/favicon.svg") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y="26" font-size="26">🎯</text></svg>`;
    res.writeHead(200, {
      "Content-Type": "image/svg+xml",
      "Content-Length": Buffer.byteLength(svg),
      "Cache-Control": "max-age=86400",
    });
    res.end(svg);
    return;
  }

  if (!chemin.startsWith("/api/")) {
    if (methode !== "GET") {
      envoieJson(res, { error: "Méthode non autorisée" }, 405);
      return;
    }
    servFichierStatique(res, chemin === "/" ? "/index.html" : chemin);
    return;
  }

  // Référentiels et état du poste : ce que l'interface a besoin de savoir au démarrage.
  if (methode === "GET" && chemin === "/api/config") {
    envoieJson(res, {
      secteurs: SECTEURS_CIBLES.map(({ id, label }) => ({ id, label })),
      // Les clés numériques ("11", "12"…) sont énumérées avant les autres par JavaScript :
      // on trie par effectif moyen pour que la liste se lise dans l'ordre, « non renseigné » à la fin.
      tranches: Object.entries(TRANCHES_EFFECTIF)
        .sort(([codeA, a], [codeB, b]) =>
          codeA === "NN" ? 1 : codeB === "NN" ? -1 : a.moyenne - b.moyenne)
        .map(([code, t]) => ({ code, label: t.label })),
      statuts: STATUTS,
      statuts_site: STATUTS_SITE,
      categories_osm: CATEGORIES_OSM.map(({ id, label }) => ({ id, label })),
      piliers: LIBELLES_PILIERS,
      severites: LIBELLES_SEVERITE,
      efforts: LIBELLES_EFFORT,
      emplacement: stockage.emplacement,
      // L'en-tête de l'interface porte le nom de l'émetteur : renommer sa société dans
      // « Prestations » suffit à rebaptiser l'outil, sans toucher au code.
      marque: { nom: stockage.emetteur().raison_sociale, site_web: stockage.emetteur().site_web },
      // Les deux clés sont optionnelles : l'interface indique ce qui tourne sans elles.
      pagespeed: Boolean(process.env.PAGESPEED_API_KEY),
      ia: Boolean(process.env.LOVABLE_API_KEY),
      autorise_local: AUTORISE_LOCAL,
    });
    return;
  }

  if (methode === "GET" && chemin === "/api/prospects") {
    envoieJson(res, { prospects: stockage.prospects().map(vueListe) });
    return;
  }

  // Repartir de zéro : supprime tous les prospects, audits et documents, jamais le catalogue
  // de prestations ni l'identité de l'émetteur (ce sont des réglages, pas des résultats).
  if (methode === "DELETE" && chemin === "/api/prospects") {
    envoieJson(res, { supprimes: stockage.videProspects() });
    return;
  }

  if (chemin === "/api/export.csv" && methode === "GET") {
    // On exporte ce qui est affiché : les filtres de la liste sont passés en paramètres.
    const filtreStatut = texte(url.searchParams.get("statut"), 20);
    const filtrePriorite = texte(url.searchParams.get("priorite"), 10);
    const recherche = (texte(url.searchParams.get("q"), 80) ?? "").toLowerCase();
    const selection = stockage.prospects().filter((prospect) => {
      if (filtreStatut && prospect.statut !== filtreStatut) return false;
      if (filtrePriorite && prospect.priorite !== filtrePriorite) return false;
      if (!recherche) return true;
      return [prospect.nom, prospect.enseigne, prospect.ville, prospect.code_postal,
        prospect.email_contact, prospect.site_web, prospect.dirigeant]
        .filter(Boolean).join(" ").toLowerCase().includes(recherche);
    });
    const csv = "﻿" + versCsv(selection);
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="prospects.csv"`,
      "Content-Length": Buffer.byteLength(csv),
    });
    res.end(csv);
    return;
  }

  const capture = chemin.match(/^\/api\/capture\/([\w-]+)$/);
  if (capture && methode === "GET") {
    const fichier = stockage.cheminCapture(capture[1]);
    if (!fichier) {
      envoieJson(res, { error: "Capture introuvable" }, 404);
      return;
    }
    res.writeHead(200, {
      "Content-Type": TYPES_MIME[extname(fichier)] ?? "image/jpeg",
      "Content-Length": statSync(fichier).size,
    });
    createReadStream(fichier).pipe(res);
    return;
  }

  // Email : version « approche » (?intro) ou version avec devis, servie autonome pour aperçu.
  const emailHtmlRoute = chemin.match(/^\/api\/email\/([\w-]+)$/);
  if (emailHtmlRoute && methode === "GET") {
    const documents = stockage.documents(emailHtmlRoute[1]);
    if (!documents) {
      envoieHtml(res, "<p>Aucune proposition générée pour ce prospect.</p>", 404);
      return;
    }
    const intro = url.searchParams.get("intro") !== null;
    const objet = intro ? documents.email_intro?.objet ?? documents.email.objet : documents.email.objet;
    const corpsHtml = intro ? documents.email_intro_html ?? documents.email_html : documents.email_html;
    envoieHtml(res, `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echappeHtml(objet)}</title></head>
<body style="margin:0;background:#eef1f6">
${corpsHtml}
</body></html>`);
    return;
  }

  const rapport = chemin.match(/^\/api\/rapport\/([\w-]+)$/);
  if (rapport && methode === "GET") {
    const page = pageRapport(rapport[1]);
    if (!page) {
      envoieHtml(res, "<p>Aucune proposition générée pour ce prospect.</p>", 404);
      return;
    }
    envoieHtml(res, page);
    return;
  }

  const fiche = chemin.match(/^\/api\/prospects\/([\w-]+)$/);
  if (fiche) {
    const id = fiche[1];
    if (methode === "GET") {
      const prospect = stockage.prospect(id);
      if (!prospect) {
        envoieJson(res, { error: "Prospect introuvable" }, 404);
        return;
      }
      envoieJson(res, { prospect: vueProspect(prospect) });
      return;
    }
    if (methode === "PATCH") {
      const corps = await litCorps(req);
      const prospectExistant = stockage.prospect(id);
      const patch: Partial<ProspectStocke> = {};
      const statut = texte(corps.statut, 20);
      if (statut) {
        if (!STATUTS.includes(statut as StatutCommercial)) throw new Error(`Statut inconnu : ${statut}`);
        patch.statut = statut as StatutCommercial;
      }
      if ("notes" in corps) patch.notes = texte(corps.notes, 5000);

      // Correction manuelle du site : la détection se trompe quand le domaine n'a rien à voir
      // avec la raison sociale. On revalide l'adresse comme pour un audit.
      if ("site_web" in corps) {
        const saisie = texte(corps.site_web, 500);
        if (!saisie) {
          patch.site_web = null;
        } else {
          const normalisee = normaliseUrl(saisie, AUTORISE_LOCAL);
          if (!normalisee) throw new Error(`Adresse invalide : ${saisie}`);
          patch.site_web = normalisee;
          patch.domaine = domaineDe(normalisee) ?? prospectExistant?.domaine ?? null;
        }
      }
      if ("site_statut" in corps) {
        const statutSite = texte(corps.site_statut, 30);
        if (!statutSite || !STATUTS_SITE.includes(statutSite as StatutSite)) {
          throw new Error(`État de site inconnu : ${statutSite}`);
        }
        patch.site_statut = statutSite as StatutSite;
        // L'opportunité suit l'état déclaré : « aucun site » vaut 100, un site récent vaut peu.
        patch.site_score = OPPORTUNITE_PAR_STATUT[statutSite as StatutSite];
        patch.site_verifie_le = new Date().toISOString();
        const { score, priorite } = scoreProspect({
          site_statut: patch.site_statut,
          site_score: patch.site_score,
          budget_score: prospectExistant?.budget_score ?? 50,
        });
        patch.score = score;
        patch.priorite = priorite;
      }

      const maj = stockage.majProspect(id, patch);
      if (!maj) {
        envoieJson(res, { error: "Prospect introuvable" }, 404);
        return;
      }
      envoieJson(res, { prospect: vueProspect(maj) });
      return;
    }
    if (methode === "DELETE") {
      envoieJson(res, { supprime: stockage.supprimeProspect(id) });
      return;
    }
  }

  if (methode === "POST" && chemin === "/api/prospection") {
    const corps = await litCorps(req);
    // Les critères sont validés tout de suite : une erreur de saisie ne part pas en tâche de fond.
    const filtres = litFiltres(corps);
    if (!filtresValides(filtres)) {
      envoieJson(res, {
        error: "Précisez au moins un critère de localisation ou d'activité : département, " +
          "code postal, secteur, ou recherche libre.",
      }, 400);
      return;
    }
    const travail = creeTravail("prospection", "démarrage");
    lance(travail, (t) => lanceProspection(corps, t));
    envoieJson(res, { travail: travail.id }, 202);
    return;
  }

  if (methode === "POST" && chemin === "/api/prospection-osm") {
    const corps = await litCorps(req);
    if (!texte(corps.ville, 80) && !texte(corps.codePostal, 5)) {
      envoieJson(res, { error: "Précisez une commune ou un code postal." }, 400);
      return;
    }
    const travail = creeTravail("prospection", "démarrage");
    lance(travail, (t) => lanceProspectionOsm(corps, t));
    envoieJson(res, { travail: travail.id }, 202);
    return;
  }

  // Audit en lot : soit une liste explicite (ce que l'interface envoie), soit les prospects
  // jamais audités puis ceux dont l'audit a plus d'un mois.
  if (methode === "POST" && chemin === "/api/audits") {
    const corps = await litCorps(req);
    const limite = Math.min(Math.max(nombre(corps.limite) ?? 10, 1), 50);
    const ids = Array.isArray(corps.ids)
      ? corps.ids.map(String).filter((id) => stockage.prospect(id)).slice(0, 50)
      : candidatsAudit(limite);

    if (!ids.length) {
      envoieJson(res, {
        error: "Aucun prospect à auditer : tous ont été analysés il y a moins d'un mois. " +
          "Utilisez le bouton « Auditer » d'une ligne pour en relancer un.",
      }, 400);
      return;
    }
    const travail = creeTravail("audits", `audit de ${ids.length} site(s)`);
    travail.total = ids.length;
    lance(travail, (t) => auditeEnLot(ids, t));
    envoieJson(res, { travail: travail.id }, 202);
    return;
  }

  const suivi = chemin.match(/^\/api\/travaux\/([\w-]+)$/);
  if (suivi && methode === "GET") {
    const travail = travaux.get(suivi[1]);
    if (!travail) {
      envoieJson(res, { error: "Traitement inconnu (le serveur a peut-être redémarré)" }, 404);
      return;
    }
    envoieJson(res, {
      ...travail,
      duree_ms: Date.now() - travail.debut,
    });
    return;
  }

  if (methode === "POST" && chemin === "/api/audit") {
    envoieJson(res, await lanceAudit(await litCorps(req)));
    return;
  }

  const proposition = chemin.match(/^\/api\/proposition\/([\w-]+)$/);
  if (proposition && methode === "POST") {
    envoieJson(res, await genereProposition(proposition[1], await litCorps(req)));
    return;
  }

  if (chemin === "/api/prestations") {
    if (methode === "GET") {
      envoieJson(res, { prestations: stockage.prestations(), emetteur: stockage.emetteur() });
      return;
    }
    if (methode === "PUT") {
      const { prestations, emetteur } = litPrestations(await litCorps(req));
      if (prestations) stockage.majPrestations(prestations);
      if (emetteur) stockage.majEmetteur(emetteur);
      envoieJson(res, { prestations: stockage.prestations(), emetteur: stockage.emetteur() });
      return;
    }
  }

  envoieJson(res, { error: `Route inconnue : ${methode} ${chemin}` }, 404);
}

const serveur = createServer((req, res) => {
  route(req, res).catch((erreur) => {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    console.error(`[erreur] ${req.method} ${req.url} — ${message}`);
    if (!res.headersSent) envoieJson(res, { error: message }, 400);
    else res.end();
  });
});

// Un audit complet attend Lighthouse : le délai d'inactivité par défaut de Node (2 min) est
// juste, mais une prospection sur dix pages peut le dépasser.
serveur.requestTimeout = 0;
serveur.headersTimeout = 0;

// Message clair quand le port est déjà pris (une fenêtre lancée précédemment) : le message
// brut de Node effraie pour rien, alors que la solution est immédiate.
serveur.on("error", (erreur: NodeJS.ErrnoException) => {
  if (erreur.code === "EADDRINUSE") {
    console.error(
      `\n  Le port ${PORT} est déjà utilisé — une autre fenêtre « npm start » tourne sans doute.\n` +
        `  Fermez-la, ou démarrez sur un autre port :\n` +
        `    PowerShell : $env:PORT=4100; npm start\n` +
        `    macOS/Linux : PORT=4100 npm start\n`,
    );
    process.exit(1);
  }
  throw erreur;
});

serveur.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  Prospection — http://127.0.0.1:${PORT}`);
  console.log(`  Données     — ${stockage.emplacement}`);
  if (!process.env.PAGESPEED_API_KEY) {
    console.log("  PageSpeed   — sans clé (quota public, suffisant pour quelques audits)");
  }
  if (!process.env.LOVABLE_API_KEY) {
    console.log("  IA          — désactivée (les textes restent ceux des modèles)");
  }
  console.log("\n  Ctrl+C pour arrêter.\n");
});
