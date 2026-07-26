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
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import process from "node:process";

import { appliqueAudit, dateIlYaNMois, filtreSelonCible, scoreProspect, versCsv } from "../moteur/core.ts";
import { nafDesSecteurs, SECTEURS_CIBLES, TRANCHES_EFFECTIF } from "../moteur/naf.ts";
import { rechercheEntreprises } from "../moteur/sirene.ts";
import { auditeProspects, detecteEtAuditeSite } from "../moteur/website.ts";
import type { CibleProspection, ProspectionFilters } from "../moteur/types.ts";
import { auditeSite, normaliseUrl } from "../moteur/audit/index.ts";
import { domaine as domaineDe, nomDepuisDomaine } from "../moteur/audit/http.ts";
import { echappeHtml } from "../moteur/audit/html.ts";
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

const STATUTS: StatutCommercial[] = [
  "nouveau", "a_contacter", "contacte", "rdv", "gagne", "perdu", "ignore",
];

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

  return {
    q: texte(brut.q) ?? undefined,
    departement: texte(brut.departement, 3) ?? undefined,
    codePostal: texte(brut.codePostal, 5) ?? undefined,
    activitePrincipale: secteurs.length ? nafDesSecteurs(secteurs) : undefined,
    trancheEffectif: Array.isArray(brut.trancheEffectif)
      ? brut.trancheEffectif.map(String).filter((code) => code in TRANCHES_EFFECTIF)
      : undefined,
    creeApres: depuis && depuis > 0 ? dateIlYaNMois(depuis) : undefined,
    caMin: nombre(brut.caMin),
    cible,
    pages: Math.min(Math.max(nombre(brut.pages) ?? 2, 1), 10),
    auditSites: brut.auditSites !== false,
  };
}

// ── Vue d'un prospect renvoyée à l'interface ────────────────────────────────

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
  };
}

// ── Actions ─────────────────────────────────────────────────────────────────

/** Recherche Sirene, audit rapide des sites, puis enregistrement. */
async function lanceProspection(corps: Record<string, unknown>) {
  const filtres = litFiltres(corps);
  const debut = Date.now();

  const recherche = await rechercheEntreprises(filtres);
  let prospects = recherche.prospects;

  if (filtres.auditSites && prospects.length) {
    const audits = await auditeProspects(prospects, { concurrence: 6 });
    prospects = prospects.map((prospect, i) => (audits[i] ? appliqueAudit(prospect, audits[i]!) : prospect));
  }

  const retenus = (filtres.auditSites ? filtreSelonCible(prospects, filtres.cible) : prospects)
    .sort((a, b) => b.score - a.score);
  const { nouveaux } = stockage.enregistreProspects(retenus);

  return {
    total_disponible: recherche.totalDisponible,
    analyses: recherche.prospects.length,
    retenus: retenus.length,
    nouveaux,
    tronque: recherche.tronque,
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
      tranches: Object.entries(TRANCHES_EFFECTIF).map(([code, t]) => ({ code, label: t.label })),
      statuts: STATUTS,
      piliers: LIBELLES_PILIERS,
      severites: LIBELLES_SEVERITE,
      efforts: LIBELLES_EFFORT,
      emplacement: stockage.emplacement,
      // Les deux clés sont optionnelles : l'interface indique ce qui tourne sans elles.
      pagespeed: Boolean(process.env.PAGESPEED_API_KEY),
      ia: Boolean(process.env.LOVABLE_API_KEY),
      autorise_local: AUTORISE_LOCAL,
    });
    return;
  }

  if (methode === "GET" && chemin === "/api/prospects") {
    envoieJson(res, { prospects: stockage.prospects().map(vueProspect) });
    return;
  }

  if (chemin === "/api/export.csv" && methode === "GET") {
    const csv = "﻿" + versCsv(stockage.prospects());
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
      const patch: Partial<ProspectStocke> = {};
      const statut = texte(corps.statut, 20);
      if (statut) {
        if (!STATUTS.includes(statut as StatutCommercial)) throw new Error(`Statut inconnu : ${statut}`);
        patch.statut = statut as StatutCommercial;
      }
      if ("notes" in corps) patch.notes = texte(corps.notes, 5000);
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
    envoieJson(res, await lanceProspection(await litCorps(req)));
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
