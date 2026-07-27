// Client de l'API Google Places (Text Search « New »).
//
// C'est la source officielle des fiches Google : nom, adresse, téléphone, site web et lien
// vers la fiche — exactement ce qu'affiche Google Maps, mais servi par une API prévue pour ça
// plutôt qu'extrait de la page (ce que les conditions d'utilisation interdisent et que Google
// bloque activement).
//
// Elle demande une clé `GOOGLE_MAPS_API_KEY`. La création de la clé impose d'ouvrir un compte
// de facturation chez Google, même si l'usage reste dans le crédit mensuel offert : c'est la
// seule source de cet outil dans ce cas, et elle reste donc facultative.
//
// Deux limites imposées par l'API, qu'il vaut mieux connaître que découvrir :
//   - 20 résultats par page, 60 au maximum par requête. « Plombier en Île-de-France » ne rendra
//     jamais tous les plombiers de la région : il faut découper par ville.
//   - les données renvoyées ne doivent pas être conservées indéfiniment (30 jours), à
//     l'exception de l'identifiant de fiche.

import process from "node:process";

import type { Prospect } from "./types.ts";

// `PLACES_URL` permet de viser une instance locale pour les tests de bout en bout.
const API_PLACES = process.env.PLACES_URL || "https://places.googleapis.com/v1/places:searchText";

/** Champs demandés. Le masque est obligatoire et conditionne la facturation : on ne prend que l'utile. */
const CHAMPS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.businessStatus",
  "places.primaryTypeDisplayName",
  "places.location",
  "nextPageToken",
].join(",");

export interface EtablissementPlaces {
  placeId: string;
  nom: string;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  telephone: string | null;
  siteWeb: string | null;
  /** Lien vers la fiche Google réellement publiée : jamais une recherche devinée. */
  ficheGoogle: string | null;
  categorie: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface OptionsPlaces {
  cle: string;
  fetchImpl?: typeof fetch;
  /** Nombre de pages de 20 résultats (Google en autorise 3 au maximum). */
  pages?: number;
  /** Ne garder que les établissements sans site web déclaré. */
  sansSiteSeulement?: boolean;
  endpoint?: string;
  langue?: string;
  onPage?: (page: number, cumul: number) => void;
}

interface ReponsePlaces {
  places?: Array<Record<string, unknown>>;
  nextPageToken?: string;
  error?: { message?: string; status?: string };
}

/**
 * Extrait le code postal et la ville d'une adresse française formatée par Google
 * (« 12 Rue de Paris, 92600 Asnières-sur-Seine, France »).
 */
export function decoupeAdresse(adresse: string | null): { codePostal: string | null; ville: string | null } {
  if (!adresse) return { codePostal: null, ville: null };
  const trouve = /\b(\d{5})\s+([^,]+)/.exec(adresse);
  return trouve
    ? { codePostal: trouve[1], ville: trouve[2].trim() }
    : { codePostal: null, ville: null };
}

function texteOuNull(valeur: unknown): string | null {
  return typeof valeur === "string" && valeur.trim() ? valeur.trim() : null;
}

/** Convertit un établissement brut de l'API en objet normalisé, ou null s'il est inexploitable. */
export function normaliseEtablissement(brut: Record<string, unknown>): EtablissementPlaces | null {
  const placeId = texteOuNull(brut.id);
  const nom = texteOuNull((brut.displayName as { text?: string } | undefined)?.text);
  if (!placeId || !nom) return null;

  // Un établissement définitivement fermé n'est pas un prospect.
  const statut = texteOuNull(brut.businessStatus);
  if (statut === "CLOSED_PERMANENTLY") return null;

  const adresse = texteOuNull(brut.formattedAddress);
  const { codePostal, ville } = decoupeAdresse(adresse);
  const position = brut.location as { latitude?: number; longitude?: number } | undefined;

  return {
    placeId,
    nom,
    adresse,
    codePostal,
    ville,
    telephone: texteOuNull(brut.nationalPhoneNumber) ?? texteOuNull(brut.internationalPhoneNumber),
    siteWeb: texteOuNull(brut.websiteUri),
    ficheGoogle: texteOuNull(brut.googleMapsUri),
    categorie: texteOuNull((brut.primaryTypeDisplayName as { text?: string } | undefined)?.text),
    latitude: typeof position?.latitude === "number" ? position.latitude : null,
    longitude: typeof position?.longitude === "number" ? position.longitude : null,
  };
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Recherche d'établissements en texte libre (« plombier Asnières-sur-Seine »).
 * Les doublons de fiche entre pages sont écartés.
 */
export async function chercheEtablissements(
  requete: string,
  options: OptionsPlaces,
): Promise<EtablissementPlaces[]> {
  const terme = requete.trim();
  if (!terme) return [];
  if (!options.cle) throw new Error("Clé Google Places absente (GOOGLE_MAPS_API_KEY).");

  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = options.endpoint ?? API_PLACES;
  // Google plafonne à 3 pages (60 résultats) : demander plus ne renvoie rien de neuf.
  const pages = Math.min(3, Math.max(1, options.pages ?? 3));

  const trouves: EtablissementPlaces[] = [];
  const vus = new Set<string>();
  let jeton: string | undefined;

  for (let page = 1; page <= pages; page++) {
    const reponse = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": options.cle,
        "X-Goog-FieldMask": CHAMPS,
      },
      body: JSON.stringify({
        textQuery: terme,
        languageCode: options.langue ?? "fr",
        ...(jeton ? { pageToken: jeton } : {}),
      }),
    });

    const donnees = await reponse.json().catch(() => ({})) as ReponsePlaces;
    if (!reponse.ok) {
      // Le message de Google est explicite (clé invalide, API non activée, quota) : on le
      // transmet tel quel plutôt que de le remplacer par un « erreur 400 » inutilisable.
      const detail = donnees.error?.message ?? `HTTP ${reponse.status}`;
      throw new Error(`Google Places : ${detail}`);
    }

    for (const brut of donnees.places ?? []) {
      const etablissement = normaliseEtablissement(brut);
      if (!etablissement || vus.has(etablissement.placeId)) continue;
      if (options.sansSiteSeulement && etablissement.siteWeb) continue;
      vus.add(etablissement.placeId);
      trouves.push(etablissement);
    }

    options.onPage?.(page, trouves.length);
    jeton = donnees.nextPageToken;
    if (!jeton) break;
    // Le jeton de page suivante n'est pas actif immédiatement côté Google.
    await pause(options.fetchImpl ? 0 : 1500);
  }

  return trouves;
}

/** Convertit un établissement Google en prospect, avant toute détection de site. */
export function prospectDepuisEtablissement(etablissement: EtablissementPlaces): Prospect {
  return {
    siren: "",
    siret_siege: null,
    nom: etablissement.nom,
    enseigne: null,
    activite_code: etablissement.categorie,
    activite_section: null,
    nature_juridique: null,
    categorie_entreprise: null,
    date_creation: null,
    tranche_effectif: null,
    effectif_estime: null,
    chiffre_affaires: null,
    annee_finances: null,
    adresse: etablissement.adresse,
    code_postal: etablissement.codePostal,
    ville: etablissement.ville,
    departement: etablissement.codePostal?.slice(0, 2) ?? null,
    latitude: etablissement.latitude,
    longitude: etablissement.longitude,
    dirigeant: null,
    site_web: etablissement.siteWeb,
    // L'absence de site sur la fiche Google est un indice, pas une preuve : c'est l'audit qui
    // tranchera en cherchant réellement un site.
    site_statut: "non_verifie",
    site_score: null,
    site_signaux: [],
    site_verifie_le: null,
    email_contact: null,
    telephone: etablissement.telephone,
    budget_score: 0,
    score: 0,
    priorite: "froid",
  };
}
