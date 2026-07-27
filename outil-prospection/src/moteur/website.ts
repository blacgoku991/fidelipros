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
import { recupereHttp, type OptionsHttp } from "./audit/http.ts";
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

const auditVide = (): AuditSite => ({
  url: null,
  statut: "aucun_site",
  score: 100,
  signaux: ["Aucun site web détecté pour cette entreprise"],
  emailContact: null,
  telephone: null,
  verifieLe: new Date().toISOString(),
});

/** Récupère une page en écartant les réponses qui ne sont pas du HTML. */
async function recupereHtml(url: string, options: OptionsHttp) {
  const reponse = await recupereHttp(url, options);
  if (!reponse) return null;
  const typeContenu = reponse.entetes["content-type"] ?? "";
  if (reponse.statut < 400 && typeContenu && !typeContenu.includes("html")) return null;
  return reponse;
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
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs ?? 8000,
    maxOctets: options.maxOctets ?? 500_000,
  };
  const candidats = candidatsDomaines(nom, enseigne, options.maxCandidats ?? 4);
  const verifieLe = new Date().toISOString();

  for (const domaine of candidats) {
    const reponse =
      (await recupereHtml(`https://${domaine}`, config)) ??
      (await recupereHtml(`http://${domaine}`, config));
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
async function enParallele<T, R>(
  elements: T[],
  limite: number,
  traitement: (element: T) => Promise<R>,
  echeance?: number,
  /** Appelé après chaque élément traité : sert à afficher l'avancement. */
  onProgres?: (faits: number, total: number) => void,
): Promise<Array<R | null>> {
  const resultats: Array<R | null> = new Array(elements.length).fill(null);
  let index = 0;
  let faits = 0;

  const ouvrier = async () => {
    while (index < elements.length) {
      const courant = index++;
      if (echeance && Date.now() > echeance) return;
      try {
        resultats[courant] = await traitement(elements[courant]);
      } catch {
        resultats[courant] = null;
      }
      onProgres?.(++faits, elements.length);
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, Math.min(limite, elements.length)) }, ouvrier));
  return resultats;
}

/** Audite une liste de prospects (détection de site incluse) avec concurrence bornée. */
export async function auditeProspects(
  prospects: Prospect[],
  options: OptionsAudit & {
    concurrence?: number;
    echeance?: number;
    onProgres?: (faits: number, total: number) => void;
  } = {},
): Promise<Array<AuditSite | null>> {
  return enParallele(
    prospects,
    options.concurrence ?? 4,
    (prospect) => detecteEtAuditeSite(prospect.nom, prospect.enseigne, options),
    options.echeance,
    options.onProgres,
  );
}
