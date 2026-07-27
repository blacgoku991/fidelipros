// Client de l'API publique « Recherche d'entreprises » (annuaire-entreprises.data.gouv.fr).
// Données Sirene en open data : aucune clé d'API, limite de 7 requêtes/seconde.
// Documentation : https://recherche-entreprises.api.gouv.fr/docs/

import {
  API_RECHERCHE_ENTREPRISES,
  MAX_PAGES,
  construireParamsRecherche,
  filtresValides,
  mapEntreprise,
} from "./core.ts";
import type { EntrepriseApi, Prospect, ProspectionFilters } from "./types.ts";

export interface OptionsRecherche {
  /** Implémentation de fetch (injectable pour les tests). */
  fetchImpl?: typeof fetch;
  /**
   * Critère de conformité appliqué à chaque entreprise reçue.
   * L'API n'applique pas tous les filtres demandés (la date de création, notamment, n'est pas
   * toujours prise en compte) : on continue donc de tourner les pages jusqu'à réunir le nombre
   * de prospects conformes visé, au lieu de rendre une page filtrée à zéro.
   */
  retenir?: (prospect: Prospect) => boolean;
  /** Nombre de prospects conformes visés. La pagination s'arrête dès qu'il est atteint. */
  objectif?: number;
  /**
   * Plafond de pages quand l'objectif n'est pas atteint.
   *
   * L'API classe par pertinence, pas par date : sur une recherche « créées il y a moins de
   * 2 mois », les grosses entreprises anciennes sortent en premier et les jeunes en dernier.
   * S'arrêter à `filters.pages` revient alors à conclure « rien » après n'avoir vu que le haut
   * du classement. Tant que l'objectif n'est pas atteint, on continue donc jusqu'à ce plafond
   * (ou jusqu'à l'échéance, qui reste la vraie limite).
   */
  pagesMax?: number;
  /** Pause entre deux pages, pour rester sous la limite de 7 req/s. */
  delaiEntrePagesMs?: number;
  /** Timestamp (ms) au-delà duquel on arrête de paginer. */
  echeance?: number;
  /** Callback de progression, appelé après chaque page. */
  onPage?: (page: number, total: number) => void;
  /** Point d'entrée de l'API (miroir ou instance locale pour les tests). */
  endpoint?: string;
}

export interface ResultatRecherche {
  /** Entreprises conformes aux critères (ou toutes, si aucun critère n'est passé). */
  prospects: Prospect[];
  /** Entreprises reçues de l'API mais écartées par la vérification locale. */
  ecartes: Prospect[];
  /** Nombre total d'entreprises correspondant aux filtres côté API. */
  totalDisponible: number;
  /** Nombre d'entreprises effectivement examinées. */
  analysees: number;
  pagesParcourues: number;
  /** Vrai si la pagination a été interrompue (échéance ou budget de pages atteint). */
  tronque: boolean;
  /**
   * L'API a-t-elle réellement appliqué le filtre de date demandé ?
   *
   * `null` quand aucune date n'était demandée. Sinon, mesuré sur la première page : si les
   * entreprises reçues sont pour la plupart hors de la fenêtre, c'est que l'API a ignoré le
   * critère et qu'il faut le vérifier localement — l'information vaut d'être remontée, sans
   * quoi un « 0 retenu » ressemble à « la base est vide ».
   */
  filtreDateApplique: boolean | null;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function appelApi(
  params: Record<string, string>,
  fetchImpl: typeof fetch,
  tentative = 0,
  endpoint = API_RECHERCHE_ENTREPRISES,
): Promise<{ results?: EntrepriseApi[]; total_results?: number; total_pages?: number }> {
  const url = `${endpoint}?${new URLSearchParams(params).toString()}`;
  const res = await fetchImpl(url, {
    headers: { Accept: "application/json", "User-Agent": "FideliPro-Prospection/1.0" },
  });

  // 429 : quota dépassé → backoff exponentiel (3 tentatives max).
  if (res.status === 429 && tentative < 3) {
    await pause(1000 * 2 ** tentative);
    return appelApi(params, fetchImpl, tentative + 1, endpoint);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`API Recherche d'entreprises ${res.status} : ${detail.slice(0, 200)}`);
  }
  return await res.json();
}

/**
 * Parcourt les pages de résultats et retourne les entreprises normalisées.
 * Les doublons de SIREN entre pages sont écartés.
 */
export async function rechercheEntreprises(
  filters: ProspectionFilters,
  options: OptionsRecherche = {},
): Promise<ResultatRecherche> {
  if (!filtresValides(filters)) {
    throw new Error(
      "Filtres insuffisants : précisez au moins une recherche, un département, un code postal ou un secteur.",
    );
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const delai = options.delaiEntrePagesMs ?? 250;
  const pagesDemandees = Math.min(MAX_PAGES, Math.max(1, filters.pages ?? 2));
  // Le plafond ne s'applique que tant que l'objectif n'est pas atteint : une recherche qui
  // trouve son compte s'arrête toujours à la première page suffisante.
  const plafond = Math.max(pagesDemandees, options.pagesMax ?? pagesDemandees);

  const prospects: Prospect[] = [];
  const ecartes: Prospect[] = [];
  const sirensVus = new Set<string>();
  let totalDisponible = 0;
  let pagesParcourues = 0;
  let analysees = 0;
  let tronque = false;
  let filtreDateApplique: boolean | null = null;

  for (let page = 1; page <= plafond; page++) {
    if (options.echeance && Date.now() > options.echeance) {
      tronque = true;
      break;
    }

    const data = await appelApi(construireParamsRecherche(filters, page), fetchImpl, 0, options.endpoint);
    totalDisponible = data.total_results ?? totalDisponible;
    pagesParcourues = page;

    for (const brute of data.results ?? []) {
      const prospect = mapEntreprise(brute);
      if (!prospect || sirensVus.has(prospect.siren)) continue;
      sirensVus.add(prospect.siren);
      analysees++;
      if (options.retenir && !options.retenir(prospect)) ecartes.push(prospect);
      else prospects.push(prospect);
    }

    // Mesure sur la première page : l'API a-t-elle honoré la fenêtre de dates demandée ?
    if (page === 1 && (filters.creeApres || filters.creeAvant)) {
      const recues = (data.results ?? []).map(mapEntreprise).filter(Boolean) as Prospect[];
      const datees = recues.filter((p) => p.date_creation);
      const dedans = datees.filter((p) =>
        (!filters.creeApres || p.date_creation! >= filters.creeApres) &&
        (!filters.creeAvant || p.date_creation! <= filters.creeAvant));
      // Une page entièrement hors fenêtre ne peut pas être le fruit du hasard : le critère
      // n'a pas été appliqué côté API. En dessous de 5 entreprises datées, on ne conclut pas.
      filtreDateApplique = datees.length >= 5 ? dedans.length > datees.length / 2 : null;
    }

    options.onPage?.(page, totalDisponible);

    // Objectif atteint : inutile de solliciter l'API davantage.
    if (options.objectif && prospects.length >= options.objectif) break;

    const pagesRestantes = (data.total_pages ?? 0) > page;
    if (!pagesRestantes) break;

    // Le budget nominal est épuisé : on ne continue que si l'objectif reste manqué — et
    // seulement jusqu'au plafond, l'échéance restant la vraie limite.
    const objectifManque = Boolean(options.objectif && prospects.length < options.objectif);
    if (page >= pagesDemandees && !objectifManque) break;
    if (page >= plafond) {
      tronque = objectifManque;
      break;
    }
    await pause(delai);
  }

  return {
    prospects, ecartes, totalDisponible, analysees, pagesParcourues, tronque, filtreDateApplique,
  };
}
