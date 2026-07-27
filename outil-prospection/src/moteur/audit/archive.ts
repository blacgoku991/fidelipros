// Historique du site via l'Internet Archive (Wayback Machine).
//
// API publique, sans clé et sans quota déclaré. Elle répond à la question qui fait vendre une
// refonte : « depuis quand ce site n'a-t-il pas changé ? ». C'est une donnée vérifiable par le
// prospect lui-même — il peut ouvrir la capture d'archive et constater que c'est le même site.

const CDX = "https://web.archive.org/cdx/search/cdx";

export interface ArchiveSite {
  /** Première capture connue : depuis quand le site existe. */
  premiereCapture: string | null;
  /** Capture la plus récente. */
  derniereCapture: string | null;
  /**
   * Date d'apparition du contenu actuel : la page d'accueil n'a pas changé depuis.
   * `collapse=digest` regroupe les captures identiques, la dernière ligne est donc le moment
   * où la version en ligne aujourd'hui est apparue.
   */
  inchangeDepuis: string | null;
  /** Nombre de versions distinctes observées (sur la fenêtre interrogée). */
  versions: number;
}

export interface OptionsArchive {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Nombre de versions récentes demandées (une ligne par changement de contenu). */
  limite?: number;
}

/** 20150312094500 → 2015-03-12 */
export function dateDepuisHorodatage(horodatage: string): string | null {
  const trouve = /^(\d{4})(\d{2})(\d{2})/.exec(horodatage);
  return trouve ? `${trouve[1]}-${trouve[2]}-${trouve[3]}` : null;
}

async function interroge(
  params: Record<string, string>,
  options: OptionsArchive,
): Promise<string[][]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), options.timeoutMs ?? 12_000);
  try {
    const res = await fetchImpl(`${CDX}?${new URLSearchParams(params).toString()}`, {
      headers: { Accept: "application/json" },
      signal: controleur.signal,
    });
    if (!res.ok) throw new Error(`Internet Archive ${res.status}`);
    const donnees = (await res.json()) as unknown;
    if (!Array.isArray(donnees) || donnees.length < 2) return [];
    // La première ligne est l'en-tête des colonnes.
    return (donnees.slice(1) as string[][]).filter((ligne) => Array.isArray(ligne) && ligne.length);
  } finally {
    clearTimeout(minuteur);
  }
}

/**
 * Historique d'une page d'accueil. Retourne `null` si l'archive ne connaît pas le site : c'est
 * une information manquante, pas un défaut — un site neuf n'a simplement pas d'historique.
 */
export async function collecteArchive(
  url: string,
  options: OptionsArchive = {},
): Promise<ArchiveSite | null> {
  let hote: string;
  try {
    hote = new URL(url).hostname;
  } catch {
    return null;
  }

  const commun = {
    url: hote,
    output: "json",
    fl: "timestamp,digest",
    filter: "statuscode:200",
    collapse: "digest",
  };

  // `limit` négatif : les N dernières lignes, donc les versions les plus récentes.
  const recentes = await interroge(
    { ...commun, limit: String(-(options.limite ?? 40)) },
    options,
  );
  if (!recentes.length) return null;

  const premiere = await interroge({ ...commun, limit: "1" }, options).catch(() => []);

  const horodatages = recentes.map(([horodatage]) => horodatage).filter(Boolean).sort();
  return {
    premiereCapture: dateDepuisHorodatage(premiere[0]?.[0] ?? horodatages[0] ?? ""),
    derniereCapture: dateDepuisHorodatage(horodatages[horodatages.length - 1] ?? ""),
    inchangeDepuis: dateDepuisHorodatage(horodatages[horodatages.length - 1] ?? ""),
    versions: horodatages.length,
  };
}

/** Nombre d'années écoulées depuis une date ISO, ou null si la date est inexploitable. */
export function anneesDepuis(dateIso: string | null, maintenant = new Date()): number | null {
  if (!dateIso) return null;
  const date = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return (maintenant.getTime() - date.getTime()) / (365.25 * 24 * 3600 * 1000);
}
