// Composants front (extensions WordPress, bibliothèques JavaScript) dont des versions sont
// connues pour des vulnérabilités exploitées en masse.
//
// Principe de crédibilité : on ne cite un numéro de CVE que lorsqu'il est certain ; sinon on
// renvoie vers la base publique (WPScan, Snyk) avec la version détectée, pour que le prospect
// — ou son prestataire actuel — lise l'avis d'origine. Le nom, la version et la version
// corrigée suffisent à alerter ; la référence permet de vérifier. Aucune faille n'est testée :
// on lit la version affichée dans le code de la page et, quand c'est possible, on la confirme
// avec le fichier `readme.txt` public de l'extension.

export interface FailleConnue {
  /** Identifiant du composant tel que détecté (nom de fichier ou slug d'extension). */
  composant: string;
  /** Version corrigée : en dessous, la version est concernée. */
  corrigeeEn: string;
  /** Ce que la faille permet, en une ligne compréhensible par un dirigeant. */
  consequence: string;
  /** Numéro CVE, uniquement quand il est certain. */
  cve?: string;
  /** Base publique où vérifier l'avis d'origine (toujours présente). */
  reference: string;
}

/** Recherche WPScan pour une extension, page consultable par n'importe qui. */
const wpscan = (slug: string) => `https://wpscan.com/search?text=${encodeURIComponent(slug)}`;
/** Avis Snyk pour une bibliothèque npm. */
const snyk = (paquet: string) => `https://security.snyk.io/package/npm/${paquet}`;

export const FAILLES_CONNUES: FailleConnue[] = [
  // ── Extensions WordPress massivement ciblées ──────────────────────────────
  { composant: "wp-file-manager", corrigeeEn: "6.9", cve: "CVE-2020-25213", consequence: "exécution de code à distance sans authentification", reference: wpscan("wp-file-manager") },
  { composant: "duplicator", corrigeeEn: "1.3.28", cve: "CVE-2020-11738", consequence: "lecture des fichiers du serveur, dont les identifiants de la base", reference: wpscan("duplicator") },
  { composant: "elementor", corrigeeEn: "3.6.3", cve: "CVE-2022-1329", consequence: "téléversement de fichier par un compte à faibles droits", reference: wpscan("elementor") },
  { composant: "contact-form-7", corrigeeEn: "5.3.2", cve: "CVE-2020-35489", consequence: "téléversement de fichier non filtré", reference: wpscan("contact-form-7") },
  { composant: "wpdiscuz", corrigeeEn: "7.0.5", cve: "CVE-2020-24186", consequence: "téléversement de fichier arbitraire sans authentification", reference: wpscan("wpdiscuz") },
  { composant: "wp-super-cache", corrigeeEn: "1.7.2", cve: "CVE-2021-24209", consequence: "exécution de code via une page d'administration piégée", reference: wpscan("wp-super-cache") },
  // Sans CVE certain : la version corrigée est conservatrice, la référence renvoie à l'avis.
  { composant: "revslider", corrigeeEn: "6.0.0", consequence: "l'une des extensions les plus attaquées (téléversement de fichier, lecture de fichiers sur d'anciennes versions)", reference: wpscan("revslider") },
  { composant: "layerslider", corrigeeEn: "7.10.1", consequence: "injection SQL non authentifiée recensée sur d'anciennes versions", reference: wpscan("layerslider") },
  { composant: "ninja-forms", corrigeeEn: "3.6.11", consequence: "versions anciennes recensées pour injection de code et fuite de données", reference: wpscan("ninja-forms") },
  { composant: "all-in-one-seo-pack", corrigeeEn: "4.1.5.3", consequence: "élévation de privilèges recensée sur d'anciennes versions", reference: wpscan("all-in-one-seo-pack") },
  { composant: "wpforms-lite", corrigeeEn: "1.7.9", consequence: "versions anciennes recensées comme vulnérables", reference: wpscan("wpforms-lite") },

  // ── Bibliothèques JavaScript (CVE bien établis) ───────────────────────────
  { composant: "jQuery", corrigeeEn: "3.5.0", cve: "CVE-2020-11022", consequence: "injection de code via du HTML manipulé (XSS)", reference: snyk("jquery") },
  { composant: "jQuery UI", corrigeeEn: "1.13.2", cve: "CVE-2022-31160", consequence: "injection de code via les composants d'interface (XSS)", reference: snyk("jquery-ui") },
  { composant: "Bootstrap", corrigeeEn: "4.3.1", cve: "CVE-2019-8331", consequence: "injection de code via les infobulles (XSS)", reference: snyk("bootstrap") },
  { composant: "Lodash", corrigeeEn: "4.17.21", cve: "CVE-2021-23337", consequence: "altération d'objets conduisant à l'exécution de commandes", reference: snyk("lodash") },
  { composant: "Moment.js", corrigeeEn: "2.29.4", consequence: "traversée de chemin et déni de service (CVE-2022-24785, CVE-2022-31129)", reference: snyk("moment") },
  { composant: "AngularJS", corrigeeEn: "999", consequence: "plus aucun correctif de sécurité publié depuis fin 2021 (fin de vie)", reference: snyk("angular") },
];

/** Compare deux versions « 1.13.2 » façon numéros de version (négatif si a < b). */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.split(/[.\-+]/).map((n) => Number.parseInt(n, 10) || 0);
  const g = parts(a);
  const d = parts(b);
  for (let i = 0; i < Math.max(g.length, d.length); i++) {
    const diff = (g[i] ?? 0) - (d[i] ?? 0);
    if (diff !== 0) return diff;
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

/** Constat lisible pour une faille de composant : version, correctif, conséquence, référence. */
export function libelleFaille(nom: string, version: string, faille: FailleConnue): string {
  const correctif = faille.corrigeeEn === "999" ? "sans successeur maintenu" : `corrigé en ${faille.corrigeeEn}`;
  return `${nom} ${version} (${correctif}) — ${faille.consequence}. ` +
    `${faille.cve ? `Référence : ${faille.cve} · ` : ""}Vérifier : ${faille.reference}`;
}
