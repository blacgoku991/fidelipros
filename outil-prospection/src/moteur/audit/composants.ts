// Versions de composants connues pour des failles exploitées en masse.
//
// Choix assumé : cette liste est **courte et vérifiable**, limitée à des vulnérabilités
// documentées, massivement exploitées, et repérables depuis l'extérieur par le seul numéro de
// version affiché dans le code de la page. Il ne s'agit pas d'un scanner de vulnérabilités :
// aucune faille n'est testée, rien n'est exploité. On constate une version, on la compare, on
// le dit — et on renvoie le prospect vers la source publique pour qu'il vérifie lui-même.

export interface FailleConnue {
  /** Identifiant du composant tel que détecté (nom de fichier ou slug d'extension). */
  composant: string;
  /** Version corrigée : en dessous, la version est concernée. */
  corrigeeEn: string;
  /** Ce que la faille permet, en une ligne compréhensible par le dirigeant. */
  consequence: string;
  /** Référence publique consultable. */
  reference: string;
}

export const FAILLES_CONNUES: FailleConnue[] = [
  {
    composant: "revslider",
    corrigeeEn: "5.4.6",
    consequence: "prise de contrôle du site par envoi de fichier",
    reference: "CVE-2016-10309 / exploitation massive « Slider Revolution »",
  },
  {
    composant: "wp-file-manager",
    corrigeeEn: "6.9",
    consequence: "exécution de code à distance sans authentification",
    reference: "CVE-2020-25213",
  },
  {
    composant: "duplicator",
    corrigeeEn: "1.3.28",
    consequence: "lecture des fichiers du serveur, dont les mots de passe de la base",
    reference: "CVE-2020-11738",
  },
  {
    composant: "elementor",
    corrigeeEn: "3.6.3",
    consequence: "envoi de fichier arbitraire par un compte à faibles droits",
    reference: "CVE-2022-1329",
  },
  {
    composant: "contact-form-7",
    corrigeeEn: "5.3.2",
    consequence: "envoi de fichier non filtré",
    reference: "CVE-2020-35489",
  },
  {
    composant: "wp-super-cache",
    corrigeeEn: "1.7.2",
    consequence: "exécution de code par un administrateur piégé",
    reference: "CVE-2021-24209",
  },
  {
    composant: "wpdiscuz",
    corrigeeEn: "7.0.5",
    consequence: "envoi de fichier arbitraire sans authentification",
    reference: "CVE-2020-24186",
  },
  {
    composant: "jQuery",
    corrigeeEn: "3.5.0",
    consequence: "injection de code via du HTML manipulé (XSS)",
    reference: "CVE-2020-11022 / CVE-2020-11023",
  },
  {
    composant: "jQuery UI",
    corrigeeEn: "1.13.2",
    consequence: "injection de code via les composants d'interface",
    reference: "CVE-2022-31160",
  },
  {
    composant: "Bootstrap",
    corrigeeEn: "4.3.1",
    consequence: "injection de code via les infobulles",
    reference: "CVE-2019-8331",
  },
  {
    composant: "AngularJS",
    corrigeeEn: "999",
    consequence: "plus aucune correction de sécurité publiée depuis fin 2021",
    reference: "fin de support AngularJS 1.x",
  },
  {
    composant: "Lodash",
    corrigeeEn: "4.17.21",
    consequence: "altération d'objets JavaScript conduisant à l'exécution de code",
    reference: "CVE-2021-23337",
  },
  {
    composant: "Moment.js",
    corrigeeEn: "2.29.4",
    consequence: "lecture de fichiers du serveur via un chemin manipulé",
    reference: "CVE-2022-31129",
  },
];

/**
 * Compare deux versions « 1.13.2 » façon numéros de version.
 * Retourne un nombre négatif si `a` est antérieure à `b`.
 */
export function compareVersions(a: string, b: string): number {
  const decoupe = (version: string) =>
    version.split(/[.\-+]/).map((partie) => Number.parseInt(partie, 10)).map((n) => (Number.isFinite(n) ? n : 0));
  const gauche = decoupe(a);
  const droite = decoupe(b);
  for (let i = 0; i < Math.max(gauche.length, droite.length); i++) {
    const difference = (gauche[i] ?? 0) - (droite[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** Faille connue correspondant à un composant détecté, ou null. */
export function failleDe(nom: string, version: string): FailleConnue | null {
  const faille = FAILLES_CONNUES.find(
    (candidate) => candidate.composant.toLowerCase() === nom.toLowerCase(),
  );
  if (!faille) return null;
  return compareVersions(version, faille.corrigeeEn) < 0 ? faille : null;
}
