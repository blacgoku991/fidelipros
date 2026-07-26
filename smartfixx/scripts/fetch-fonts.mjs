/**
 * Télécharge les polices depuis Google Fonts et génère `src/fonts.css`.
 * Les fichiers sont auto-hébergés : pas de requête tierce au chargement,
 * pas de dépendance externe, et rien à déclarer côté RGPD.
 *
 *   node scripts/fetch-fonts.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FAMILIES = [
  "Space+Grotesk:wght@400;500;600;700",
  "Inter:wght@300;400;500;600",
  "JetBrains+Mono:wght@400;500",
];

const OUT_DIR = path.resolve("public/fonts");
const CSS_OUT = path.resolve("src/fonts.css");
const KEEP_SUBSETS = new Set(["latin"]); // U+0152-0153 (Œœ) est déjà dans "latin" : le français est couvert.

const slug = (family, weight, subset) =>
  `${family.toLowerCase().replace(/\s+/g, "-")}-${weight}-${subset}.woff2`;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const url = `https://fonts.googleapis.com/css2?${FAMILIES.map((f) => `family=${f}`).join(
    "&",
  )}&display=swap`;

  const css = await (await fetch(url, { headers: { "User-Agent": UA } })).text();

  // Google emits one @font-face block per subset, preceded by a /* subset */ comment.
  const blocks = css.split("/*").slice(1);
  const rules = [];

  for (const block of blocks) {
    const subset = block.slice(0, block.indexOf("*/")).trim();
    if (!KEEP_SUBSETS.has(subset)) continue;

    const family = /font-family:\s*'([^']+)'/.exec(block)?.[1];
    const weight = /font-weight:\s*(\d+)/.exec(block)?.[1];
    const src = /src:\s*url\(([^)]+)\)/.exec(block)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(block)?.[1];
    if (!family || !weight || !src) continue;

    const filename = slug(family, weight, subset);
    const buffer = Buffer.from(await (await fetch(src)).arrayBuffer());
    await writeFile(path.join(OUT_DIR, filename), buffer);

    rules.push(
      [
        "@font-face {",
        `  font-family: '${family}';`,
        "  font-style: normal;",
        `  font-weight: ${weight};`,
        "  font-display: swap;",
        `  src: url('/fonts/${filename}') format('woff2');`,
        range ? `  unicode-range: ${range};` : null,
        "}",
      ]
        .filter(Boolean)
        .join("\n"),
    );

    console.log(`✓ ${filename} (${(buffer.length / 1024).toFixed(1)} kB)`);
  }

  await writeFile(
    CSS_OUT,
    `/* Généré par scripts/fetch-fonts.mjs — ne pas éditer à la main. */\n\n${rules.join("\n\n")}\n`,
  );
  console.log(`\n${rules.length} @font-face écrites dans src/fonts.css`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
