/**
 * Coordonnées, informations légales et paramètres SEO du site.
 *
 * ⚠️ À COMPLÉTER avant la mise en ligne :
 *   - `url`          : le domaine réel (sert au canonical, à l'OG et au sitemap)
 *   - `email`        : adresse de contact
 *   - `phone`        : laissez vide pour masquer le bloc téléphone
 *   - `city` / `region` / `postalCode` : le référencement local est le premier
 *     levier pour une agence — un concurrent avec une ville dans son titre et
 *     une fiche Google Business passera devant un site sans ancrage géographique.
 *   - `legal.siren`  : obligatoire en mentions légales
 */

type SiteConfig = {
  name: string;
  legalName: string;
  tagline: string;
  url: string;
  email: string;
  phone: string;
  /** Ville du siège — alimente le JSON-LD local et les mentions légales. */
  city: string;
  region: string;
  postalCode: string;
  country: string;
  /** Zones desservies, listées dans le JSON-LD `areaServed`. */
  areaServed: readonly string[];
  geo: { latitude: number; longitude: number };
  location: string;
  responseTime: string;
  /** Format schema.org `openingHours`, repris dans le JSON-LD local. */
  openingHours: string;
  foundingYear: string;
  legal: { company: string; siren: string; address: string };
  social: ReadonlyArray<{ label: string; href: string }>;
};

export const site: SiteConfig = {
  name: "SmartFixx",
  legalName: "SmartFixx",
  tagline: "Création de site web, refonte et automatisation informatique",
  url: "https://smartfixx.fr",
  email: "contact@smartfixx.fr",
  phone: "",
  city: "Asnières-sur-Seine",
  region: "Île-de-France",
  postalCode: "92600",
  country: "FR",
  /* Zones déclarées dans le JSON-LD `areaServed`. Doit rester cohérent avec les
     pages réellement publiées : annoncer une commune sans page ni présence est
     un signal contradictoire. Les échelons larges (région, France) traduisent la
     couverture à distance. */
  areaServed: [
    "Asnières-sur-Seine",
    "Bois-Colombes",
    "Clichy",
    "Colombes",
    "Courbevoie",
    "Gennevilliers",
    "Levallois-Perret",
    "Nanterre",
    "Boulogne-Billancourt",
    "Neuilly-sur-Seine",
    "Issy-les-Moulineaux",
    "Saint-Ouen-sur-Seine",
    "Argenteuil",
    "Paris",
    "Hauts-de-Seine",
    "Seine-Saint-Denis",
    "Val-d'Oise",
    "Île-de-France",
    "France",
  ],
  /* Coordonnées d'Asnières-sur-Seine — à remplacer par celles du siège exact. */
  geo: { latitude: 48.9105, longitude: 2.2857 },
  location: "Asnières-sur-Seine (92600) · Toute l'Île-de-France · À distance partout en France",
  responseTime: "Réponse sous 24 h ouvrées",
  openingHours: "Mo-Fr 09:00-19:00",
  foundingYear: "2026",
  legal: {
    company: "SmartFixx",
    siren: "",
    address: "",
  },
  social: [
    { label: "LinkedIn", href: "https://www.linkedin.com/" },
    { label: "GitHub", href: "https://github.com/" },
  ],
};

export const PROJECT_TYPES = [
  "Création de site web",
  "Refonte complète",
  "Automatisation / interconnexion de logiciels",
  "Application métier sur-mesure",
  "Tableau de bord / reporting",
  "Maintenance & optimisation",
  "Autre / je ne sais pas encore",
] as const;

export const BUDGET_RANGES = [
  "Moins de 2 000 €",
  "2 000 – 5 000 €",
  "5 000 – 10 000 €",
  "Plus de 10 000 €",
  "À définir ensemble",
] as const;

/**
 * Prestations exposées dans le JSON-LD `hasOfferCatalog` et dans le sitemap.
 * Garder aligné avec les sections du site : une prestation annoncée dans les
 * données structurées mais absente de la page est un signal contradictoire.
 */
export const SERVICES = [
  {
    slug: "creation-site-web",
    name: "Création de site web",
    description:
      "Site vitrine, e-commerce, landing page ou application web sur-mesure : direction artistique dédiée, développement, contenu structuré et socle SEO technique.",
  },
  {
    slug: "refonte-site-web",
    name: "Refonte de site web",
    description:
      "Audit technique et SEO de l'existant, récupération du contenu, nouveau design et migration sans perte de référencement ni de données.",
  },
  {
    slug: "automatisation-informatique",
    name: "Automatisation informatique",
    description:
      "Interconnexion de logiciels métiers, ERP, CRM, tableurs et boîtes mail. Synchronisations planifiées, imports/exports automatiques, alertes et rapports générés sans intervention.",
  },
  {
    slug: "application-metier",
    name: "Application métier sur-mesure",
    description:
      "Développement d'un outil interne taillé pour votre process quand aucun logiciel du marché ne convient.",
  },
  {
    slug: "tableaux-de-bord",
    name: "Tableaux de bord et reporting",
    description:
      "Consolidation de vos données en indicateurs à jour, sans export manuel, avec diffusion automatique aux bonnes personnes.",
  },
  {
    slug: "maintenance-infogerance",
    name: "Maintenance et infogérance",
    description:
      "Mises à jour, sauvegardes testées, supervision des flux critiques, correctifs et assistance.",
  },
] as const;
