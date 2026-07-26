/**
 * Propage `redirects.json` vers les deux formats d'hébergement.
 *
 * Une seule liste à maintenir : ce script écrit le tableau `redirects` de
 * `vercel.json` et le fichier `public/_redirects` lu par Netlify. Sans ça les
 * deux configurations divergent et la bascule se fait avec des redirections
 * incomplètes selon l'hébergeur.
 *
 * Lancé automatiquement au début de `npm run build`, avant Vite, pour que
 * `public/_redirects` soit copié dans `dist/`.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE = path.resolve("redirects.json");
const VERCEL = path.resolve("vercel.json");
const NETLIFY = path.resolve("public/_redirects");

const isPath = (value) => typeof value === "string" && value.startsWith("/");

async function main() {
  const { redirects = [] } = JSON.parse(await readFile(SOURCE, "utf8"));

  const clean = [];
  for (const [index, rule] of redirects.entries()) {
    if (!isPath(rule?.from) || !isPath(rule?.to)) {
      throw new Error(
        `redirects.json, règle ${index + 1} : « from » et « to » doivent être des ` +
          `chemins commençant par « / ». Reçu : ${JSON.stringify(rule)}`,
      );
    }
    if (rule.from === rule.to) {
      throw new Error(`redirects.json, règle ${index + 1} : boucle (${rule.from} vers lui-même).`);
    }
    clean.push({ from: rule.from, to: rule.to });
  }

  const duplicates = clean.map((r) => r.from).filter((f, i, all) => all.indexOf(f) !== i);
  if (duplicates.length) {
    throw new Error(`redirects.json : « from » en double — ${[...new Set(duplicates)].join(", ")}`);
  }

  // Vercel : tableau `redirects`, permanent = 308 (équivalent 301 en préservant
  // la méthode HTTP, et traité comme tel par Google).
  const vercel = JSON.parse(await readFile(VERCEL, "utf8"));
  if (clean.length) {
    vercel.redirects = clean.map((r) => ({
      source: r.from,
      destination: r.to,
      permanent: true,
    }));
  } else {
    delete vercel.redirects;
  }
  await writeFile(VERCEL, `${JSON.stringify(vercel, null, 2)}\n`);

  // Netlify : un fichier plat, une règle par ligne.
  const header =
    "# Généré par scripts/sync-redirects.mjs depuis redirects.json.\n" +
    "# Ne pas éditer à la main : les modifications seraient écrasées au build.\n";
  const body = clean.map((r) => `${r.from}  ${r.to}  301!`).join("\n");
  await writeFile(NETLIFY, clean.length ? `${header}\n${body}\n` : header);

  console.log(
    clean.length
      ? `✓ ${clean.length} redirection(s) propagée(s) vers vercel.json et public/_redirects`
      : "· Aucune redirection définie (redirects.json vide) — à remplir avant la bascule",
  );
}

main().catch((error) => {
  console.error("✗ Redirections :", error.message);
  process.exit(1);
});
