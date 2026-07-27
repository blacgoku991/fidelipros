#!/usr/bin/env node
// Remet la base de prospection à zéro : prospects, audits, documents et captures.
//
//   npm run reset            → affiche ce qui sera supprimé et demande confirmation
//   npm run reset -- --oui   → supprime sans demander
//
// Le catalogue de prestations et l'identité de l'émetteur sont conservés : ce sont des
// réglages, pas des résultats de recherche. La même opération existe dans l'interface,
// bouton « Tout supprimer » de l'écran Prospects.

import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";
import process from "node:process";

import { Stockage } from "../serveur/stockage.ts";

const argv = process.argv.slice(2);
if (argv.includes("--aide") || argv.includes("-h")) {
  console.log(`Remet la base de prospection à zéro.

  npm run reset            demande confirmation avant de supprimer
  npm run reset -- --oui   supprime sans demander

Sont supprimés : prospects, audits, documents générés et captures d'écran.
Sont conservés : catalogue de prestations et identité de l'émetteur.
La variable DONNEES permet de viser un autre fichier que donnees/prospection.json.`);
  process.exit(0);
}

const stockage = new Stockage(process.env.DONNEES ? resolve(process.env.DONNEES) : undefined);
const aSupprimer = stockage.prospects().length;

console.log(`\n  Base    : ${stockage.emplacement}`);
console.log(`  Contenu : ${aSupprimer} prospect(s)\n`);

if (!aSupprimer) {
  console.log("  Rien à supprimer, la base est déjà vide.\n");
  process.exit(0);
}

if (!argv.includes("--oui")) {
  const lecture = createInterface({ input: process.stdin, output: process.stdout });
  const reponse = (await lecture.question(
    `  Supprimer définitivement ces ${aSupprimer} prospect(s), leurs audits et leurs documents ? [o/N] `,
  )).trim().toLowerCase();
  lecture.close();
  // Tout ce qui n'est pas un « oui » franc annule : on ne supprime pas sur une frappe hésitante.
  if (reponse !== "o" && reponse !== "oui") {
    console.log("\n  Annulé, rien n'a été supprimé.\n");
    process.exit(0);
  }
}

const supprimes = stockage.videProspects();
console.log(`\n  ${supprimes} prospect(s) supprimé(s). Prestations et identité conservées.\n`);
