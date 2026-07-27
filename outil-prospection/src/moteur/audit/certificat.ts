// Lecture du certificat TLS et de la version du protocole, directement depuis la poignée de
// main. Aucune API, aucune clé : c'est la même information que le cadenas du navigateur.
//
// Seul module du moteur à dépendre de Node (`node:tls`). L'import est dynamique et l'échec est
// silencieux : sur un runtime sans `node:tls`, l'audit continue simplement sans cette mesure.

export interface CertificatTls {
  /** Autorité qui a délivré le certificat (Let's Encrypt, Sectigo…). */
  emetteur: string | null;
  /** Date de fin de validité, au format YYYY-MM-DD. */
  expireLe: string | null;
  /** Jours restants avant expiration (négatif si déjà expiré). */
  joursRestants: number | null;
  /** Version du protocole négociée : TLSv1.2, TLSv1.3… */
  protocole: string | null;
  /** Le certificat couvre-t-il bien le domaine demandé ? */
  domaineCouvert: boolean;
}

export interface OptionsCertificat {
  timeoutMs?: number;
  /** Implémentation injectable pour les tests (évite d'ouvrir une vraie connexion). */
  lecteur?: (hote: string, port: number, timeoutMs: number) => Promise<CertificatTls | null>;
}

/** 2026-09-12T00:00:00Z → 2026-09-12 */
function dateIso(valeur: string | undefined): string | null {
  if (!valeur) return null;
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/**
 * Ouvre une connexion TLS et lit le certificat présenté, sans échanger la moindre donnée
 * applicative. `rejectUnauthorized: false` est nécessaire pour pouvoir *lire* un certificat
 * expiré ou mal émis — c'est justement ce qu'on cherche à constater.
 */
async function litViaNode(hote: string, port: number, timeoutMs: number): Promise<CertificatTls | null> {
  let tls: typeof import("node:tls");
  try {
    tls = await import("node:tls");
  } catch {
    return null;
  }

  return await new Promise<CertificatTls | null>((resolu) => {
    let termine = false;
    const fini = (resultat: CertificatTls | null) => {
      if (termine) return;
      termine = true;
      try {
        socket.destroy();
      } catch {
        // socket déjà fermé
      }
      resolu(resultat);
    };

    const socket = tls.connect(
      { host: hote, port, servername: hote, rejectUnauthorized: false, timeout: timeoutMs },
      () => {
        const certificat = socket.getPeerCertificate();
        if (!certificat || !certificat.valid_to) return fini(null);
        const expiration = new Date(certificat.valid_to);
        const joursRestants = Number.isNaN(expiration.getTime())
          ? null
          : Math.round((expiration.getTime() - Date.now()) / 86_400_000);
        fini({
          emetteur: certificat.issuer?.O ?? certificat.issuer?.CN ?? null,
          expireLe: dateIso(certificat.valid_to),
          joursRestants,
          protocole: socket.getProtocol(),
          domaineCouvert: socket.authorized || socket.authorizationError?.toString() !== "ERR_TLS_CERT_ALTNAME_INVALID",
        });
      },
    );

    socket.setTimeout(timeoutMs, () => fini(null));
    socket.on("error", () => fini(null));
  });
}

/**
 * Certificat présenté par un site en HTTPS. Retourne `null` si la lecture n'a pas abouti :
 * comme partout dans le moteur, une mesure absente ne produit aucun constat.
 */
export async function litCertificat(
  url: string,
  options: OptionsCertificat = {},
): Promise<CertificatTls | null> {
  let cible: URL;
  try {
    cible = new URL(url);
  } catch {
    return null;
  }
  if (cible.protocol !== "https:") return null;

  const port = cible.port ? Number(cible.port) : 443;
  const timeoutMs = options.timeoutMs ?? 8000;
  const lecteur = options.lecteur ?? litViaNode;
  try {
    return await lecteur(cible.hostname, port, timeoutMs);
  } catch {
    return null;
  }
}

/** Versions de TLS encore acceptables aujourd'hui. */
export const PROTOCOLES_SURS = ["TLSv1.2", "TLSv1.3"];
