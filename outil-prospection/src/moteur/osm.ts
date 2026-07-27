// Recherche de commerces dans OpenStreetMap via l'API Overpass.
//
// Pourquoi cette source en plus de Sirene : Sirene connaît toutes les entreprises mais ignore
// leur site web et leur téléphone. OpenStreetMap, lui, décrit les commerces tels qu'ils sont
// sur le terrain — nom, adresse exacte, téléphone, site quand il existe. Un commerce cartographié
// sans étiquette `website` est exactement le prospect recherché.
//
// Service communautaire gratuit, sans clé : une requête par recherche, un délai d'attente
// explicite, et un User-Agent identifiable. Les données sont sous licence ODbL — l'interface
// affiche l'attribution obligatoire.

import type { Prospect } from "./types.ts";

export const OVERPASS_PAR_DEFAUT = "https://overpass-api.de/api/interpreter";

/** Catégories proposées à l'utilisateur, traduites en étiquettes OpenStreetMap. */
export const CATEGORIES_OSM: Array<{ id: string; label: string; filtres: string[] }> = [
  { id: "restauration", label: "Restaurants, bars, cafés", filtres: ['["amenity"~"^(restaurant|cafe|bar|fast_food|pub|ice_cream)$"]'] },
  { id: "beaute", label: "Coiffure, beauté, bien-être", filtres: ['["shop"~"^(hairdresser|beauty|massage|cosmetics)$"]', '["leisure"="fitness_centre"]'] },
  { id: "btp", label: "Artisans du bâtiment", filtres: ['["craft"~"^(carpenter|plumber|electrician|roofer|painter|builder|tiler|glaziery|hvac|stonemason)$"]'] },
  { id: "sante", label: "Santé et paramédical", filtres: ['["amenity"~"^(dentist|doctors|veterinary|pharmacy)$"]', '["healthcare"~"^(physiotherapist|psychotherapist|podiatrist|optometrist)$"]'] },
  { id: "immobilier", label: "Immobilier", filtres: ['["office"~"^(estate_agent|insurance)$"]'] },
  { id: "commerce", label: "Commerces de détail", filtres: ['["shop"~"^(bakery|butcher|florist|clothes|shoes|jewelry|furniture|books|toys|optician|greengrocer|deli|wine|pet)$"]'] },
  { id: "auto", label: "Automobile et garages", filtres: ['["shop"~"^(car|car_repair|car_parts|motorcycle|tyres)$"]', '["amenity"="driving_school"]'] },
  { id: "hotellerie", label: "Hôtellerie et hébergement", filtres: ['["tourism"~"^(hotel|guest_house|apartment|chalet|camp_site)$"]'] },
  { id: "services_pro", label: "Services aux entreprises", filtres: ['["office"~"^(accountant|lawyer|architect|company|consulting|advertising_agency|it)$"]'] },
  { id: "artisanat", label: "Artisanat et métiers de bouche", filtres: ['["craft"~"^(bakery|brewery|caterer|photographer|shoemaker|tailor|jeweller|winery|confectionery)$"]'] },
];

export interface FiltresOsm {
  /** Commune recherchée (nom exact de la commune OpenStreetMap). */
  ville?: string;
  codePostal?: string;
  /**
   * Numéro de département français (« 92 », « 2A »). Couvre tout le département d'un coup,
   * là où Google Places plafonne à 60 résultats par recherche.
   */
  departement?: string;
  /** Identifiants de `CATEGORIES_OSM`. */
  categories?: string[];
  /** Ne garder que les commerces sans étiquette `website`. */
  sansSiteSeulement?: boolean;
  limite?: number;
}

export interface CommerceOsm {
  /** Identifiant OpenStreetMap, stable : sert au dédoublonnage entre deux recherches. */
  osmId: string;
  nom: string;
  categorie: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  telephone: string | null;
  email: string | null;
  siteWeb: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface OptionsOsm {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  endpoint?: string;
}

interface ElementOverpass {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

/** Échappe une valeur insérée dans une requête Overpass (guillemets et retours à la ligne). */
function echappe(valeur: string): string {
  return valeur.replace(/["\\\n\r]/g, " ").trim().slice(0, 80);
}

/**
 * Construit la requête Overpass QL.
 * La zone est définie par la commune, le code postal, ou les deux — sans zone, la requête
 * balaierait la planète, ce qu'Overpass refuse (et à raison).
 */
export function construitRequeteOsm(filtres: FiltresOsm): string {
  // 3 000 : un département entier tient largement dedans pour un métier donné, et Overpass
  // reste dans son délai. Le plafond protège d'une requête « tous commerces de Paris » qui
  // ferait tomber le serveur bénévole.
  const limite = Math.min(Math.max(filtres.limite ?? 200, 1), 3000);
  const categories = (filtres.categories?.length ? filtres.categories : CATEGORIES_OSM.map((c) => c.id))
    .flatMap((id) => CATEGORIES_OSM.find((c) => c.id === id)?.filtres ?? []);
  if (!categories.length) throw new Error("Aucune catégorie reconnue pour la recherche OpenStreetMap");

  const zones: string[] = [];
  if (filtres.ville) {
    zones.push(`area["boundary"="administrative"]["admin_level"~"8|9"]["name"="${echappe(filtres.ville)}"]->.zone;`);
  } else if (filtres.codePostal) {
    zones.push(`area["postal_code"="${echappe(filtres.codePostal)}"]->.zone;`);
  } else if (filtres.departement) {
    // En France, le département est le niveau administratif 6, identifié par son numéro.
    zones.push(`area["boundary"="administrative"]["admin_level"="6"]["ref"="${echappe(filtres.departement)}"]->.zone;`);
  } else {
    throw new Error("Précisez une commune, un code postal ou un département pour chercher dans OpenStreetMap");
  }

  const corps = categories.map((filtre) => `  nwr${filtre}["name"](area.zone);`).join("\n");
  return `[out:json][timeout:${filtres.departement ? 180 : 60}];
${zones.join("\n")}
(
${corps}
);
out center tags ${limite};`;
}

/** Transforme un élément Overpass en commerce exploitable, ou null s'il est inutilisable. */
export function mapCommerce(element: ElementOverpass): CommerceOsm | null {
  const tags = element.tags ?? {};
  const nom = tags.name?.trim();
  if (!nom || !element.id || !element.type) return null;

  const numero = tags["addr:housenumber"];
  const rue = tags["addr:street"];
  const adresse = [numero, rue].filter(Boolean).join(" ") || null;

  return {
    osmId: `${element.type}/${element.id}`,
    nom,
    categorie: tags.shop ?? tags.amenity ?? tags.craft ?? tags.office ?? tags.tourism ?? tags.healthcare ?? tags.leisure ?? null,
    adresse,
    codePostal: tags["addr:postcode"] ?? null,
    ville: tags["addr:city"] ?? null,
    telephone: tags.phone ?? tags["contact:phone"] ?? tags["contact:mobile"] ?? null,
    email: tags.email ?? tags["contact:email"] ?? null,
    siteWeb: tags.website ?? tags["contact:website"] ?? tags.url ?? null,
    latitude: element.lat ?? element.center?.lat ?? null,
    longitude: element.lon ?? element.center?.lon ?? null,
  };
}

/**
 * Interroge Overpass et retourne les commerces trouvés.
 * Overpass est un service bénévole : une seule requête est envoyée, avec un délai d'attente
 * annoncé et un User-Agent identifiable.
 */
export async function chercheCommerces(
  filtres: FiltresOsm,
  options: OptionsOsm = {},
): Promise<CommerceOsm[]> {
  const requete = construitRequeteOsm(filtres);
  const fetchImpl = options.fetchImpl ?? fetch;
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), options.timeoutMs ?? 90_000);

  try {
    const res = await fetchImpl(options.endpoint ?? OVERPASS_PAR_DEFAUT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "FideliProProspection/1.0 (outil local de prospection)",
      },
      body: new URLSearchParams({ data: requete }).toString(),
      signal: controleur.signal,
    });
    if (res.status === 429 || res.status === 504) {
      throw new Error("OpenStreetMap est momentanément saturé (service gratuit) : réessayez dans une minute.");
    }
    if (!res.ok) throw new Error(`Overpass ${res.status}`);

    const donnees = (await res.json()) as { elements?: ElementOverpass[] };
    const commerces = (donnees.elements ?? [])
      .map(mapCommerce)
      .filter((commerce): commerce is CommerceOsm => commerce !== null);

    const dedoublonnes = [...new Map(commerces.map((c) => [c.osmId, c])).values()];
    return filtres.sansSiteSeulement ? dedoublonnes.filter((c) => !c.siteWeb) : dedoublonnes;
  } finally {
    clearTimeout(minuteur);
  }
}

/**
 * Convertit un commerce en prospect.
 * L'absence d'étiquette `website` dans OpenStreetMap est un indice, pas une preuve : le statut
 * reste « non vérifié » et c'est l'audit qui tranchera en cherchant réellement un site.
 */
export function prospectDepuisCommerce(commerce: CommerceOsm): Prospect {
  return {
    siren: "",
    siret_siege: null,
    nom: commerce.nom,
    enseigne: null,
    activite_code: commerce.categorie,
    activite_section: null,
    nature_juridique: null,
    categorie_entreprise: null,
    date_creation: null,
    tranche_effectif: null,
    effectif_estime: null,
    chiffre_affaires: null,
    annee_finances: null,
    adresse: commerce.adresse,
    code_postal: commerce.codePostal,
    ville: commerce.ville,
    departement: commerce.codePostal?.slice(0, 2) ?? null,
    latitude: commerce.latitude,
    longitude: commerce.longitude,
    dirigeant: null,
    site_web: commerce.siteWeb,
    site_statut: "non_verifie",
    site_score: null,
    site_signaux: [],
    site_verifie_le: null,
    email_contact: commerce.email,
    telephone: commerce.telephone,
    // Sans données Sirene, la capacité budgétaire est inconnue : socle neutre.
    budget_score: 50,
    score: 50,
    priorite: "tiede",
  };
}
