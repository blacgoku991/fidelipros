#!/usr/bin/env node
// Prospection en ligne de commande — même moteur que l'edge function, sans base de données.
// Produit un CSV exploitable dans Excel / Google Sheets.
//
//   node scripts/prospect.ts --departement 33 --secteurs restauration,beaute --depuis 12
//   node scripts/prospect.ts --cp 75011 --cible site_a_refaire --pages 4 --sortie leads.csv
//   node scripts/prospect.ts --aide
//
// Nécessite Node 22+ (exécution directe des fichiers TypeScript).

import { writeFileSync } from "node:fs";
import process from "node:process";

import { appliqueAudit, filtreSelonCible, versCsv } from "../supabase/functions/_shared/prospection/core.ts";
import { nafDesSecteurs, SECTEURS_CIBLES } from "../supabase/functions/_shared/prospection/naf.ts";
import { rechercheEntreprises } from "../supabase/functions/_shared/prospection/sirene.ts";
import { auditeProspects } from "../supabase/functions/_shared/prospection/website.ts";
import type { CibleProspection, ProspectionFilters } from "../supabase/functions/_shared/prospection/types.ts";

const AIDE = `
Prospection FideliPro — entreprises à démarcher pour un site web

Options :
  --departement <code>   Département (ex. 33)
  --cp <code>            Code postal (ex. 33000)
  --q <texte>            Recherche libre (nom, activité…)
  --secteurs <liste>     Secteurs séparés par des virgules
  --depuis <mois>        Ne garder que les entreprises créées depuis N mois (défaut : 12)
  --ca-min <euros>       Chiffre d'affaires minimum
  --cible <valeur>       sans_site | site_a_refaire | tous (défaut : tous)
  --pages <n>            Pages de 25 entreprises à parcourir (défaut : 2, max 10)
  --sans-audit           Ne pas analyser les sites web (beaucoup plus rapide)
  --sortie <fichier>     Fichier CSV de sortie (défaut : prospects.csv)
  --aide                 Afficher cette aide

Secteurs disponibles :
${SECTEURS_CIBLES.map((s) => `  ${s.id.padEnd(18)} ${s.label}`).join("\n")}
`;

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

function dateIlYaNMois(mois: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - mois);
  return date.toISOString().slice(0, 10);
}

async function principal() {
  const options = litArguments(process.argv.slice(2));

  if (options.aide || options.help) {
    console.log(AIDE);
    return;
  }

  const secteurs = typeof options.secteurs === "string" ? options.secteurs.split(",").map((s) => s.trim()) : [];
  const inconnus = secteurs.filter((id) => !SECTEURS_CIBLES.some((s) => s.id === id));
  if (inconnus.length) {
    console.error(`Secteur(s) inconnu(s) : ${inconnus.join(", ")}\n${AIDE}`);
    process.exitCode = 1;
    return;
  }

  const depuis = Number(options.depuis ?? 12);
  const cible = (typeof options.cible === "string" ? options.cible : "tous") as CibleProspection;
  const auditSites = options["sans-audit"] !== true;

  const filtres: ProspectionFilters = {
    q: typeof options.q === "string" ? options.q : undefined,
    departement: typeof options.departement === "string" ? options.departement : undefined,
    codePostal: typeof options.cp === "string" ? options.cp : undefined,
    activitePrincipale: secteurs.length ? nafDesSecteurs(secteurs) : undefined,
    creeApres: Number.isFinite(depuis) && depuis > 0 ? dateIlYaNMois(depuis) : undefined,
    caMin: options["ca-min"] ? Number(options["ca-min"]) : undefined,
    cible,
    pages: Number(options.pages ?? 2),
    auditSites,
  };

  console.log("Recherche des entreprises…");
  const recherche = await rechercheEntreprises(filtres, {
    onPage: (page, total) => console.log(`  page ${page} — ${total} entreprise(s) correspondent aux critères`),
  });

  let prospects = recherche.prospects;
  if (auditSites && prospects.length) {
    console.log(`Audit des sites web de ${prospects.length} entreprise(s)…`);
    const audits = await auditeProspects(prospects, { concurrence: 6 });
    prospects = prospects.map((prospect, i) => (audits[i] ? appliqueAudit(prospect, audits[i]!) : prospect));
  }

  const retenus = (auditSites ? filtreSelonCible(prospects, cible) : prospects).sort((a, b) => b.score - a.score);

  const sortie = typeof options.sortie === "string" ? options.sortie : "prospects.csv";
  writeFileSync(sortie, "﻿" + versCsv(retenus), "utf8");

  console.log(`\n${retenus.length} prospect(s) retenu(s) sur ${recherche.prospects.length} analysé(s) → ${sortie}\n`);
  for (const prospect of retenus.slice(0, 15)) {
    const site = prospect.site_web ?? prospect.site_statut;
    console.log(
      `  ${String(prospect.score).padStart(3)} · ${prospect.nom.slice(0, 42).padEnd(42)} ` +
        `${(prospect.ville ?? "").slice(0, 18).padEnd(18)} ${site}`,
    );
  }
}

principal().catch((erreur) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exitCode = 1;
});
