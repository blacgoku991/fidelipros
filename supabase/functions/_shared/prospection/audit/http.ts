// Couche HTTP unique du module de prospection (détection de site et audits).
// Portable Deno / Node : uniquement fetch, AbortController et les flux web standards.

import type { ReponseHttp } from "./types.ts";

export interface OptionsHttp {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxOctets?: number;
  methode?: "GET" | "HEAD";
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
  } catch {
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

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
