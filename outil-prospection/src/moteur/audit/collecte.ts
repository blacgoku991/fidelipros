// Collecte des données d'audit d'un site.
//
// Règle de conception : chaque collecteur est indépendant et ne peut jamais faire échouer
// l'audit. Un échec ajoute une ligne dans `erreurs` et laisse la donnée à `null` — les
// règles savent traiter l'absence d'information sans inventer de défaut.

import { collecteArchive } from "./archive.ts";
import { litCertificat, type OptionsCertificat } from "./certificat.ts";
import {
  agregeContacts, CHEMINS_CONTACT, contactsVides, lienspagesContact,
} from "./contacts.ts";
import { images, liens, technologie } from "./html.ts";
import { domaine, origine, pause, recupereHttp, USER_AGENT, type CauseEchec } from "./http.ts";
import type {
  ContexteAudit,
  DonneesDns,
  FichierExpose,
  ImageMesuree,
  LienCasse,
  MesuresTerrain,
  ReponseHttp,
  ResultatLighthouse,
} from "./types.ts";

export interface OptionsCollecte {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxOctets?: number;
  /** Lighthouse via PageSpeed Insights (nécessite un accès à googleapis.com). */
  avecLighthouse?: boolean;
  clePageSpeed?: string;
  /** Sondage des fichiers publics classiquement laissés en ligne par erreur. */
  avecSonde?: boolean;
  /** Vérification des liens internes (défaut : comme le sondage). */
  avecLiens?: boolean;
  /** Mesure du poids réel des images (défaut : comme le sondage). */
  avecImages?: boolean;
  /** Historique Internet Archive (défaut : comme Lighthouse). */
  avecArchive?: boolean;
  /** Lecture du certificat TLS (injectable pour les tests). */
  lecteurCertificat?: OptionsCertificat["lecteur"];
  delaiSondeMs?: number;
  /** Timestamp (ms) au-delà duquel on arrête de collecter. */
  echeance?: number;
  anneeCourante?: number;
  /**
   * Autorise les hôtes privés (127.0.0.1, .local…). Réservé aux tests locaux via le CLI :
   * les edge functions ne passent jamais cette option, le garde-fou SSRF reste entier côté
   * serveur.
   */
  autoriseHotesPrives?: boolean;
}

/**
 * Chemins interdits par le robots.txt pour un robot générique.
 * Le sondage est passif, mais rien ne justifie d'aller lire ce que le site demande de ne pas
 * explorer : on respecte la consigne, et on le dit dans le rapport si on s'abstient.
 */
export function cheminsInterdits(robotsTxt: string | null | undefined): string[] {
  if (!robotsTxt) return [];
  const interdits: string[] = [];
  let concerne = false;
  for (const ligne of robotsTxt.split(/\r?\n/)) {
    const propre = ligne.replace(/#.*$/, "").trim();
    if (!propre) continue;
    const [cle, ...reste] = propre.split(":");
    const valeur = reste.join(":").trim();
    const nom = cle.trim().toLowerCase();
    if (nom === "user-agent") {
      concerne = valeur === "*";
      continue;
    }
    if (concerne && nom === "disallow" && valeur) interdits.push(valeur);
  }
  return interdits;
}

export function cheminAutorise(chemin: string, interdits: string[]): boolean {
  return !interdits.some((interdit) => interdit === "/" || chemin.startsWith(interdit));
}

/** Fichiers publics vérifiés : liste fixe, lecture seule, aucune tentative d'exploitation. */
export const FICHIERS_SONDES: Array<{ chemin: string; indice: string }> = [
  { chemin: "/.env", indice: "Variables d'environnement (mots de passe de base de données)" },
  { chemin: "/.git/HEAD", indice: "Dépôt Git : code source et historique téléchargeables" },
  { chemin: "/wp-config.php.bak", indice: "Sauvegarde de la configuration WordPress" },
  { chemin: "/config.php.bak", indice: "Sauvegarde de fichier de configuration" },
  { chemin: "/backup.zip", indice: "Archive de sauvegarde du site" },
  { chemin: "/phpinfo.php", indice: "Configuration complète du serveur PHP" },
  { chemin: "/.DS_Store", indice: "Fichier macOS listant les fichiers du dossier" },
  { chemin: "/server-status", indice: "Console d'état du serveur Apache" },
  { chemin: "/wp-content/uploads/", indice: "Listing du dossier des fichiers téléversés" },
];

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

/** Audits Lighthouse conservés (les seuls exploités par les règles). */
const AUDITS_LIGHTHOUSE = [
  "content-width", "font-size", "tap-targets", "color-contrast",
  "modern-image-formats", "uses-responsive-images", "uses-text-compression",
  "uses-long-cache-ttl", "server-response-time", "errors-in-console",
  "is-on-https", "viewport", "document-title", "meta-description",
  "crawlable-anchors", "robots-txt", "image-alt", "hreflang",
];

function expire(echeance?: number): boolean {
  return Boolean(echeance && Date.now() > echeance);
}

/**
 * Hôtes qui ne peuvent pas être un site de prospect : boucle locale, réseaux privés,
 * adresse de métadonnées des hébergeurs cloud, domaines réservés aux tests.
 * L'audit part d'une URL fournie par un administrateur : on l'empêche de servir de relais
 * vers le réseau interne de l'infrastructure (SSRF).
 */
const HOTES_INTERDITS = [
  /^localhost$/i,
  /\.localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^\[?::1\]?$/,
  /^\[?f[cd]/i,
  /\.internal$/i,
  /\.local$/i,
  /\.(test|invalid|example)$/i,
];

/** Vrai si l'hôte peut être un site public légitime. */
export function hotePublic(hote: string): boolean {
  const propre = hote.trim().toLowerCase();
  if (!propre || !propre.includes(".") && !propre.startsWith("[")) return false;
  return !HOTES_INTERDITS.some((motif) => motif.test(propre));
}

/** Normalise une saisie utilisateur en URL absolue publique (http/https uniquement). */
export function normaliseUrl(saisie: string, autoriseHotesPrives = false): string | null {
  const propre = saisie.trim();
  if (!propre) return null;
  const avecSchema = /^https?:\/\//i.test(propre) ? propre : `https://${propre}`;
  try {
    const url = new URL(avecSchema);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!autoriseHotesPrives && !hotePublic(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Signatures des pare-feux applicatifs qui bloquent les requêtes non navigateur. */
const ENTETES_PARE_FEU = ["cf-ray", "cf-mitigated", "x-sucuri-id", "x-iinfo", "x-akamai-transformed"];
const CORPS_PARE_FEU = [
  "just a moment", "attention required", "checking your browser", "access denied",
  "cloudflare", "sucuri website firewall", "request unsuccessful", "captcha",
  "vous avez été bloqué", "ddos protection",
];

/**
 * Une réponse d'erreur provient-elle d'une protection anti-robot plutôt que d'une panne ?
 * Très fréquent chez les PME derrière Cloudflare : conclure « site en erreur » serait faux.
 */
export function estBlocageParPareFeu(reponse: ReponseHttp): boolean {
  if (![403, 406, 429, 503].includes(reponse.statut)) return false;
  if (ENTETES_PARE_FEU.some((cle) => reponse.entetes[cle])) return true;
  if (/cloudflare|sucuri|incapsula|akamai|imperva/i.test(reponse.entetes.server ?? "")) return true;
  const corps = reponse.html.slice(0, 4000).toLowerCase();
  return CORPS_PARE_FEU.some((marqueur) => corps.includes(marqueur));
}

/** Vérifie que l'adresse en http:// redirige bien vers https://. */
export async function verifieRedirectionHttps(
  url: string,
  options: OptionsCollecte,
): Promise<boolean | null> {
  const base = origine(url);
  if (!base) return null;
  const reponse = await recupereHttp(base.replace(/^https:/, "http:"), {
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs ?? 8000,
    maxOctets: 20_000,
  });
  if (!reponse) return null;
  return reponse.urlFinale.startsWith("https://");
}

export async function collecteRobots(
  url: string,
  options: OptionsCollecte,
): Promise<{ present: boolean; contenu: string } | null> {
  const base = origine(url);
  if (!base) return null;
  const reponse = await recupereHttp(`${base}/robots.txt`, {
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs ?? 8000,
    maxOctets: 50_000,
  });
  if (!reponse) return null;
  const estTexte = !/<html/i.test(reponse.html);
  return { present: reponse.statut === 200 && estTexte, contenu: reponse.html };
}

export async function collecteSitemap(
  url: string,
  robots: { contenu: string } | null,
  options: OptionsCollecte,
): Promise<{ present: boolean; urls: number } | null> {
  const base = origine(url);
  if (!base) return null;
  const declare = robots?.contenu.match(/^\s*sitemap:\s*(\S+)/im)?.[1];
  const cible = declare ?? `${base}/sitemap.xml`;
  const reponse = await recupereHttp(cible, {
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs ?? 8000,
    maxOctets: 200_000,
  });
  if (!reponse) return null;
  const estXml = /<(urlset|sitemapindex)/i.test(reponse.html);
  return {
    present: reponse.statut === 200 && estXml,
    urls: (reponse.html.match(/<loc>/gi) ?? []).length,
  };
}

/** Récupère la première page interne réelle (hors accueil, ancres et fichiers). */
export async function collectePageInterne(
  accueil: ReponseHttp,
  options: OptionsCollecte,
): Promise<ReponseHttp | null> {
  const base = origine(accueil.urlFinale);
  if (!base) return null;
  // Jusqu'à trois candidats : une page qui répond en erreur ne représente pas le site, et
  // fausserait les comparaisons de titre et de contenu.
  let essais = 0;
  for (const lien of liens(accueil.html).slice(0, 40)) {
    if (/^(mailto:|tel:|javascript:|#)/i.test(lien.href)) continue;
    let absolue: URL;
    try {
      absolue = new URL(lien.href, accueil.urlFinale);
    } catch {
      continue;
    }
    if (absolue.origin !== base) continue;
    if (absolue.pathname === "/" || absolue.pathname === new URL(accueil.urlFinale).pathname) continue;
    if (/\.(pdf|jpe?g|png|gif|zip|docx?|xlsx?|mp4|svg|webp)$/i.test(absolue.pathname)) continue;

    const reponse = await recupereHttp(absolue.toString(), {
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs ?? 8000,
      maxOctets: options.maxOctets ?? 500_000,
    });
    if (reponse && reponse.statut < 400) return reponse;
    if (++essais >= 3) return reponse;
  }
  return null;
}

/** Extensions qu'on ne va pas chercher pour vérifier un lien (téléchargements). */
const EXTENSIONS_FICHIERS = /\.(pdf|zip|docx?|xlsx?|pptx?|mp4|mp3|avi|dmg|exe|apk)$/i;

/**
 * Vérifie que les liens du menu et du corps de page mènent quelque part.
 * Un lien mort est un constat que le prospect vérifie en un clic : c'est l'argument le plus
 * simple à faire admettre, et il ne dépend d'aucune API.
 */
export async function verifieLiens(
  accueil: ReponseHttp,
  options: OptionsCollecte,
  max = 12,
): Promise<{ verifies: number; casses: LienCasse[] }> {
  const base = origine(accueil.urlFinale);
  if (!base) return { verifies: 0, casses: [] };

  const candidats: Array<{ url: string; texte: string }> = [];
  for (const lien of liens(accueil.html)) {
    if (/^(mailto:|tel:|javascript:|#|data:)/i.test(lien.href)) continue;
    let absolue: URL;
    try {
      absolue = new URL(lien.href, accueil.urlFinale);
    } catch {
      continue;
    }
    if (absolue.origin !== base) continue;
    if (EXTENSIONS_FICHIERS.test(absolue.pathname)) continue;
    absolue.hash = "";
    const adresse = absolue.toString();
    if (adresse === accueil.urlFinale) continue;
    if (!candidats.some((c) => c.url === adresse)) candidats.push({ url: adresse, texte: lien.texte });
    if (candidats.length >= max) break;
  }

  const casses: LienCasse[] = [];
  let verifies = 0;
  for (const candidat of candidats) {
    if (expire(options.echeance)) break;
    const commun = { fetchImpl: options.fetchImpl, timeoutMs: Math.min(options.timeoutMs ?? 6000, 6000), maxOctets: 2_000 };
    let reponse = await recupereHttp(candidat.url, { ...commun, methode: "HEAD" });
    // Beaucoup de serveurs refusent HEAD : on retente en GET avant de conclure.
    if (!reponse || reponse.statut === 405 || reponse.statut === 501) {
      reponse = await recupereHttp(candidat.url, commun);
    }
    await pause(options.delaiSondeMs ?? 200);
    if (!reponse) continue;
    verifies++;
    if (reponse.statut >= 400) {
      casses.push({ url: candidat.url, statut: reponse.statut, texte: candidat.texte.slice(0, 60) });
    }
  }
  return { verifies, casses };
}

/**
 * Poids réel des images de la page d'accueil, mesuré en lisant leur en-tête `content-length`.
 * Sans Lighthouse, c'est la seule mesure de performance vraiment parlante — et la plus
 * concrète pour le prospect : « votre photo d'accueil pèse 4,2 Mo ».
 */
export async function mesureImages(
  accueil: ReponseHttp,
  options: OptionsCollecte,
  max = 8,
): Promise<ImageMesuree[]> {
  const adresses: string[] = [];
  for (const image of images(accueil.html)) {
    if (!image.src || /^data:/i.test(image.src)) continue;
    let absolue: URL;
    try {
      absolue = new URL(image.src, accueil.urlFinale);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(absolue.protocol)) continue;
    if (!options.autoriseHotesPrives && !hotePublic(absolue.hostname)) continue;
    const adresse = absolue.toString();
    if (!adresses.includes(adresse)) adresses.push(adresse);
    if (adresses.length >= max) break;
  }

  const mesurees: ImageMesuree[] = [];
  for (const adresse of adresses) {
    if (expire(options.echeance)) break;
    const reponse = await recupereHttp(adresse, {
      fetchImpl: options.fetchImpl,
      timeoutMs: Math.min(options.timeoutMs ?? 6000, 6000),
      maxOctets: 2_000,
      methode: "HEAD",
    });
    await pause(options.delaiSondeMs ?? 150);
    const taille = Number(reponse?.entetes["content-length"]);
    if (!reponse || reponse.statut >= 400 || !Number.isFinite(taille) || taille <= 0) continue;
    mesurees.push({ url: adresse, octets: taille });
  }
  return mesurees.sort((a, b) => b.octets - a.octets);
}

/**
 * L'adresse avec et sans « www » servent-elles la même page sans redirection ?
 * `null` si la question n'a pas pu être tranchée (hôte alternatif injoignable, ce qui est le
 * cas normal quand une seule des deux formes existe).
 */
export async function verifieDuplicationWww(
  accueil: ReponseHttp,
  options: OptionsCollecte,
): Promise<boolean | null> {
  let cible: URL;
  try {
    cible = new URL(accueil.urlFinale);
  } catch {
    return null;
  }
  // Les sous-domaines autres que www ne sont pas concernés (blog., boutique.…).
  const hote = cible.hostname;
  const alternatif = hote.startsWith("www.") ? hote.slice(4) : `www.${hote}`;
  if (hote.split(".").length > (hote.startsWith("www.") ? 3 : 2)) return null;
  // Même garde-fou que pour l'accueil : on ne va pas interroger un hôte non public.
  if (!options.autoriseHotesPrives && !hotePublic(alternatif)) return null;
  cible.hostname = alternatif;

  const reponse = await recupereHttp(cible.toString(), {
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs ?? 8000,
    maxOctets: 60_000,
  });
  if (!reponse || reponse.statut >= 400) return null;

  // Redirigé vers la forme canonique : tout va bien. Servi tel quel : contenu dupliqué.
  try {
    return new URL(reponse.urlFinale).hostname === alternatif;
  } catch {
    return null;
  }
}

/**
 * Récupère les pages qui portent les coordonnées : celles liées depuis l'accueil (« Contact »,
 * « Mentions légales »), et à défaut les deux chemins usuels. Deux pages au maximum.
 */
export async function collectePagesContact(
  accueil: ReponseHttp,
  options: OptionsCollecte,
  /** Pages déjà récupérées ailleurs : on ne les redemande pas. */
  dejaLues: string[] = [],
  robotsTxt?: string | null,
): Promise<ReponseHttp[]> {
  const cible = { fetchImpl: options.fetchImpl, timeoutMs: options.timeoutMs ?? 8000, maxOctets: options.maxOctets ?? 300_000 };
  const interdits = cheminsInterdits(robotsTxt);
  const trouvees: ReponseHttp[] = [];

  for (const adresse of lienspagesContact(accueil.html, accueil.urlFinale, 3)) {
    if (dejaLues.includes(adresse)) continue;
    if (!cheminAutorise(new URL(adresse).pathname, interdits)) continue;
    const reponse = await recupereHttp(adresse, cible);
    if (reponse && reponse.statut < 400) trouvees.push(reponse);
    if (trouvees.length >= 2) return trouvees;
  }
  if (trouvees.length || dejaLues.length > 1) return trouvees;

  const base = origine(accueil.urlFinale);
  if (!base) return trouvees;
  for (const chemin of CHEMINS_CONTACT) {
    if (dejaLues.includes(`${base}${chemin}`)) continue;
    if (!cheminAutorise(chemin, interdits)) continue;
    const reponse = await recupereHttp(`${base}${chemin}`, cible);
    if (reponse && reponse.statut < 400 && reponse.html.length > 200) {
      trouvees.push(reponse);
      break;
    }
  }
  return trouvees;
}

/**
 * Deux points d'entrée WordPress publics, interrogés uniquement si le site est un WordPress.
 * Lecture seule, deux requêtes GET, sur des adresses documentées : `/wp-json/wp/v2/users`
 * publie la liste des comptes (c'est une fonctionnalité, souvent involontaire), et `/xmlrpc.php`
 * répond en GET qu'il n'accepte que le POST — ce qui suffit à savoir qu'il est actif. Aucun
 * mot de passe n'est essayé, aucune requête XML-RPC n'est envoyée.
 */
export async function sondeWordpress(
  url: string,
  options: OptionsCollecte,
  robotsTxt?: string | null,
): Promise<{ comptes: string[]; xmlrpc: boolean }> {
  const base = origine(url);
  const resultat = { comptes: [] as string[], xmlrpc: false };
  if (!base) return resultat;
  const interdits = cheminsInterdits(robotsTxt);
  const commun = {
    fetchImpl: options.fetchImpl,
    timeoutMs: Math.min(options.timeoutMs ?? 5000, 5000),
    maxOctets: 20_000,
  };

  if (cheminAutorise("/wp-json/wp/v2/users", interdits)) {
    const reponse = await recupereHttp(`${base}/wp-json/wp/v2/users`, commun);
    await pause(options.delaiSondeMs ?? 300);
    if (reponse?.statut === 200 && /"slug"\s*:/.test(reponse.html)) {
      resultat.comptes = [...reponse.html.matchAll(/"slug"\s*:\s*"([^"]{1,60})"/g)]
        .map((trouve) => trouve[1])
        .slice(0, 5);
    }
  }

  if (!expire(options.echeance) && cheminAutorise("/xmlrpc.php", interdits)) {
    const reponse = await recupereHttp(`${base}/xmlrpc.php`, commun);
    await pause(options.delaiSondeMs ?? 300);
    // 405 « XML-RPC server accepts POST requests only » : l'interface est en service.
    resultat.xmlrpc = Boolean(reponse && (reponse.statut === 405 || /XML-RPC server accepts POST/i.test(reponse.html)));
  }

  return resultat;
}

/** Vérifie qu'une adresse inexistante renvoie un vrai 404 avec une page personnalisée. */
export async function collecte404(
  url: string,
  options: OptionsCollecte,
): Promise<{ statut: number; personnalisee: boolean } | null> {
  const base = origine(url);
  if (!base) return null;
  const reponse = await recupereHttp(`${base}/fidelipro-verification-404`, {
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs ?? 8000,
    maxOctets: 100_000,
  });
  if (!reponse) return null;
  // Une page personnalisée conserve la navigation du site : on la reconnaît à sa taille
  // et à la présence de liens, contrairement à la page brute du serveur.
  const personnalisee = reponse.html.length > 2000 && liens(reponse.html).length >= 3;
  return { statut: reponse.statut, personnalisee };
}

/**
 * Interroge le DNS via DNS-over-HTTPS Cloudflare.
 * Retourne `null` quand la requête n'a pas abouti — à ne surtout pas confondre avec
 * « aucun enregistrement », sinon les règles concluraient à tort à une absence de protection.
 */
export async function interrogeDns(
  nom: string,
  type: "TXT" | "MX" | "A",
  options: OptionsCollecte,
): Promise<string[] | null> {
  const reponse = await interrogeDnsComplet(nom, type, options);
  return reponse ? reponse.valeurs : null;
}

/**
 * Requête DNS-over-HTTPS retournant aussi le drapeau `AD` (Authenticated Data), qui indique
 * que la réponse a été validée par DNSSEC. Cloudflare valide DNSSEC par défaut.
 */
export async function interrogeDnsComplet(
  nom: string,
  type: "TXT" | "MX" | "A",
  options: OptionsCollecte,
): Promise<{ valeurs: string[]; dnssec: boolean } | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), options.timeoutMs ?? 8000);
  try {
    const res = await fetchImpl(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(nom)}&type=${type}`,
      { headers: { Accept: "application/dns-json", "User-Agent": USER_AGENT }, signal: controleur.signal },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { Status?: number; AD?: boolean; Answer?: Array<{ data?: string }> };
    // Status 0 = réponse valide, 3 = domaine sans cet enregistrement : les deux sont exploitables.
    if (typeof data.Status === "number" && data.Status !== 0 && data.Status !== 3) return null;
    return {
      valeurs: (data.Answer ?? []).map((r) => (r.data ?? "").replace(/^"|"$/g, "")).filter(Boolean),
      dnssec: data.AD === true,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

/**
 * Le domaine existe-t-il dans le DNS ? `null` si le résolveur n'a pas répondu.
 * Sert à distinguer un site réellement hors ligne d'un site que nous n'arrivons pas à joindre.
 */
export async function resoutDomaine(
  url: string,
  options: OptionsCollecte,
): Promise<boolean | null> {
  const hote = domaine(url);
  if (!hote) return null;
  const enregistrements = await interrogeDns(hote, "A", options);
  if (enregistrements === null) return null;
  if (enregistrements.length) return true;
  // Certains domaines n'ont qu'un enregistrement de messagerie ou une délégation : on
  // vérifie l'apex en MX avant de conclure à l'inexistence.
  const mx = await interrogeDns(hote, "MX", options);
  return mx === null ? null : mx.length > 0;
}

/** Enregistrements DNS liés à l'usurpation d'email, via DNS-over-HTTPS Cloudflare. */
export async function collecteDns(
  url: string,
  options: OptionsCollecte,
): Promise<DonneesDns | null> {
  const hote = domaine(url);
  if (!hote) return null;
  const [txt, mx, dmarc] = await Promise.all([
    interrogeDnsComplet(hote, "TXT", options),
    interrogeDnsComplet(hote, "MX", options),
    interrogeDnsComplet(`_dmarc.${hote}`, "TXT", options),
  ]);

  // Le résolveur est totalement injoignable : l'audit le signalera comme non vérifié.
  if (txt === null && mx === null && dmarc === null) {
    throw new Error("résolveur DNS injoignable");
  }

  return {
    mx: { verifie: mx !== null, valeur: mx?.valeurs ?? [] },
    spf: { verifie: txt !== null, valeur: txt?.valeurs.find((t) => t.toLowerCase().startsWith("v=spf1")) ?? null },
    dmarc: {
      verifie: dmarc !== null,
      valeur: dmarc?.valeurs.find((t) => t.toLowerCase().startsWith("v=dmarc1")) ?? null,
    },
    // Le drapeau DNSSEC de la requête sur le domaine lui-même fait référence.
    dnssec: { verifie: txt !== null, valeur: txt?.dnssec ?? false },
  };
}

/** Analyse Lighthouse réelle via l'API PageSpeed Insights (gratuite, clé optionnelle). */
export async function collecteLighthouse(
  url: string,
  options: OptionsCollecte,
): Promise<ResultatLighthouse | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const params = new URLSearchParams({ url, strategy: "mobile" });
  for (const categorie of ["performance", "seo", "accessibility", "best-practices"]) {
    params.append("category", categorie);
  }
  if (options.clePageSpeed) params.set("key", options.clePageSpeed);

  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), 40_000);
  try {
    const res = await fetchImpl(`${PSI_ENDPOINT}?${params.toString()}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: controleur.signal,
    });
    if (!res.ok) throw new Error(`PageSpeed ${res.status}`);
    const data = (await res.json()) as {
      loadingExperience?: {
        metrics?: Record<string, { percentile?: number; category?: string }>;
        overall_category?: string;
      };
      lighthouseResult?: {
        categories?: Record<string, { score?: number | null }>;
        audits?: Record<string, {
          score?: number | null;
          numericValue?: number;
          scoreDisplayMode?: string;
          details?: { data?: string; items?: unknown[] };
        }>;
      };
    };
    const lr = data.lighthouseResult;
    if (!lr) throw new Error("Réponse PageSpeed inexploitable");

    const note = (cle: string) => {
      const brut = lr.categories?.[cle]?.score;
      return typeof brut === "number" ? Math.round(brut * 100) : null;
    };
    const audits = lr.audits ?? {};
    const valeur = (cle: string) =>
      typeof audits[cle]?.numericValue === "number" ? audits[cle].numericValue! : null;

    const retenus: ResultatLighthouse["audits"] = {};
    for (const cle of AUDITS_LIGHTHOUSE) {
      const audit = audits[cle];
      if (!audit) continue;
      const mode = audit.scoreDisplayMode ?? "";
      // Les audits « informatifs » ou non applicables ne constituent pas un défaut.
      const nonEvalue = mode === "notApplicable" || mode === "informative" || mode === "manual";
      retenus[cle] = {
        note: typeof audit.score === "number" ? audit.score : null,
        reussi: nonEvalue ? true : audit.score === null || audit.score === undefined ? true : audit.score >= 0.9,
      };
    }

    // Mesures terrain : présentes seulement si le site a assez de trafic réel.
    const terrainBrut = data.loadingExperience?.metrics;
    const percentile = (cle: string) => {
      const valeur = terrainBrut?.[cle]?.percentile;
      return typeof valeur === "number" ? valeur : null;
    };
    const clsBrut = percentile("CUMULATIVE_LAYOUT_SHIFT_SCORE");
    const brute = data.loadingExperience?.overall_category;
    const categorie: MesuresTerrain["categorie"] =
      brute === "FAST" || brute === "AVERAGE" || brute === "SLOW" ? brute : null;
    const terrain = terrainBrut && Object.keys(terrainBrut).length
      ? {
        lcpMs: percentile("LARGEST_CONTENTFUL_PAINT_MS"),
        inpMs: percentile("INTERACTION_TO_NEXT_PAINT"),
        // Le CLS terrain est renvoyé multiplié par cent.
        cls: clsBrut === null ? null : clsBrut / 100,
        categorie,
      }
      : null;

    return {
      performance: note("performance"),
      seo: note("seo"),
      accessibilite: note("accessibility"),
      bonnesPratiques: note("best-practices"),
      lcpMs: valeur("largest-contentful-paint"),
      cls: valeur("cumulative-layout-shift"),
      tbtMs: valeur("total-blocking-time"),
      octets: valeur("total-byte-weight"),
      requetes: audits["network-requests"]?.details?.items?.length ?? null,
      audits: retenus,
      terrain,
      captureDataUri: audits["final-screenshot"]?.details?.data ?? null,
    };
  } catch (erreur) {
    throw erreur instanceof Error ? erreur : new Error(String(erreur));
  } finally {
    clearTimeout(minuteur);
  }
}

/**
 * Sondage passif des fichiers publics de la liste `FICHIERS_SONDES` : une requête GET à la
 * fois, espacées, sans aucune tentative d'exploitation. Un fichier n'est signalé que s'il
 * répond 200 avec un contenu caractéristique — pas une page 404 déguisée.
 */
export async function sondeFichiers(
  url: string,
  options: OptionsCollecte,
  /** Contenu du robots.txt : les chemins qu'il interdit ne sont pas sondés. */
  robotsTxt?: string | null,
): Promise<FichierExpose[]> {
  const base = origine(url);
  if (!base) return [];
  const delai = options.delaiSondeMs ?? 300;
  const interdits = cheminsInterdits(robotsTxt);
  const exposes: FichierExpose[] = [];

  for (const { chemin, indice } of FICHIERS_SONDES) {
    if (expire(options.echeance)) break;
    if (!cheminAutorise(chemin, interdits)) continue;
    const reponse = await recupereHttp(`${base}${chemin}`, {
      fetchImpl: options.fetchImpl,
      timeoutMs: Math.min(options.timeoutMs ?? 5000, 5000),
      maxOctets: 20_000,
    });
    await pause(delai);
    if (!reponse || reponse.statut !== 200) continue;
    if (estFauxPositif(chemin, reponse)) continue;
    exposes.push({ chemin, statut: reponse.statut, indice });
  }
  return exposes;
}

/** Écarte les 200 renvoyés par une page d'erreur personnalisée ou une redirection SPA. */
function estFauxPositif(chemin: string, reponse: ReponseHttp): boolean {
  const contenu = reponse.html;
  const estHtml = /<html|<!doctype html/i.test(contenu);

  if (chemin === "/.git/HEAD") return !/^ref:\s/m.test(contenu);
  if (chemin === "/.env") return estHtml || !/=/.test(contenu);
  if (chemin === "/phpinfo.php") return !/phpinfo\(\)|PHP Version/i.test(contenu);
  if (chemin === "/server-status") return !/Server (uptime|Version)/i.test(contenu);
  if (chemin === "/wp-content/uploads/") return !/Index of|<title>Index/i.test(contenu);
  if (chemin === "/xmlrpc.php") return !/XML-RPC server accepts POST requests only/i.test(contenu);
  if (chemin === "/.DS_Store") return estHtml;
  if (chemin.endsWith(".bak") || chemin.endsWith(".zip")) return estHtml || contenu.length < 20;
  return false;
}

/**
 * Collecte tout ce qui est nécessaire aux règles d'audit.
 * Les appels lents (page interne, robots, sitemap, 404, DNS, Lighthouse) sont lancés
 * en parallèle une fois la page d'accueil récupérée.
 */
export async function collecte(url: string, options: OptionsCollecte = {}): Promise<ContexteAudit> {
  const erreurs: string[] = [];
  const anneeCourante = options.anneeCourante ?? new Date().getFullYear();

  // Renseignée par le callback d'échec ci-dessous (TypeScript ne suit pas l'affectation
  // faite dans une closure : on passe par un objet).
  const echec: { cause: CauseEchec | null } = { cause: null };
  const optionsAccueil = {
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs ?? 10_000,
    maxOctets: options.maxOctets ?? 500_000,
    onEchec: (cause: CauseEchec) => { echec.cause = cause; },
  };
  let accueil = await recupereHttp(url, optionsAccueil);
  // Deuxième tentative : un incident réseau isolé rendrait l'audit « non concluant » à tort,
  // et le prospect ressortirait comme non analysable alors que son site fonctionne.
  if (!accueil && !expire(options.echeance) && !echec.cause?.certificat) {
    await pause(500);
    accueil = await recupereHttp(url, { ...optionsAccueil, timeoutMs: (options.timeoutMs ?? 10_000) + 5000 });
  }

  // Certificat invalide : le site existe, mais tout visiteur voit un avertissement de sécurité
  // plein écran. On le constate, et on va lire le contenu en HTTP pour auditer quand même.
  const echecCertificat = echec.cause?.certificat ? echec.cause.message : null;
  if (!accueil && echecCertificat && url.startsWith("https://")) {
    accueil = await recupereHttp(url.replace(/^https:/, "http:"), {
      ...optionsAccueil,
      onEchec: undefined,
    });
  }

  // Une redirection peut mener ailleurs que l'hôte demandé : on refuse d'auditer (et donc
  // d'aller sonder) une arrivée sur le réseau interne.
  if (accueil && !options.autoriseHotesPrives && !hotePublic(new URL(accueil.urlFinale).hostname)) {
    erreurs.push(`Redirection vers un hôte non public : ${accueil.urlFinale}`);
    accueil = null;
  }

  const contexte: ContexteAudit = {
    url,
    accueil,
    accessibilite: "ok",
    resolutionDns: null,
    redirigeVersHttps: null,
    robots: null,
    sitemap: null,
    pageInterne: null,
    pagesContact: [],
    contacts: contactsVides(),
    wwwDuplique: null,
    erreurCertificat: echecCertificat,
    liens: null,
    imagesMesurees: null,
    archive: null,
    certificat: null,
    wordpress: null,
    securityTxt: null,
    page404: null,
    dns: null,
    lighthouse: null,
    fichiersExposes: null,
    anneeCourante,
    erreurs,
  };

  // ── Qualifier l'accès avant toute conclusion ─────────────────────────────
  // Un site qu'on ne voit pas n'est pas un site en panne : sans cette distinction, un
  // pare-feu applicatif ou un blocage réseau produirait un faux « site cassé » chez le prospect.
  if (accueil && estBlocageParPareFeu(accueil)) {
    contexte.accessibilite = "bloque";
    erreurs.push(
      `Accès refusé par une protection anti-robot (HTTP ${accueil.statut}) : le site n'a pas pu être analysé`,
    );
    contexte.accueil = null;
    return contexte;
  }

  if (!accueil) {
    contexte.resolutionDns = await resoutDomaine(url, options).catch(() => null);
    // Un certificat invalide est un défaut mesuré, pas une impossibilité d'analyser : le
    // serveur a répondu, c'est sa configuration TLS qui refuse la connexion.
    if (echecCertificat) {
      contexte.accessibilite = "erreur_serveur";
      erreurs.push(`Page non lue : ${echecCertificat}`);
      return contexte;
    }
    if (contexte.resolutionDns === false) {
      contexte.accessibilite = "injoignable";
      erreurs.push("Le domaine ne résout pas : site réellement hors ligne");
    } else {
      contexte.accessibilite = "bloque";
      erreurs.push(
        contexte.resolutionDns === true
          ? "Le domaine existe mais le site n'a pas répondu : analyse impossible depuis notre réseau"
          : "Site et résolveur DNS injoignables : analyse impossible depuis notre réseau",
      );
    }
    return contexte;
  }

  if (accueil.statut >= 400) {
    contexte.accessibilite = "erreur_serveur";
  }

  const urlEffective = accueil.urlFinale;
  const taches: Array<[string, Promise<unknown>]> = [
    ["robots.txt", collecteRobots(urlEffective, options)],
    ["page interne", collectePageInterne(accueil, options)],
    ["page 404", collecte404(urlEffective, options)],
    ["DNS", collecteDns(urlEffective, options)],
  ];
  if (urlEffective.startsWith("https://")) {
    taches.push(["redirection HTTPS", verifieRedirectionHttps(urlEffective, options)]);
  }
  taches.push(["duplication www", verifieDuplicationWww(accueil, options)]);
  if (urlEffective.startsWith("https://")) {
    taches.push(["certificat TLS", litCertificat(urlEffective, { lecteur: options.lecteurCertificat })]);
  }
  if (options.avecLighthouse) {
    taches.push(["Lighthouse (PageSpeed)", collecteLighthouse(urlEffective, options)]);
  }
  if (options.avecArchive ?? options.avecLighthouse) {
    taches.push(["Internet Archive", collecteArchive(urlEffective, options)]);
  }

  const resultats = await Promise.allSettled(taches.map(([, promesse]) => promesse));
  resultats.forEach((resultat, i) => {
    const nom = taches[i][0];
    if (resultat.status === "rejected") {
      erreurs.push(`${nom} : ${resultat.reason instanceof Error ? resultat.reason.message : "échec"}`);
      return;
    }
    switch (nom) {
      case "robots.txt":
        contexte.robots = resultat.value as ContexteAudit["robots"];
        break;
      case "page interne":
        contexte.pageInterne = resultat.value as ReponseHttp | null;
        break;
      case "page 404":
        contexte.page404 = resultat.value as ContexteAudit["page404"];
        break;
      case "DNS":
        contexte.dns = resultat.value as DonneesDns | null;
        break;
      case "redirection HTTPS":
        contexte.redirigeVersHttps = resultat.value as boolean | null;
        break;
      case "duplication www":
        contexte.wwwDuplique = resultat.value as boolean | null;
        break;
      case "Lighthouse (PageSpeed)":
        contexte.lighthouse = resultat.value as ResultatLighthouse | null;
        break;
      case "Internet Archive":
        contexte.archive = resultat.value as ContexteAudit["archive"];
        break;
      case "certificat TLS":
        contexte.certificat = resultat.value as ContexteAudit["certificat"];
        break;
    }
  });

  // ── Coordonnées : accueil, page interne, puis pages de contact ───────────
  // C'est ce qui permet de démarcher : sans email ni téléphone, l'audit ne sert à rien.
  if (!expire(options.echeance)) {
    try {
      contexte.pagesContact = await collectePagesContact(
        accueil,
        options,
        [accueil.urlFinale, contexte.pageInterne?.urlFinale].filter(Boolean) as string[],
        contexte.robots?.contenu,
      );
    } catch {
      erreurs.push("Pages de contact : échec de lecture");
    }
  }
  contexte.contacts = agregeContacts(
    [accueil, contexte.pageInterne, ...contexte.pagesContact],
    domaine(urlEffective),
  );

  // Le sitemap dépend du robots.txt, la sonde est séquentielle : après le lot parallèle.
  if (!expire(options.echeance)) {
    try {
      contexte.sitemap = await collecteSitemap(urlEffective, contexte.robots, options);
    } catch {
      erreurs.push("sitemap.xml : échec de lecture");
    }
  }
  if (options.avecSonde && !expire(options.echeance)) {
    try {
      contexte.fichiersExposes = await sondeFichiers(urlEffective, options, contexte.robots?.contenu);
    } catch {
      erreurs.push("Sondage des fichiers publics interrompu");
    }
  }

  // security.txt : un simple GET d'un chemin normalisé, une fois par audit.
  if (options.avecSonde && !expire(options.echeance)) {
    const base = origine(urlEffective);
    if (base) {
      const rep = await recupereHttp(`${base}/.well-known/security.txt`, {
        fetchImpl: options.fetchImpl, timeoutMs: Math.min(options.timeoutMs ?? 5000, 5000), maxOctets: 4_000,
      });
      contexte.securityTxt = Boolean(rep && rep.statut === 200 && /contact:/i.test(rep.html));
    }
  }

  // Points d'entrée WordPress : seulement si c'est un WordPress, et seulement avec le sondage.
  if (options.avecSonde && !expire(options.echeance) && technologie(accueil.html, accueil.entetes) === "WordPress") {
    try {
      contexte.wordpress = await sondeWordpress(urlEffective, options, contexte.robots?.contenu);
    } catch {
      erreurs.push("Vérification des points d'entrée WordPress interrompue");
    }
  }

  // Liens et images : une requête à la fois, espacées — on reste un visiteur poli.
  if ((options.avecLiens ?? options.avecSonde) && !expire(options.echeance)) {
    try {
      contexte.liens = await verifieLiens(accueil, options);
    } catch {
      erreurs.push("Vérification des liens interrompue");
    }
  }
  if ((options.avecImages ?? options.avecSonde) && !expire(options.echeance)) {
    try {
      contexte.imagesMesurees = await mesureImages(accueil, options);
    } catch {
      erreurs.push("Mesure du poids des images interrompue");
    }
  }

  return contexte;
}
