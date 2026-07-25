#!/usr/bin/env node
// Audit complet en ligne de commande : SEO, design, sécurité, technique, puis génération
// du rapport client et du devis. Même moteur que les edge functions, sans base de données.
//
//   node scripts/audit.ts --url https://garagemartin.fr
//   node scripts/audit.ts --csv prospects.csv --top 10 --sortie rapports
//   node scripts/audit.ts --aide
//
// Nécessite Node 22+ (exécution directe des fichiers TypeScript).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { auditeSite } from "../supabase/functions/_shared/prospection/audit/index.ts";
import { LIBELLES_PILIERS, LIBELLES_SEVERITE } from "../supabase/functions/_shared/prospection/audit/regles.ts";
import {
  construitProposition, propositionEnFichierHtml,
} from "../supabase/functions/_shared/prospection/proposition/index.ts";
import { euros } from "../supabase/functions/_shared/prospection/proposition/devis.ts";
import type { Prestation } from "../supabase/functions/_shared/prospection/proposition/types.ts";
import type { Pilier } from "../supabase/functions/_shared/prospection/audit/types.ts";

const AIDE = `
Audit de site et proposition commerciale — FideliPro

Options :
  --url <adresse>       Site à auditer
  --nom <texte>         Nom de l'entreprise (sinon déduit du domaine)
  --csv <fichier>       Fichier CSV produit par « npm run prospect »
  --top <n>             Nombre de lignes du CSV à auditer (défaut : 5)
  --rapide              Sans Lighthouse ni sondage des fichiers publics
  --sans-sonde          Ne pas vérifier les fichiers publics exposés
  --sortie <dossier>    Dossier des rapports (défaut : rapports)
  --tarifs <fichier>    Catalogue de prestations au format JSON
  --aide                Afficher cette aide

Variables d'environnement :
  PAGESPEED_API_KEY     Clé PageSpeed Insights (optionnelle, augmente le quota)
  LOVABLE_API_KEY       Active la reformulation IA de l'email et de la synthèse
`;

/** Catalogue par défaut, identique au seed de la migration. */
const CATALOGUE: Prestation[] = [
  { code: "site_vitrine", libelle: "Création d'un site vitrine (5 pages)", prix: 1200, unite: "forfait", categorie: "creation", ordre: 10 },
  { code: "refonte_site", libelle: "Refonte complète du site existant", prix: 2500, unite: "forfait", categorie: "refonte", ordre: 20 },
  { code: "responsive_mobile", libelle: "Adaptation mobile et tablette", prix: 690, unite: "forfait", categorie: "design", ordre: 30 },
  { code: "accessibilite", libelle: "Mise en accessibilité", prix: 390, unite: "forfait", categorie: "design", ordre: 40 },
  { code: "optimisation_perf", libelle: "Optimisation de la vitesse", prix: 490, unite: "forfait", categorie: "design", ordre: 50 },
  { code: "seo_technique", libelle: "SEO technique", prix: 590, unite: "forfait", categorie: "seo", ordre: 60 },
  { code: "redaction_contenu", libelle: "Rédaction de contenu (5 pages)", prix: 550, unite: "forfait", categorie: "seo", ordre: 70 },
  { code: "seo_local", libelle: "Référencement local", prix: 450, unite: "mois", categorie: "seo", ordre: 80 },
  { code: "mise_https", libelle: "Passage en HTTPS", prix: 190, unite: "forfait", categorie: "securite", ordre: 90 },
  { code: "securisation_entetes", libelle: "Sécurisation du site", prix: 390, unite: "forfait", categorie: "securite", ordre: 100 },
  { code: "correctif_dns_email", libelle: "Protection de vos emails", prix: 290, unite: "forfait", categorie: "securite", ordre: 110 },
  { code: "mise_a_jour_cms", libelle: "Mise à jour et nettoyage du CMS", prix: 450, unite: "forfait", categorie: "securite", ordre: 120 },
  { code: "maintenance", libelle: "Maintenance et surveillance", prix: 79, unite: "mois", categorie: "maintenance", ordre: 130 },
  { code: "hebergement", libelle: "Hébergement et nom de domaine", prix: 15, unite: "mois", categorie: "maintenance", ordre: 140 },
];

const PILIERS: Pilier[] = ["seo", "design", "securite", "technique"];

function litArguments(argv: string[]): Record<string, string | boolean> {
  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const cle = arg.slice(2);
    const suivant = argv[i + 1];
    if (!suivant || suivant.startsWith("--")) {
      options[cle] = true;
    } else {
      options[cle] = suivant;
      i++;
    }
  }
  return options;
}

interface Cible {
  nom: string;
  url: string | null;
  ville: string | null;
  siren: string;
}

/** Lit les colonnes utiles du CSV produit par scripts/prospect.ts (séparateur `;`). */
function litCsv(chemin: string, limite: number): Cible[] {
  const contenu = readFileSync(chemin, "utf8").replace(/^\uFEFF/, "");
  const lignes = contenu.split(/\r?\n/).filter(Boolean);
  if (lignes.length < 2) return [];

  const entetes = decoupe(lignes[0]);
  const index = (nom: string) => entetes.findIndex((e) => e.toLowerCase() === nom.toLowerCase());
  const iNom = index("Nom");
  const iSite = index("Site web");
  const iVille = index("Ville");
  const iSiren = index("SIREN");

  return lignes.slice(1, limite + 1).map((ligne) => {
    const cellules = decoupe(ligne);
    return {
      nom: cellules[iNom] ?? "",
      url: cellules[iSite] || null,
      ville: cellules[iVille] || null,
      siren: cellules[iSiren] ?? "",
    };
  }).filter((cible) => cible.nom);
}

function decoupe(ligne: string): string[] {
  const cellules: string[] = [];
  let courant = "";
  let entreGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const caractere = ligne[i];
    if (caractere === '"') {
      if (entreGuillemets && ligne[i + 1] === '"') {
        courant += '"';
        i++;
      } else {
        entreGuillemets = !entreGuillemets;
      }
    } else if (caractere === ";" && !entreGuillemets) {
      cellules.push(courant);
      courant = "";
    } else {
      courant += caractere;
    }
  }
  cellules.push(courant);
  return cellules;
}

function nomDepuisUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").split(".")[0].replace(/-/g, " ");
  } catch {
    return url;
  }
}

function nomFichier(cible: Cible): string {
  const base = (cible.siren || cible.nom)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return base || "prospect";
}

async function traite(
  cible: Cible,
  options: { rapide: boolean; sonde: boolean; dossier: string; catalogue: Prestation[] },
): Promise<void> {
  console.log(`\n▸ ${cible.nom}${cible.ville ? ` (${cible.ville})` : ""}`);
  if (!cible.url) {
    console.log("  Aucun site connu : proposition de création de site.");
  }

  const audit = cible.url
    ? await auditeSite(cible.url, {
      profondeur: options.rapide ? "rapide" : "complet",
      avecSonde: options.sonde && !options.rapide,
      clePageSpeed: process.env.PAGESPEED_API_KEY,
    })
    : null;

  if (audit) {
    console.log(
      `  Note globale ${audit.scores.global}/100 — ` +
        PILIERS.map((pilier) => `${LIBELLES_PILIERS[pilier]} ${audit.scores[pilier]}`).join(" · "),
    );
    for (const finding of audit.findings.slice(0, 6)) {
      console.log(`    [${LIBELLES_SEVERITE[finding.severite]}] ${finding.titre} — ${finding.constat}`);
    }
    if (audit.findings.length > 6) console.log(`    … et ${audit.findings.length - 6} autre(s) point(s)`);
    if (audit.erreurs.length) console.log(`    Non vérifié : ${audit.erreurs.join(" · ")}`);
  }

  const proposition = await construitProposition(
    {
      nom: cible.nom,
      enseigne: null,
      ville: cible.ville,
      code_postal: null,
      activite_code: null,
      dirigeant: null,
      site_web: cible.url,
      site_statut: audit ? "site_obsolete" : "aucun_site",
    },
    audit,
    options.catalogue,
    { ia: { cle: process.env.LOVABLE_API_KEY } },
  );

  const base = nomFichier(cible);
  writeFileSync(join(options.dossier, `${base}-rapport.html`), propositionEnFichierHtml(proposition), "utf8");
  writeFileSync(join(options.dossier, `${base}-email.txt`),
    `Objet : ${proposition.email.objet}\n\n${proposition.email.corps}\n`, "utf8");
  writeFileSync(join(options.dossier, `${base}-appel.txt`), `${proposition.script_appel}\n`, "utf8");
  writeFileSync(join(options.dossier, `${base}-devis.json`), JSON.stringify(proposition.devis, null, 2), "utf8");

  console.log(
    `  Devis : ${euros(proposition.devis.total_ht)} HT` +
      (proposition.devis.mensuel_ht ? ` puis ${euros(proposition.devis.mensuel_ht)} HT/mois` : "") +
      ` — ${proposition.devis.lignes_projet.length} prestation(s)` +
      (proposition.genere_par_ia ? " — textes personnalisés par l'IA" : ""),
  );
  console.log(`  Fichiers : ${join(options.dossier, base)}-{rapport.html,email.txt,appel.txt,devis.json}`);
}

async function principal() {
  const options = litArguments(process.argv.slice(2));
  if (options.aide || options.help) {
    console.log(AIDE);
    return;
  }

  const dossier = typeof options.sortie === "string" ? options.sortie : "rapports";
  mkdirSync(dossier, { recursive: true });

  const catalogue = typeof options.tarifs === "string"
    ? (JSON.parse(readFileSync(options.tarifs, "utf8")) as Prestation[])
    : CATALOGUE;

  const cibles: Cible[] = [];
  if (typeof options.url === "string") {
    cibles.push({
      nom: typeof options.nom === "string" ? options.nom : nomDepuisUrl(options.url),
      url: options.url,
      ville: null,
      siren: "",
    });
  }
  if (typeof options.csv === "string") {
    cibles.push(...litCsv(options.csv, Number(options.top ?? 5)));
  }
  if (!cibles.length) {
    console.error(`Rien à auditer : précisez --url ou --csv.\n${AIDE}`);
    process.exitCode = 1;
    return;
  }

  const config = {
    rapide: options.rapide === true,
    sonde: options["sans-sonde"] !== true,
    dossier,
    catalogue,
  };

  for (const cible of cibles) {
    try {
      await traite(cible, config);
    } catch (erreur) {
      console.error(`  Échec : ${erreur instanceof Error ? erreur.message : erreur}`);
    }
  }
  console.log(`\n${cibles.length} audit(s) traité(s) → dossier ${dossier}/`);
}

principal().catch((erreur) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exitCode = 1;
});
