// Extracteurs HTML sans DOM (les edge functions Deno n'en ont pas).
// Volontairement tolérants : un site mal formé ne doit jamais faire échouer l'audit.

export interface ImageHtml {
  src: string;
  aAlt: boolean;
  aDimensions: boolean;
}

export interface LienHtml {
  href: string;
  texte: string;
}

export interface FormulaireHtml {
  action: string;
  methode: string;
}

const SANS_SCRIPTS = /<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi;

/** Texte visible de la page, scripts et balises retirés. */
export function texteVisible(html: string): string {
  return html
    .replace(SANS_SCRIPTS, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compteMots(html: string): number {
  const texte = texteVisible(html);
  return texte ? texte.split(/\s+/).length : 0;
}

export function titrePage(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  const texte = m[1].replace(/\s+/g, " ").trim();
  return texte || null;
}

/** Contenu d'une balise meta par nom (`name`) ou propriété (`property`). */
export function meta(html: string, nom: string): string | null {
  const motif = new RegExp(
    `<meta[^>]+(?:name|property)=["']?${nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']?[^>]*>`,
    "i",
  );
  const balise = html.match(motif);
  if (!balise) return null;
  const contenu = balise[0].match(/content=["']([\s\S]*?)["']/i);
  return contenu ? contenu[1].replace(/\s+/g, " ").trim() : "";
}

/** Vrai si au moins une balise meta dont le nom commence par le préfixe existe (og:, twitter:…). */
export function aMetaPrefixe(html: string, prefixe: string): boolean {
  return new RegExp(`<meta[^>]+(?:name|property)=["']?${prefixe}`, "i").test(html);
}

export function compteBalises(html: string, balise: string): number {
  return (html.match(new RegExp(`<${balise}\\b`, "gi")) ?? []).length;
}

/** Séquence des niveaux de titres rencontrés (1 pour h1, 2 pour h2…). */
export function niveauxTitres(html: string): number[] {
  return [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
}

export function attributLang(html: string): string | null {
  const m = html.match(/<html[^>]+lang=["']?([a-zA-Z-]{2,})["']?/i);
  return m ? m[1] : null;
}

export function canonical(html: string): string | null {
  const m = html.match(/<link[^>]+rel=["']?canonical["']?[^>]*>/i);
  if (!m) return null;
  const href = m[0].match(/href=["']([^"']+)["']/i);
  return href ? href[1] : null;
}

export function aFavicon(html: string): boolean {
  return /<link[^>]+rel=["']?[^"'>]*icon/i.test(html);
}

export function images(html: string): ImageHtml[] {
  return [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => {
    const balise = m[0];
    const src = balise.match(/\ssrc=["']([^"']*)["']/i);
    return {
      src: src ? src[1] : "",
      aAlt: /\salt=["']?[^"'>]/i.test(balise),
      aDimensions: /\swidth=/i.test(balise) && /\sheight=/i.test(balise),
    };
  });
}

export function liens(html: string): LienHtml[] {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({
    href: m[1].trim(),
    texte: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  }));
}

export function formulaires(html: string): FormulaireHtml[] {
  return [...html.matchAll(/<form\b[^>]*>/gi)].map((m) => {
    const action = m[0].match(/action=["']([^"']*)["']/i);
    const methode = m[0].match(/method=["']([^"']*)["']/i);
    return {
      action: action ? action[1] : "",
      methode: (methode ? methode[1] : "get").toLowerCase(),
    };
  });
}

export function scripts(html: string): string[] {
  return [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map((m) => m[1]);
}

export function feuillesDeStyle(html: string): string[] {
  return [...html.matchAll(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi)]
    .map((m) => m[0].match(/href=["']([^"']+)["']/i)?.[1] ?? "")
    .filter(Boolean);
}

/** Types déclarés dans les blocs JSON-LD (`@type`). */
export function typesJsonLd(html: string): string[] {
  const types: string[] = [];
  for (const bloc of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    for (const t of bloc[1].matchAll(/"@type"\s*:\s*"([^"]+)"/g)) types.push(t[1]);
  }
  return types;
}

/** Contenu de la balise generator (CMS et version). */
export function generateur(html: string): string | null {
  return meta(html, "generator");
}

/** Familles de polices distinctes déclarées dans le HTML (Google Fonts, @font-face, font-family). */
export function comptePolices(html: string): number {
  const familles = new Set<string>();
  for (const m of html.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    const premiere = m[1].split(",")[0].trim().toLowerCase().replace(/["']/g, "");
    if (premiere) familles.add(premiere);
  }
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"']+)/gi)) {
    for (const f of m[1].matchAll(/family=([^&:]+)/g)) {
      familles.add(decodeURIComponent(f[1]).replace(/\+/g, " ").toLowerCase());
    }
  }
  return familles.size;
}

/** Ressources chargées en http:// depuis une page (contenu mixte). */
export function ressourcesNonSecurisees(html: string): string[] {
  return [...html.matchAll(/(?:src|href)=["'](http:\/\/[^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((url) => !/\.(xml|txt)$/i.test(url) && !url.includes("://localhost"))
    .slice(0, 10);
}

/** Dernière année de copyright mentionnée dans la page. */
export function anneeCopyright(html: string, anneeMax: number): number | null {
  const annees = [...html.toLowerCase().matchAll(/(?:©|&copy;|copyright)[^0-9]{0,20}((?:19|20)\d{2})/g)]
    .map((m) => Number(m[1]))
    .filter((a) => a >= 1990 && a <= anneeMax);
  return annees.length ? Math.max(...annees) : null;
}

/** Échappe du contenu tiers avant insertion dans un document HTML généré. */
export function echappeHtml(valeur: unknown): string {
  return String(valeur ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
