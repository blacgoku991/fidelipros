// Logiciels serveur en fin de vie, déduits des en-têtes que le site publie lui-même.
//
// Une version en fin de support ne reçoit plus aucun correctif de sécurité : toute faille
// découverte ensuite reste ouverte pour toujours. C'est un constat, pas une exploitation — on
// lit ce que le serveur affiche, on compare à des dates de fin de support publiques, et on
// renvoie vers la source officielle pour vérification.

export interface LogicielObsolete {
  logiciel: string;
  version: string;
  finDeSupport: string;
  consequence: string;
  reference: string;
}

/** Compare deux versions « 7.4.3 » façon numéros de version (négatif si a < b). */
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

/**
 * Branches logicielles et la première version encore supportée à la date d'écriture.
 * En dessous : plus aucun correctif de sécurité. Les dates sont publiques et vérifiables sur
 * endoflife.date.
 */
const FINS_DE_SUPPORT: Array<{
  motif: RegExp;
  logiciel: string;
  supporteeAPartirDe: string;
  finDeSupport: string;
  reference: string;
}> = [
  { motif: /PHP\/(\d+\.\d+(?:\.\d+)?)/i, logiciel: "PHP", supporteeAPartirDe: "8.1", finDeSupport: "PHP 8.0 et antérieurs (fin 2023)", reference: "https://www.php.net/supported-versions.php" },
  { motif: /Apache\/(\d+\.\d+\.\d+)/i, logiciel: "Apache httpd", supporteeAPartirDe: "2.4.0", finDeSupport: "branches 2.2 et 2.0 (fin 2017)", reference: "https://httpd.apache.org/download.cgi" },
  { motif: /nginx\/(\d+\.\d+(?:\.\d+)?)/i, logiciel: "nginx", supporteeAPartirDe: "1.24", finDeSupport: "branches antérieures à 1.24", reference: "https://nginx.org/en/download.html" },
  { motif: /OpenSSL\/(\d+\.\d+\.\d+)/i, logiciel: "OpenSSL", supporteeAPartirDe: "1.1.1", finDeSupport: "OpenSSL 1.0.x et 1.1.0 (fin 2019)", reference: "https://www.openssl.org/policies/releasestrat.html" },
];

/**
 * Détecte un logiciel serveur en fin de vie à partir des en-têtes `Server` et `X-Powered-By`.
 * Retourne au plus un constat par logiciel identifié.
 */
export function logicielsObsoletes(entetes: Record<string, string>): LogicielObsolete[] {
  const banniere = [entetes["server"], entetes["x-powered-by"]].filter(Boolean).join(" ");
  if (!banniere) return [];

  const trouves: LogicielObsolete[] = [];
  for (const regle of FINS_DE_SUPPORT) {
    const trouve = regle.motif.exec(banniere);
    if (!trouve) continue;
    const version = trouve[1];
    if (compareVersions(version, regle.supporteeAPartirDe) >= 0) continue;
    trouves.push({
      logiciel: regle.logiciel,
      version,
      finDeSupport: regle.finDeSupport,
      consequence: `${regle.logiciel} ${version} ne reçoit plus de correctif de sécurité : toute faille découverte depuis reste ouverte`,
      reference: regle.reference,
    });
  }
  return trouves;
}
