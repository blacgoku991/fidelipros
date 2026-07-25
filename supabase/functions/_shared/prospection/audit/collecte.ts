// Collecte des données d'audit d'un site.
//
// Règle de conception : chaque collecteur est indépendant et ne peut jamais faire échouer
// l'audit. Un échec ajoute une ligne dans `erreurs` et laisse la donnée à `null` — les
// règles savent traiter l'absence d'information sans inventer de défaut.

import { liens } from "./html.ts";
import { domaine, origine, pause, recupereHttp, USER_AGENT } from "./http.ts";
import type {
  ContexteAudit,
  DonneesDns,
  FichierExpose,
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
  delaiSondeMs?: number;
  /** Timestamp (ms) au-delà duquel on arrête de collecter. */
  echeance?: number;
  anneeCourante?: number;
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
  { chemin: "/xmlrpc.php", indice: "Point d'entrée WordPress utilisé pour les attaques par force brute" },
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

/** Normalise une saisie utilisateur en URL absolue. */
export function normaliseUrl(saisie: string): string | null {
  const propre = saisie.trim();
  if (!propre) return null;
  const avecSchema = /^https?:\/\//i.test(propre) ? propre : `https://${propre}`;
  try {
    const url = new URL(avecSchema);
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
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
    return await recupereHttp(absolue.toString(), {
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs ?? 8000,
      maxOctets: options.maxOctets ?? 500_000,
    });
  }
  return null;
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

/** Enregistrements DNS liés à l'usurpation d'email, via DNS-over-HTTPS Cloudflare. */
export async function collecteDns(
  url: string,
  options: OptionsCollecte,
): Promise<DonneesDns | null> {
  const hote = domaine(url);
  if (!hote) return null;
  const fetchImpl = options.fetchImpl ?? fetch;

  // null = la requête n'a pas abouti (à ne pas confondre avec « aucun enregistrement »),
  // sinon les règles conclueraient à tort à l'absence de SPF/DMARC.
  const interroge = async (nom: string, type: "TXT" | "MX"): Promise<string[] | null> => {
    const controleur = new AbortController();
    const minuteur = setTimeout(() => controleur.abort(), options.timeoutMs ?? 8000);
    try {
      const res = await fetchImpl(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(nom)}&type=${type}`,
        { headers: { Accept: "application/dns-json", "User-Agent": USER_AGENT }, signal: controleur.signal },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { Status?: number; Answer?: Array<{ data?: string }> };
      // Status 0 = réponse valide, 3 = domaine sans cet enregistrement : les deux sont exploitables.
      if (typeof data.Status === "number" && data.Status !== 0 && data.Status !== 3) return null;
      return (data.Answer ?? []).map((r) => (r.data ?? "").replace(/^"|"$/g, "")).filter(Boolean);
    } catch {
      return null;
    } finally {
      clearTimeout(minuteur);
    }
  };

  const [txt, mx, dmarc] = await Promise.all([
    interroge(hote, "TXT"),
    interroge(hote, "MX"),
    interroge(`_dmarc.${hote}`, "TXT"),
  ]);

  // Le résolveur est totalement injoignable : l'audit le signalera comme non vérifié.
  if (txt === null && mx === null && dmarc === null) {
    throw new Error("résolveur DNS injoignable");
  }

  return {
    mx: { verifie: mx !== null, valeur: mx ?? [] },
    spf: { verifie: txt !== null, valeur: txt?.find((t) => t.toLowerCase().startsWith("v=spf1")) ?? null },
    dmarc: {
      verifie: dmarc !== null,
      valeur: dmarc?.find((t) => t.toLowerCase().startsWith("v=dmarc1")) ?? null,
    },
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
): Promise<FichierExpose[]> {
  const base = origine(url);
  if (!base) return [];
  const delai = options.delaiSondeMs ?? 300;
  const exposes: FichierExpose[] = [];

  for (const { chemin, indice } of FICHIERS_SONDES) {
    if (expire(options.echeance)) break;
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

  const accueil = await recupereHttp(url, {
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs ?? 10_000,
    maxOctets: options.maxOctets ?? 500_000,
  });
  if (!accueil) erreurs.push("Page d'accueil injoignable");

  const contexte: ContexteAudit = {
    url,
    accueil,
    redirigeVersHttps: null,
    robots: null,
    sitemap: null,
    pageInterne: null,
    page404: null,
    dns: null,
    lighthouse: null,
    fichiersExposes: null,
    anneeCourante,
    erreurs,
  };
  if (!accueil) return contexte;

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
  if (options.avecLighthouse) {
    taches.push(["Lighthouse (PageSpeed)", collecteLighthouse(urlEffective, options)]);
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
      case "Lighthouse (PageSpeed)":
        contexte.lighthouse = resultat.value as ResultatLighthouse | null;
        break;
    }
  });

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
      contexte.fichiersExposes = await sondeFichiers(urlEffective, options);
    } catch {
      erreurs.push("Sondage des fichiers publics interrompu");
    }
  }

  return contexte;
}
