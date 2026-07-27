// Couche HTTP unique du module de prospection (détection de site et audits).
// Portable Deno / Node : uniquement fetch, AbortController et les flux web standards.

import type { ReponseHttp } from "./types.ts";

export interface OptionsHttp {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxOctets?: number;
  methode?: "GET" | "HEAD";
  /** Appelé quand la requête échoue, avec la cause (code Node ou message). */
  onEchec?: (cause: CauseEchec) => void;
}

/** Pourquoi une requête n'a pas abouti : ce qui distingue un site cassé d'un site injoignable. */
export interface CauseEchec {
  code: string;
  message: string;
  /** Erreur de certificat TLS : le navigateur d'un visiteur afficherait un avertissement. */
  certificat: boolean;
}

/**
 * Codes TLS renvoyés par Node quand la poignée de main échoue. Un certificat expiré n'est pas
 * un site injoignable : c'est un site que les visiteurs voient barré d'un avertissement rouge.
 */
const CODES_CERTIFICAT: Record<string, string> = {
  CERT_HAS_EXPIRED: "certificat expiré",
  ERR_TLS_CERT_ALTNAME_INVALID: "certificat délivré pour un autre domaine",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "autorité de certification inconnue",
  DEPTH_ZERO_SELF_SIGNED_CERT: "certificat auto-signé",
  SELF_SIGNED_CERT_IN_CHAIN: "certificat auto-signé dans la chaîne",
  CERT_NOT_YET_VALID: "certificat pas encore valide",
  ERR_SSL_WRONG_VERSION_NUMBER: "réponse non chiffrée sur le port HTTPS",
  ERR_TLS_HANDSHAKE_TIMEOUT: "poignée de main TLS interrompue",
};

/** Traduit une erreur de fetch en cause exploitable par les règles. */
export function causeEchec(erreur: unknown): CauseEchec {
  const cause = (erreur as { cause?: { code?: string; message?: string } } | undefined)?.cause;
  const code = String(cause?.code ?? (erreur as { code?: string } | undefined)?.code ?? "");
  const message = cause?.message ?? (erreur instanceof Error ? erreur.message : String(erreur));
  const libelle = CODES_CERTIFICAT[code];
  return { code: code || "ECHEC", message: libelle ?? message, certificat: Boolean(libelle) };
}

export const USER_AGENT =
  "Mozilla/5.0 (compatible; FideliProProspection/1.0; +https://fidelipro.com)";

/** Lit le corps de la réponse en s'arrêtant à `maxOctets` (évite de rapatrier 50 Mo). */
export async function litTexteLimite(
  res: Response,
  maxOctets: number,
): Promise<{ texte: string; octets: number }> {
  if (!res.body) {
    const texte = await res.text().catch(() => "");
    return { texte: texte.slice(0, maxOctets), octets: texte.length };
  }
  const reader = res.body.getReader();
  const decodeur = new TextDecoder("utf-8", { fatal: false });
  let texte = "";
  let octets = 0;
  try {
    while (octets < maxOctets) {
      const { done, value } = await reader.read();
      if (done) break;
      octets += value.byteLength;
      texte += decodeur.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return { texte, octets };
}

const ENTETES_UTILES = [
  "content-type", "content-encoding", "content-length", "server", "x-powered-by",
  "strict-transport-security", "content-security-policy", "x-frame-options",
  "x-content-type-options", "referrer-policy", "permissions-policy", "cache-control",
  "alt-svc", "location", "set-cookie",
];

function entetesEnMinuscules(res: Response): Record<string, string> {
  const entetes: Record<string, string> = {};
  if (typeof res.headers?.forEach === "function") {
    res.headers.forEach((valeur, cle) => {
      entetes[cle.toLowerCase()] = valeur;
    });
    return entetes;
  }
  // Réponse non standard (tests, implémentations partielles) : on interroge les en-têtes utiles.
  for (const cle of ENTETES_UTILES) {
    const valeur = res.headers?.get?.(cle);
    if (valeur) entetes[cle] = valeur;
  }
  return entetes;
}

function cookies(res: Response): string[] {
  const avecGetSetCookie = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof avecGetSetCookie.getSetCookie === "function") {
    return avecGetSetCookie.getSetCookie();
  }
  const brut = res.headers.get("set-cookie");
  return brut ? [brut] : [];
}

/**
 * Récupère une URL et normalise la réponse. Retourne null en cas d'échec réseau,
 * de timeout ou de certificat invalide : l'appelant décide quoi en conclure.
 */
export async function recupereHttp(
  url: string,
  options: OptionsHttp = {},
): Promise<ReponseHttp | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxOctets = options.maxOctets ?? 500_000;
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), timeoutMs);
  const debut = Date.now();

  try {
    const res = await fetchImpl(url, {
      method: options.methode ?? "GET",
      redirect: "follow",
      signal: controleur.signal,
      headers: {
        // Certains hébergeurs anciens renvoient 403 sans User-Agent de navigateur.
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
    });
    const { texte, octets } = options.methode === "HEAD"
      ? { texte: "", octets: 0 }
      : await litTexteLimite(res, maxOctets);

    return {
      url,
      urlFinale: res.url || url,
      statut: res.status,
      html: texte,
      entetes: entetesEnMinuscules(res),
      cookies: cookies(res),
      dureeMs: Date.now() - debut,
      octets,
    };
  } catch (erreur) {
    options.onEchec?.(causeEchec(erreur));
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

/** Origine (schéma + hôte) d'une URL, ou null si l'URL est invalide. */
export function origine(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Nom d'hôte sans `www.`, ou null si l'URL est invalide. */
export function domaine(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Nom présentable déduit d'un domaine : « garage-martin.fr » → « Garage Martin ».
 * Utilisé quand on audite une URL sans connaître la raison sociale.
 */
export function nomDepuisDomaine(hote: string): string {
  const racine = hote.replace(/^www\./, "").split(".")[0];
  const mots = racine.split(/[-_]+/).filter(Boolean);
  if (!mots.length) return hote;
  return mots.map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1)).join(" ");
}

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
