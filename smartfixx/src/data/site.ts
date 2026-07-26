/**
 * Coordonnées et informations légales du site.
 * ⚠️ À compléter avec vos vraies informations avant la mise en ligne :
 * e-mail, téléphone, raison sociale, SIREN, adresse.
 */
type SiteConfig = {
  name: string;
  tagline: string;
  email: string;
  phone: string;
  location: string;
  responseTime: string;
  legal: { company: string; siren: string; address: string };
  social: ReadonlyArray<{ label: string; href: string }>;
};

export const site: SiteConfig = {
  name: "SmartFixx",
  tagline: "Sites web, refonte & automatisation métier",
  email: "contact@smartfixx.fr",
  /** Laissez vide pour masquer le bloc téléphone. */
  phone: "",
  location: "France · Interventions à distance dans toute la francophonie",
  responseTime: "Réponse sous 24 h ouvrées",
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
  "Automatisation / interconnexion",
  "Application web sur-mesure",
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
