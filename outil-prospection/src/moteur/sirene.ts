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

  const prospects: Prospect[] = [];
  const ecartes: Prospect[] = [];
  const sirensVus = new Set<string>();
  let totalDisponible = 0;
  let pagesParcourues = 0;
  let analysees = 0;
  let tronque = false;

  for (let page = 1; page <= pagesDemandees; page++) {
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

    options.onPage?.(page, totalDisponible);

    // Objectif atteint : inutile de solliciter l'API davantage.
    if (options.objectif && prospects.length >= options.objectif) break;

    const pagesRestantes = (data.total_pages ?? 0) > page;
    if (!pagesRestantes) break;
    if (page === pagesDemandees) {
      // Il restait des pages mais le budget est épuisé : on le dit plutôt que de laisser
      // croire que la base ne contient rien de plus.
      tronque = Boolean(options.objectif && prospects.length < options.objectif);
      break;
    }
    await pause(delai);
  }

  return { prospects, ecartes, totalDisponible, analysees, pagesParcourues, tronque };
}
