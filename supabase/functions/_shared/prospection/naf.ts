// Secteurs d'activité pré-configurés (codes NAF rév. 2) orientés "besoin d'un site web".
// Ces listes servent aussi bien à l'UI admin qu'au script CLI.

export interface SecteurCible {
  id: string;
  label: string;
  /** Codes NAF envoyés au paramètre `activite_principale` de l'API. */
  naf: string[];
}

export const SECTEURS_CIBLES: SecteurCible[] = [
  {
    id: "restauration",
    label: "Restauration & bars",
    naf: ["56.10A", "56.10B", "56.10C", "56.21Z", "56.29A", "56.30Z"],
  },
  {
    id: "beaute",
    label: "Coiffure, beauté & bien-être",
    naf: ["96.02A", "96.02B", "96.04Z", "96.09Z"],
  },
  {
    id: "btp",
    label: "BTP & artisans du bâtiment",
    naf: [
      "41.20A", "41.20B", "43.21A", "43.22A", "43.22B", "43.29A",
      "43.31Z", "43.32A", "43.33Z", "43.34Z", "43.39Z", "43.91A", "43.99C",
    ],
  },
  {
    id: "sante",
    label: "Santé & paramédical",
    naf: ["86.21Z", "86.22C", "86.23Z", "86.90E", "86.90F", "86.90D"],
  },
  {
    id: "immobilier",
    label: "Immobilier",
    naf: ["68.31Z", "68.20A", "68.20B", "68.32A"],
  },
  {
    id: "services_pro",
    label: "Services aux entreprises",
    naf: ["69.10Z", "69.20Z", "70.22Z", "71.11Z", "73.11Z", "78.10Z"],
  },
  {
    id: "commerce",
    label: "Commerce de détail",
    naf: ["47.11B", "47.19B", "47.25Z", "47.29Z", "47.71Z", "47.72A", "47.78C"],
  },
  {
    id: "auto",
    label: "Automobile & garages",
    naf: ["45.11Z", "45.20A", "45.20B", "45.32Z", "45.40Z"],
  },
  {
    id: "hebergement",
    label: "Hôtellerie & hébergement",
    naf: ["55.10Z", "55.20Z", "55.30Z"],
  },
  {
    id: "sport_loisirs",
    label: "Sport & loisirs",
    naf: ["93.11Z", "93.12Z", "93.13Z", "93.29Z"],
  },
  {
    id: "transport_vtc",
    label: "Transport & VTC",
    naf: ["49.32Z", "49.39B", "49.41B", "53.20Z"],
  },
  {
    id: "artisanat_alim",
    label: "Artisanat alimentaire",
    naf: ["10.71C", "10.71D", "10.13B", "47.22Z", "47.24Z"],
  },
];

/** Retourne les codes NAF correspondant à une liste d'identifiants de secteurs. */
export function nafDesSecteurs(ids: string[]): string[] {
  const codes = new Set<string>();
  for (const id of ids) {
    const secteur = SECTEURS_CIBLES.find((s) => s.id === id);
    secteur?.naf.forEach((code) => codes.add(code));
  }
  return [...codes];
}

/** Tranches d'effectif INSEE, avec un effectif moyen estimé pour le scoring. */
export const TRANCHES_EFFECTIF: Record<string, { label: string; moyenne: number }> = {
  NN: { label: "Non renseigné", moyenne: 0 },
  "00": { label: "0 salarié", moyenne: 0 },
  "01": { label: "1 ou 2 salariés", moyenne: 2 },
  "02": { label: "3 à 5 salariés", moyenne: 4 },
  "03": { label: "6 à 9 salariés", moyenne: 8 },
  "11": { label: "10 à 19 salariés", moyenne: 15 },
  "12": { label: "20 à 49 salariés", moyenne: 35 },
  "21": { label: "50 à 99 salariés", moyenne: 75 },
  "22": { label: "100 à 199 salariés", moyenne: 150 },
  "31": { label: "200 à 249 salariés", moyenne: 225 },
  "32": { label: "250 à 499 salariés", moyenne: 375 },
  "41": { label: "500 à 999 salariés", moyenne: 750 },
  "42": { label: "1 000 à 1 999 salariés", moyenne: 1500 },
  "51": { label: "2 000 à 4 999 salariés", moyenne: 3500 },
  "52": { label: "5 000 à 9 999 salariés", moyenne: 7500 },
  "53": { label: "10 000 salariés et plus", moyenne: 10000 },
};
