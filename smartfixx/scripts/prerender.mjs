/**
 * Génère un vrai fichier HTML statique par route, plus le sitemap.
 *
 * Un SPA React livre une page vide aux robots : Google finit par exécuter le
 * JavaScript, mais avec du retard et sans garantie, et les autres moteurs comme
 * les aperçus de partage ne le font pas du tout. On rend donc l'application une
 * fois par route côté Node au moment du build, et on écrit chaque résultat dans
 * son propre `index.html`.
 *
 * Le client repart d'un `createRoot` classique : il remplace ce contenu au
 * montage, il n'y a donc aucun risque d'écart d'hydratation.
 *
 * Lancé automatiquement par `npm run build`.
 */
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DIST = path.resolve("dist");
const SERVER_DIR = path.join(DIST, "server");
const HTML_FILE = path.join(DIST, "index.html");
const ROOT_MARKER = '<div id="root"></div>';

/**
 * Framer Motion sérialise ses états `initial` en styles inline — la plupart du
 * contenu sortirait donc avec `opacity: 0`, que Google traite comme masqué. On
 * retire uniquement `opacity` et `transform` des attributs `style`, en laissant
 * intactes les déclarations utiles (couleurs, dégradés, ratios).
 */
function unhideAnimatedContent(html) {
  return html.replace(/ style="([^"]*)"/g, (_match, declarations) => {
    const kept = declarations
      .split(";")
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .filter((declaration) => !/^(opacity|transform|-webkit-transform)\s*:/i.test(declaration));

    return kept.length ? ` style="${kept.join("; ")}"` : "";
  });
}

const escapeHtml = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Réécrit les balises dépendant de la page : titre, description, canonical, OG. */
function applyMeta(template, { title, description, url }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);

  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[\s\S]*?(")/, (_m, a, b) => `${a}${d}${b}`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, (_m, a, b) => `${a}${url}${b}`)
    .replace(/(<link rel="alternate" hreflang="fr" href=")[^"]*(")/, (_m, a, b) => `${a}${url}${b}`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, (_m, a, b) => `${a}${url}${b}`)
    .replace(/(<meta\s+property="og:title"\s+content=")[\s\S]*?(")/, (_m, a, b) => `${a}${t}${b}`)
    .replace(
      /(<meta\s+property="og:description"\s+content=")[\s\S]*?(")/,
      (_m, a, b) => `${a}${d}${b}`,
    )
    .replace(/(<meta\s+name="twitter:title"\s+content=")[\s\S]*?(")/, (_m, a, b) => `${a}${t}${b}`)
    .replace(
      /(<meta\s+name="twitter:description"\s+content=")[\s\S]*?(")/,
      (_m, a, b) => `${a}${d}${b}`,
    );
}

function buildSitemap(routes, base, today) {
  const urls = routes
    .map(
      (route) =>
        `  <url>\n    <loc>${base}${route.path === "/" ? "/" : route.path}</loc>\n` +
        `    <lastmod>${today}</lastmod>\n` +
        `    <changefreq>monthly</changefreq>\n` +
        `    <priority>${route.priority.toFixed(1)}</priority>\n  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

async function main() {
  const template = await readFile(HTML_FILE, "utf8");

  if (!template.includes(ROOT_MARKER)) {
    throw new Error(
      `Point d'injection introuvable dans dist/index.html (attendu : ${ROOT_MARKER}). ` +
        "Le pré-rendu est annulé pour ne pas produire un HTML incohérent.",
    );
  }

  const { render, routes, siteUrl } = await import(
    pathToFileURL(path.join(SERVER_DIR, "entry-server.js")).href
  );

  const base = siteUrl.replace(/\/$/, "");
  const today = new Date().toISOString().slice(0, 10);

  for (const route of routes) {
    const markup = unhideAnimatedContent(render(route.path));

    if (markup.length < 3000) {
      throw new Error(
        `Le rendu de ${route.path} ne fait que ${markup.length} caractères — ` +
          "anormalement court, le pré-rendu est annulé.",
      );
    }

    const url = `${base}${route.path === "/" ? "/" : route.path}`;
    const html = applyMeta(template, {
      title: route.title,
      description: route.description,
      url,
    }).replace(ROOT_MARKER, `<div id="root">${markup}</div>`);

    // "/" reste dist/index.html ; "/foo" devient dist/foo/index.html, servi
    // proprement par n'importe quel hébergeur statique sans règle de réécriture.
    const target = route.path === "/" ? HTML_FILE : path.join(DIST, route.path, "index.html");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, html);

    console.log(`  ✓ ${route.path.padEnd(46)} ${(markup.length / 1024).toFixed(0)} kB`);
  }

  await writeFile(path.join(DIST, "sitemap.xml"), buildSitemap(routes, base, today));
  console.log(`  ✓ sitemap.xml (${routes.length} URL)`);

  // Le bundle SSR n'a servi qu'à ça : il ne doit pas partir en production.
  await rm(SERVER_DIR, { recursive: true, force: true });

  console.log(`✓ ${routes.length} pages pré-rendues`);
}

main().catch((error) => {
  console.error("✗ Échec du pré-rendu :", error.message);
  process.exit(1);
});
