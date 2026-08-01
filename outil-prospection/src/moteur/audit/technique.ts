// Règles techniques : disponibilité, vitesse serveur, poids, compression, cache, protocole.

import { constate } from "./regles.ts";
import type { ContexteAudit, Finding } from "./types.ts";

export function evalueTechnique(ctx: ContexteAudit): Finding[] {
  const findings: Finding[] = [];
  const accueil = ctx.accueil;

  // Un site que nous n'avons pas pu voir (pare-feu applicatif, blocage réseau) ne produit
  // aucun constat : l'audit est non concluant, il n'y a rien à affirmer au prospect.
  if (ctx.accessibilite === "bloque") return findings;

  if (!accueil) {
    if (ctx.accessibilite === "injoignable") {
      findings.push(
        constate("tech_site_injoignable", `Le domaine de ${ctx.url} ne résout pas : aucun site en ligne`),
      );
    }
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

  // TTFB : uniquement la vraie mesure de Google (server-response-time). `accueil.dureeMs`
  // inclut le téléchargement du corps ET la latence de notre propre réseau — ce n'est pas le
  // temps de réponse du serveur, on ne le présente donc pas comme tel (zéro donnée mal étiquetée).
  const dureeServeur = lh?.audits?.["server-response-time"];
  if (dureeServeur && !dureeServeur.reussi) {
    findings.push(constate(
      "tech_ttfb_lent",
      "Google relève un temps de réponse du serveur trop élevé (audit « server-response-time » échoué)",
    ));
  }

  // Le protocole HTTP négocié (HTTP/1.1 vs 2 vs 3) n'est pas exposé par fetch : impossible de
  // le mesurer de façon fiable. On ne devine pas depuis l'absence d'un en-tête `alt-svc`
  // (que la plupart des sites HTTP/2 n'envoient jamais) — le check était un faux positif.

  if (lh?.audits?.["errors-in-console"] && !lh.audits["errors-in-console"].reussi) {
    findings.push(constate("tech_erreurs_console", "Google relève des erreurs JavaScript au chargement"));
  }

  // Mesure terrain : ce que subissent les visiteurs, plus défendable qu'un test en laboratoire.
  const terrain = ctx.lighthouse?.terrain;
  if (terrain?.categorie === "SLOW") {
    const details = [
      terrain.lcpMs ? `affichage principal en ${(terrain.lcpMs / 1000).toFixed(1).replace(".", ",")} s` : null,
      terrain.inpMs ? `réaction au clic en ${terrain.inpMs} ms` : null,
    ].filter(Boolean).join(", ");
    findings.push(constate(
      "tech_terrain_lent",
      `Sur les 28 derniers jours${details ? ` : ${details}` : ""} (données Google, visiteurs réels)`,
    ));
  }

  return findings;
}
