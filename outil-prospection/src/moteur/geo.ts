// Découpage administratif français : régions et départements.
//
// Sert à proposer des listes déroulantes plutôt que de faire saisir « 92 » de mémoire, et à
// traduire une région en départements — une recherche « Île-de-France » se règle en huit
// requêtes départementales, plus sûres qu'une seule requête géante qu'Overpass ferait expirer.

export interface Departement {
  /** Code INSEE : « 01 » à « 95 », « 2A »/« 2B » pour la Corse, « 971 »+ pour l'outre-mer. */
  code: string;
  nom: string;
  /** Identifiant de la région (voir `REGIONS`). */
  region: string;
}

export const REGIONS: Array<{ id: string; nom: string }> = [
  { id: "ara", nom: "Auvergne-Rhône-Alpes" },
  { id: "bfc", nom: "Bourgogne-Franche-Comté" },
  { id: "bre", nom: "Bretagne" },
  { id: "cvl", nom: "Centre-Val de Loire" },
  { id: "cor", nom: "Corse" },
  { id: "ges", nom: "Grand Est" },
  { id: "hdf", nom: "Hauts-de-France" },
  { id: "idf", nom: "Île-de-France" },
  { id: "nor", nom: "Normandie" },
  { id: "naq", nom: "Nouvelle-Aquitaine" },
  { id: "occ", nom: "Occitanie" },
  { id: "pdl", nom: "Pays de la Loire" },
  { id: "pac", nom: "Provence-Alpes-Côte d'Azur" },
  { id: "gua", nom: "Guadeloupe" },
  { id: "mar", nom: "Martinique" },
  { id: "guy", nom: "Guyane" },
  { id: "reu", nom: "La Réunion" },
  { id: "may", nom: "Mayotte" },
];

export const DEPARTEMENTS: Departement[] = [
  { code: "01", nom: "Ain", region: "ara" },
  { code: "02", nom: "Aisne", region: "hdf" },
  { code: "03", nom: "Allier", region: "ara" },
  { code: "04", nom: "Alpes-de-Haute-Provence", region: "pac" },
  { code: "05", nom: "Hautes-Alpes", region: "pac" },
  { code: "06", nom: "Alpes-Maritimes", region: "pac" },
  { code: "07", nom: "Ardèche", region: "ara" },
  { code: "08", nom: "Ardennes", region: "ges" },
  { code: "09", nom: "Ariège", region: "occ" },
  { code: "10", nom: "Aube", region: "ges" },
  { code: "11", nom: "Aude", region: "occ" },
  { code: "12", nom: "Aveyron", region: "occ" },
  { code: "13", nom: "Bouches-du-Rhône", region: "pac" },
  { code: "14", nom: "Calvados", region: "nor" },
  { code: "15", nom: "Cantal", region: "ara" },
  { code: "16", nom: "Charente", region: "naq" },
  { code: "17", nom: "Charente-Maritime", region: "naq" },
  { code: "18", nom: "Cher", region: "cvl" },
  { code: "19", nom: "Corrèze", region: "naq" },
  { code: "2A", nom: "Corse-du-Sud", region: "cor" },
  { code: "2B", nom: "Haute-Corse", region: "cor" },
  { code: "21", nom: "Côte-d'Or", region: "bfc" },
  { code: "22", nom: "Côtes-d'Armor", region: "bre" },
  { code: "23", nom: "Creuse", region: "naq" },
  { code: "24", nom: "Dordogne", region: "naq" },
  { code: "25", nom: "Doubs", region: "bfc" },
  { code: "26", nom: "Drôme", region: "ara" },
  { code: "27", nom: "Eure", region: "nor" },
  { code: "28", nom: "Eure-et-Loir", region: "cvl" },
  { code: "29", nom: "Finistère", region: "bre" },
  { code: "30", nom: "Gard", region: "occ" },
  { code: "31", nom: "Haute-Garonne", region: "occ" },
  { code: "32", nom: "Gers", region: "occ" },
  { code: "33", nom: "Gironde", region: "naq" },
  { code: "34", nom: "Hérault", region: "occ" },
  { code: "35", nom: "Ille-et-Vilaine", region: "bre" },
  { code: "36", nom: "Indre", region: "cvl" },
  { code: "37", nom: "Indre-et-Loire", region: "cvl" },
  { code: "38", nom: "Isère", region: "ara" },
  { code: "39", nom: "Jura", region: "bfc" },
  { code: "40", nom: "Landes", region: "naq" },
  { code: "41", nom: "Loir-et-Cher", region: "cvl" },
  { code: "42", nom: "Loire", region: "ara" },
  { code: "43", nom: "Haute-Loire", region: "ara" },
  { code: "44", nom: "Loire-Atlantique", region: "pdl" },
  { code: "45", nom: "Loiret", region: "cvl" },
  { code: "46", nom: "Lot", region: "occ" },
  { code: "47", nom: "Lot-et-Garonne", region: "naq" },
  { code: "48", nom: "Lozère", region: "occ" },
  { code: "49", nom: "Maine-et-Loire", region: "pdl" },
  { code: "50", nom: "Manche", region: "nor" },
  { code: "51", nom: "Marne", region: "ges" },
  { code: "52", nom: "Haute-Marne", region: "ges" },
  { code: "53", nom: "Mayenne", region: "pdl" },
  { code: "54", nom: "Meurthe-et-Moselle", region: "ges" },
  { code: "55", nom: "Meuse", region: "ges" },
  { code: "56", nom: "Morbihan", region: "bre" },
  { code: "57", nom: "Moselle", region: "ges" },
  { code: "58", nom: "Nièvre", region: "bfc" },
  { code: "59", nom: "Nord", region: "hdf" },
  { code: "60", nom: "Oise", region: "hdf" },
  { code: "61", nom: "Orne", region: "nor" },
  { code: "62", nom: "Pas-de-Calais", region: "hdf" },
  { code: "63", nom: "Puy-de-Dôme", region: "ara" },
  { code: "64", nom: "Pyrénées-Atlantiques", region: "naq" },
  { code: "65", nom: "Hautes-Pyrénées", region: "occ" },
  { code: "66", nom: "Pyrénées-Orientales", region: "occ" },
  { code: "67", nom: "Bas-Rhin", region: "ges" },
  { code: "68", nom: "Haut-Rhin", region: "ges" },
  { code: "69", nom: "Rhône", region: "ara" },
  { code: "70", nom: "Haute-Saône", region: "bfc" },
  { code: "71", nom: "Saône-et-Loire", region: "bfc" },
  { code: "72", nom: "Sarthe", region: "pdl" },
  { code: "73", nom: "Savoie", region: "ara" },
  { code: "74", nom: "Haute-Savoie", region: "ara" },
  { code: "75", nom: "Paris", region: "idf" },
  { code: "76", nom: "Seine-Maritime", region: "nor" },
  { code: "77", nom: "Seine-et-Marne", region: "idf" },
  { code: "78", nom: "Yvelines", region: "idf" },
  { code: "79", nom: "Deux-Sèvres", region: "naq" },
  { code: "80", nom: "Somme", region: "hdf" },
  { code: "81", nom: "Tarn", region: "occ" },
  { code: "82", nom: "Tarn-et-Garonne", region: "occ" },
  { code: "83", nom: "Var", region: "pac" },
  { code: "84", nom: "Vaucluse", region: "pac" },
  { code: "85", nom: "Vendée", region: "pdl" },
  { code: "86", nom: "Vienne", region: "naq" },
  { code: "87", nom: "Haute-Vienne", region: "naq" },
  { code: "88", nom: "Vosges", region: "ges" },
  { code: "89", nom: "Yonne", region: "bfc" },
  { code: "90", nom: "Territoire de Belfort", region: "bfc" },
  { code: "91", nom: "Essonne", region: "idf" },
  { code: "92", nom: "Hauts-de-Seine", region: "idf" },
  { code: "93", nom: "Seine-Saint-Denis", region: "idf" },
  { code: "94", nom: "Val-de-Marne", region: "idf" },
  { code: "95", nom: "Val-d'Oise", region: "idf" },
  { code: "971", nom: "Guadeloupe", region: "gua" },
  { code: "972", nom: "Martinique", region: "mar" },
  { code: "973", nom: "Guyane", region: "guy" },
  { code: "974", nom: "La Réunion", region: "reu" },
  { code: "976", nom: "Mayotte", region: "may" },
];

/** Départements d'une région, dans l'ordre des codes. Liste vide si la région est inconnue. */
export function departementsDeRegion(regionId: string): Departement[] {
  return DEPARTEMENTS.filter((departement) => departement.region === regionId);
}

/** Département correspondant à un code, ou null. Tolère la casse (« 2a » → « 2A »). */
export function departementParCode(code: string): Departement | null {
  const propre = code.trim().toUpperCase();
  return DEPARTEMENTS.find((departement) => departement.code === propre) ?? null;
}

/** Libellé lisible « 92 — Hauts-de-Seine ». */
export function libelleDepartement(departement: Departement): string {
  return `${departement.code} — ${departement.nom}`;
}
