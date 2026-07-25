// Notation d'un audit : une note par pilier, une note globale, un niveau d'urgence.

import { LIBELLES_SEVERITE } from "./regles.ts";
import type { Finding, Pilier, ScoresAudit, Severite, Urgence } from "./types.ts";

/** Poids de chaque pilier dans la note globale. */
export const PONDERATION_PILIERS: Record<Pilier, number> = {
  seo: 0.3,
  design: 0.25,
  securite: 0.25,
  technique: 0.2,
};

const ORDRE_SEVERITE: Record<Severite, number> = { critique: 0, majeur: 1, mineur: 2 };

function borne(valeur: number): number {
  return Math.max(0, Math.min(100, Math.round(valeur)));
}

/** Note d'un pilier : 100 moins la somme des poids des défauts constatés. */
export function scorePilier(findings: Finding[], pilier: Pilier): number {
  const penalite = findings
    .filter((f) => f.pilier === pilier)
    .reduce((total, f) => total + f.poids, 0);
  return borne(100 - penalite);
}

function urgenceDepuis(global: number, findings: Finding[]): Urgence {
  const critiques = findings.filter((f) => f.severite === "critique").length;
  if (critiques >= 2 || global < 35) return "critique";
  if (critiques === 1 || global < 55) return "elevee";
  if (global < 80) return "moyenne";
  return "faible";
}

export function calculeScores(findings: Finding[]): ScoresAudit {
  const seo = scorePilier(findings, "seo");
  const design = scorePilier(findings, "design");
  const securite = scorePilier(findings, "securite");
  const technique = scorePilier(findings, "technique");
  const global = borne(
    seo * PONDERATION_PILIERS.seo +
      design * PONDERATION_PILIERS.design +
      securite * PONDERATION_PILIERS.securite +
      technique * PONDERATION_PILIERS.technique,
  );

  return { global, seo, design, securite, technique, urgence: urgenceDepuis(global, findings) };
}

/** Défauts triés par gravité puis par poids : l'ordre d'attaque commerciale. */
export function trieFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) => ORDRE_SEVERITE[a.severite] - ORDRE_SEVERITE[b.severite] || b.poids - a.poids,
  );
}

/**
 * Arguments à mettre en avant dans un email ou un appel : les défauts les plus graves,
 * un seul par pilier pour couvrir plusieurs angles sans se répéter.
 */
export function argumentsCles(findings: Finding[], maximum = 3): Finding[] {
  const retenus: Finding[] = [];
  const pilierVus = new Set<Pilier>();
  for (const finding of trieFindings(findings)) {
    if (pilierVus.has(finding.pilier)) continue;
    pilierVus.add(finding.pilier);
    retenus.push(finding);
    if (retenus.length >= maximum) return retenus;
  }
  // Moins de piliers que d'arguments demandés : on complète avec les suivants.
  for (const finding of trieFindings(findings)) {
    if (retenus.includes(finding)) continue;
    retenus.push(finding);
    if (retenus.length >= maximum) break;
  }
  return retenus;
}

/** Répartition des défauts par gravité, pour l'affichage du rapport. */
export function compteParSeverite(findings: Finding[]): Record<Severite, number> {
  return {
    critique: findings.filter((f) => f.severite === "critique").length,
    majeur: findings.filter((f) => f.severite === "majeur").length,
    mineur: findings.filter((f) => f.severite === "mineur").length,
  };
}

/** Phrase de synthèse du volume de défauts (« 3 problèmes critiques, 5 importants »). */
export function resumeSeverites(findings: Finding[]): string {
  const compte = compteParSeverite(findings);
  const morceaux = (["critique", "majeur", "mineur"] as Severite[])
    .filter((severite) => compte[severite] > 0)
    .map((severite) => `${compte[severite]} ${LIBELLES_SEVERITE[severite].toLowerCase()}${compte[severite] > 1 ? "s" : ""}`);
  return morceaux.length ? morceaux.join(", ") : "aucun défaut bloquant";
}
