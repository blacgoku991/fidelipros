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

/** Balise script avec ses attributs de sécurité : sert au contrôle d'intégrité (SRI). */
export interface ScriptHtml {
  src: string;
  integrity: string | null;
  externe: boolean;
}

export function scriptsAvecAttributs(html: string, origine?: string): ScriptHtml[] {
  return [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map((balise) => {
    const src = balise[1].trim();
    let externe = /^https?:\/\//i.test(src) || src.startsWith("//");
    if (externe && origine) {
      try {
        externe = new URL(src, origine).origin !== new URL(origine).origin;
      } catch {
        externe = true;
      }
    }
    return {
      src,
      integrity: /integrity=["']([^"']+)["']/i.exec(balise[0])?.[1] ?? null,
      externe,
    };
  });
}

/**
 * Composants front identifiés avec leur version, à partir du nom de fichier ou du paramètre
 * `?ver=` que WordPress ajoute à chaque ressource. C'est exactement ce que lit un scanner
 * automatisé pour choisir sa cible.
 */
export interface ComposantDetecte {
  nom: string;
  version: string;
  source: string;
}

const COMPOSANTS: Array<{ nom: string; motif: RegExp }> = [
  { nom: "jQuery", motif: /jquery[.-](\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i },
  { nom: "jQuery UI", motif: /jquery-ui[.-](\d+\.\d+(?:\.\d+)?)/i },
  { nom: "jQuery Migrate", motif: /jquery-migrate[.-](\d+\.\d+(?:\.\d+)?)/i },
  { nom: "Bootstrap", motif: /bootstrap[.-](\d+\.\d+(?:\.\d+)?)(?:\.min)?\.(?:js|css)/i },
  { nom: "AngularJS", motif: /angular[.-](1\.\d+(?:\.\d+)?)(?:\.min)?\.js/i },
  { nom: "Moment.js", motif: /moment[.-](\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i },
  { nom: "Lodash", motif: /lodash[.-](\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i },
  { nom: "Slick", motif: /slick[.-](\d+\.\d+(?:\.\d+)?)/i },
  { nom: "Fancybox", motif: /fancybox[.-](\d+\.\d+(?:\.\d+)?)/i },
  { nom: "Swiper", motif: /swiper[.-](\d+\.\d+(?:\.\d+)?)/i },
];

/** Extensions WordPress repérées dans les URL de ressources, avec leur version déclarée. */
const RE_PLUGIN_WP = /\/wp-content\/plugins\/([a-z0-9_-]+)\/[^"'\s]*?(?:\?|&)ver=([0-9][0-9a-z.\-]*)/gi;
const RE_THEME_WP = /\/wp-content\/themes\/([a-z0-9_-]+)\/[^"'\s]*?(?:\?|&)ver=([0-9][0-9a-z.\-]*)/gi;

export function composantsDetectes(html: string): ComposantDetecte[] {
  const trouves = new Map<string, ComposantDetecte>();

  for (const { nom, motif } of COMPOSANTS) {
    const trouve = motif.exec(html);
    if (trouve) trouves.set(nom, { nom, version: trouve[1], source: "fichier" });
  }
  for (const [, slug, version] of html.matchAll(RE_PLUGIN_WP)) {
    trouves.set(`plugin:${slug}`, { nom: slug, version, source: "plugin WordPress" });
  }
  for (const [, slug, version] of html.matchAll(RE_THEME_WP)) {
    trouves.set(`theme:${slug}`, { nom: slug, version, source: "thème WordPress" });
  }
  return [...trouves.values()];
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

/**
 * Traceurs publicitaires ou de mesure d'audience chargés par la page.
 * Matomo configuré sans cookie et les outils exemptés ne sont pas listés : on ne signale que
 * ce qui, en pratique, dépose des cookies soumis au consentement.
 */
const TRACEURS = [
  { motif: /googletagmanager\.com\/gtag|gtag\('config'|google-analytics\.com\/analytics|\bga\('create'/i, nom: "Google Analytics" },
  { motif: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/i, nom: "Google Tag Manager" },
  { motif: /connect\.facebook\.net|fbevents\.js|fbq\('init'/i, nom: "Meta Pixel" },
  { motif: /static\.hotjar\.com|hj\.q=/i, nom: "Hotjar" },
  { motif: /clarity\.ms/i, nom: "Microsoft Clarity" },
  { motif: /analytics\.tiktok\.com/i, nom: "TikTok Pixel" },
  { motif: /googleads\.g\.doubleclick\.net|googlesyndication\.com/i, nom: "Google Ads" },
];

export function traceurs(html: string): string[] {
  return TRACEURS.filter(({ motif }) => motif.test(html)).map(({ nom }) => nom);
}

/** Solutions de consentement les plus répandues, plus les formulations habituelles. */
const CONSENTEMENT = /tarteaucitron|axeptio|cookiebot|didomi|orejime|klaro|cookieyes|complianz|cookie-?consent|cookieconsent|osano|iubenda|sirdata|quantcast|consentmanager|gestion des cookies|accepter les cookies|accepter et fermer|gérer mes cookies|param[eè]trer les cookies|continuer sans accepter/i;

export function aBandeauConsentement(html: string): boolean {
  return CONSENTEMENT.test(html);
}

/** Contenu de la balise generator (CMS et version). */
export function generateur(html: string): string | null {
  return meta(html, "generator");
}

/**
 * Technologie derrière le site, quand elle se déclare franchement (balise generator, CDN,
 * en-têtes propres à la plateforme). Ce n'est pas un défaut : c'est un argument de vente
 * (« un site Wix ne s'exporte pas », « votre WordPress demande des mises à jour »).
 */
const TECHNOLOGIES: Array<{ nom: string; html?: RegExp; entete?: string }> = [
  { nom: "Wix", html: /wixstatic\.com|static\.parastorage\.com|X-Wix-/i, entete: "x-wix-request-id" },
  { nom: "Squarespace", html: /static1\.squarespace\.com|squarespace\.com\/universal/i },
  { nom: "Shopify", html: /cdn\.shopify\.com|shopify\.theme/i, entete: "x-shopid" },
  { nom: "Webflow", html: /webflow\.(js|css)|assets\.website-files\.com|uploads-ssl\.webflow\.com/i },
  { nom: "Jimdo", html: /jimdo(-storage|cdn)?\.com|assets\.jimstatic\.com/i },
  { nom: "IONOS MyWebsite", html: /mywebsite-editor|1and1\.com\/mywebsite/i },
  { nom: "Weebly", html: /weebly\.com\/(uploads|editor)|weeblycloud/i },
  { nom: "Google Sites", html: /sites\.google\.com|gstatic\.com\/atari/i },
  { nom: "WordPress", html: /wp-content\/|wp-includes\/|generator" content="WordPress/i },
  { nom: "PrestaShop", html: /prestashop|\/modules\/ps_/i },
  { nom: "Joomla", html: /\/media\/jui\/|joomla/i },
  { nom: "Drupal", html: /\/sites\/default\/files\/|drupal/i },
  { nom: "Odoo", html: /odoo|\/web\/assets\//i },
  { nom: "SPIP", html: /spip\.php|generator" content="SPIP/i },
  { nom: "Shopware", html: /shopware/i },
  { nom: "Magento", html: /mage\/|magento/i },
];

export function technologie(html: string, entetes: Record<string, string> = {}): string | null {
  for (const { nom, html: motifHtml, entete } of TECHNOLOGIES) {
    if (entete && entetes[entete]) return nom;
    if (motifHtml?.test(html)) return nom;
  }
  return null;
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
