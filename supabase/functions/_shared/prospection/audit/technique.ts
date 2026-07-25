// Règles techniques : disponibilité, vitesse serveur, poids, compression, cache, protocole.

import { constate } from "./regles.ts";
import type { ContexteAudit, Finding } from "./types.ts";

export function evalueTechnique(ctx: ContexteAudit): Finding[] {
  const findings: Finding[] = [];
  const accueil = ctx.accueil;

  if (!accueil) {
    findings.push(constate("tech_site_injoignable", `Aucune réponse de ${ctx.url} (domaine, hébergement ou certificat en cause)`));
    return findings;
  }
  if (accueil.statut >= 400) {
    findings.push(constate("tech_erreur_http", `La page d'accueil renvoie un code HTTP ${accueil.statut}`));
    return findings;
  }

  const lh = ctx.lighthouse;
  const entetes = accueil.entetes;

  if (lh?.performance !== null && lh?.performance !== undefined && lh.performance < 50) {
    findings.push(constate("tech_perf_faible", `Note de performance mobile Google : ${lh.performance}/100`));
  }

  const octets = lh?.octets ?? accueil.octets;
  if (octets > 2_000_000) {
    findings.push(constate("tech_page_lourde", `${(octets / 1_000_000).toFixed(1)} Mo chargés sur la page d'accueil`));
  }
  if (lh?.requetes !== null && lh?.requetes !== undefined && lh.requetes > 80) {
    findings.push(constate("tech_trop_de_requetes", `${lh.requetes} fichiers chargés pour afficher la page`));
  }

  const compression = entetes["content-encoding"] ?? "";
  if (!/(gzip|br|zstd|deflate)/i.test(compression) && accueil.octets > 50_000) {
    findings.push(constate("tech_compression_absente", "La page est servie sans compression (aucun content-encoding)"));
  }

  if (lh?.audits?.["uses-long-cache-ttl"] && !lh.audits["uses-long-cache-ttl"].reussi) {
    findings.push(constate("tech_cache_absent", "Google relève des fichiers servis sans durée de cache"));
  }

  const dureeServeur = lh?.audits?.["server-response-time"];
  if ((dureeServeur && !dureeServeur.reussi) || accueil.dureeMs > 1500) {
    findings.push(constate("tech_ttfb_lent", `Première réponse du serveur en ${(accueil.dureeMs / 1000).toFixed(1)} s`));
  }

  // alt-svc annonce HTTP/3 ; son absence combinée à une réponse lente trahit un hébergement daté.
  if (!entetes["alt-svc"] && accueil.dureeMs > 1000) {
    findings.push(constate("tech_http2_absent", "Aucune annonce HTTP/3 (en-tête alt-svc) et réponse serveur lente"));
  }

  if (lh?.audits?.["errors-in-console"] && !lh.audits["errors-in-console"].reussi) {
    findings.push(constate("tech_erreurs_console", "Google relève des erreurs JavaScript au chargement"));
  }

  return findings;
}
