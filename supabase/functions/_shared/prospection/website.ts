// Détection et audit du site web d'une entreprise.
// Fonctionne sans clé d'API : les domaines probables sont dérivés de la raison sociale
// puis vérifiés (le contenu doit mentionner l'entreprise) avant d'être audités.

import {
  analyseHtml,
  candidatsDomaines,
  domaineCorrespond,
  estPageParking,
  extraitContacts,
  statutDepuisScoreSite,
} from "./core.ts";
import type { AuditSite, Prospect } from "./types.ts";

export interface OptionsAudit {
  fetchImpl?: typeof fetch;
  /** Timeout par requête HTTP. */
  timeoutMs?: number;
  /** Taille maximale de HTML téléchargée par page. */
  maxOctets?: number;
  /** Nombre de domaines candidats testés par entreprise. */
  maxCandidats?: number;
}

interface Reponse {
  urlFinale: string;
  statut: number;
  html: string;
  dureeMs: number;
  octets: number;
}

const auditVide = (): AuditSite => ({
  url: null,
  statut: "aucun_site",
  score: 100,
  signaux: ["Aucun site web détecté pour cette entreprise"],
  emailContact: null,
  telephone: null,
  verifieLe: new Date().toISOString(),
});

/** Lit le corps de la réponse en s'arrêtant à `maxOctets` (évite de rapatrier 50 Mo). */
async function litTexteLimite(res: Response, maxOctets: number): Promise<{ texte: string; octets: number }> {
  if (!res.body) {
    const texte = await res.text();
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

async function recupere(
  url: string,
  options: Required<Pick<OptionsAudit, "fetchImpl" | "timeoutMs" | "maxOctets">>,
): Promise<Reponse | null> {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), options.timeoutMs);
  const debut = Date.now();
  try {
    const res = await options.fetchImpl(url, {
      redirect: "follow",
      signal: controleur.signal,
      headers: {
        // Certains hébergeurs anciens renvoient 403 sans User-Agent de navigateur.
        "User-Agent":
          "Mozilla/5.0 (compatible; FideliProProspection/1.0; +https://fidelipro.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const typeContenu = res.headers.get("content-type") ?? "";
    if (res.ok && typeContenu && !typeContenu.includes("html")) return null;
    const { texte, octets } = await litTexteLimite(res, options.maxOctets);
    return {
      urlFinale: res.url || url,
      statut: res.status,
      html: texte,
      dureeMs: Date.now() - debut,
      octets,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

/** Audite une URL connue et retourne son état commercial. */
export async function auditeUrl(
  url: string,
  options: OptionsAudit = {},
): Promise<AuditSite> {
  const config = {
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? 8000,
    maxOctets: options.maxOctets ?? 500_000,
  };
  const reponse = await recupere(url, config);
  const verifieLe = new Date().toISOString();

  if (!reponse) {
    return {
      url,
      statut: "site_injoignable",
      score: 90,
      signaux: ["Site injoignable (domaine expiré, hébergement en panne ou trop lent)"],
      emailContact: null,
      telephone: null,
      verifieLe,
    };
  }

  const { score, signaux } = analyseHtml(reponse.html, {
    urlFinale: reponse.urlFinale,
    statutHttp: reponse.statut,
    dureeMs: reponse.dureeMs,
    octets: reponse.octets,
  });
  const contacts = extraitContacts(reponse.html);

  return {
    url: reponse.urlFinale,
    statut: statutDepuisScoreSite(score),
    score,
    signaux,
    emailContact: contacts.email,
    telephone: contacts.telephone,
    verifieLe,
  };
}

/**
 * Cherche le site d'une entreprise parmi les domaines probables, puis l'audite.
 * Un domaine n'est retenu que si la page mentionne l'entreprise et n'est pas une page parking.
 */
export async function detecteEtAuditeSite(
  nom: string,
  enseigne: string | null,
  options: OptionsAudit = {},
): Promise<AuditSite> {
  const config = {
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? 8000,
    maxOctets: options.maxOctets ?? 500_000,
  };
  const candidats = candidatsDomaines(nom, enseigne, options.maxCandidats ?? 4);
  const verifieLe = new Date().toISOString();

  for (const domaine of candidats) {
    const reponse =
      (await recupere(`https://${domaine}`, config)) ?? (await recupere(`http://${domaine}`, config));
    if (!reponse) continue;
    if (reponse.statut >= 400) continue;
    if (estPageParking(reponse.html)) continue;
    if (!domaineCorrespond(reponse.html, nom, enseigne)) continue;

    const { score, signaux } = analyseHtml(reponse.html, {
      urlFinale: reponse.urlFinale,
      statutHttp: reponse.statut,
      dureeMs: reponse.dureeMs,
      octets: reponse.octets,
    });
    const contacts = extraitContacts(reponse.html);

    return {
      url: reponse.urlFinale,
      statut: statutDepuisScoreSite(score),
      score,
      signaux,
      emailContact: contacts.email,
      telephone: contacts.telephone,
      verifieLe,
    };
  }

  return auditVide();
}

/** Exécute `traitement` sur chaque élément avec une concurrence bornée et une échéance. */
export async function enParallele<T, R>(
  elements: T[],
  limite: number,
  traitement: (element: T) => Promise<R>,
  echeance?: number,
): Promise<Array<R | null>> {
  const resultats: Array<R | null> = new Array(elements.length).fill(null);
  let index = 0;

  const ouvrier = async () => {
    while (index < elements.length) {
      const courant = index++;
      if (echeance && Date.now() > echeance) return;
      try {
        resultats[courant] = await traitement(elements[courant]);
      } catch {
        resultats[courant] = null;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, Math.min(limite, elements.length)) }, ouvrier));
  return resultats;
}

/** Audite une liste de prospects (détection de site incluse) avec concurrence bornée. */
export async function auditeProspects(
  prospects: Prospect[],
  options: OptionsAudit & { concurrence?: number; echeance?: number } = {},
): Promise<Array<AuditSite | null>> {
  return enParallele(
    prospects,
    options.concurrence ?? 4,
    (prospect) => detecteEtAuditeSite(prospect.nom, prospect.enseigne, options),
    options.echeance,
  );
}
