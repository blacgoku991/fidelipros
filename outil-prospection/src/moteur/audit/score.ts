// Notation d'un audit : une note par pilier, une note globale, un niveau d'urgence.

import { LIBELLES_SEVERITE } from "./regles.ts";
import type { ContexteAudit, Finding, Pilier, ScoresAudit, Severite, Urgence } from "./types.ts";

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

/**
 * Note globale : moyenne pondérée des volets, en n'incluant que ceux passés en paramètre.
 * Les poids sont renormalisés sur les seuls volets retenus — sans ça, exclure un volet
 * reviendrait à le noter zéro. Volets vides : on retombe sur la moyenne simple par sécurité.
 */
function globalPondere(scores: Record<Pilier, number>, piliersInclus: Pilier[]): number {
  const poidsTotal = piliersInclus.reduce((total, p) => total + PONDERATION_PILIERS[p], 0);
  if (poidsTotal === 0) return 0;
  const somme = piliersInclus.reduce((total, p) => total + scores[p] * PONDERATION_PILIERS[p], 0);
  return borne(somme / poidsTotal);
}

/**
 * Calcule les notes par volet et la note globale.
 *
 * `piliersNonMesures` (volets dont la source de mesure a manqué et qui n'ont produit aucun
 * défaut) sont exclus de la note globale : les inclure reviendrait à leur attribuer un 100
 * fictif qui gonflerait la note. Ils restent présents dans le détail, affichés « non mesuré ».
 */
export function calculeScores(findings: Finding[], piliersNonMesures: Pilier[] = []): ScoresAudit {
  const parPilier: Record<Pilier, number> = {
    seo: scorePilier(findings, "seo"),
    design: scorePilier(findings, "design"),
    securite: scorePilier(findings, "securite"),
    technique: scorePilier(findings, "technique"),
  };
  const exclus = new Set(piliersNonMesures);
  const mesures = (["seo", "design", "securite", "technique"] as Pilier[]).filter((p) => !exclus.has(p));
  // Si tout est non mesuré (cas théorique), on garde tous les volets pour ne pas rendre 0.
  const global = globalPondere(parPilier, mesures.length ? mesures : ["seo", "design", "securite", "technique"]);

  return { global, ...parPilier, urgence: urgenceDepuis(global, findings) };
}

/**
 * Volets « non mesurés » : partiels ET sans aucun défaut constaté. Une source a manqué et rien
 * n'a été trouvé — leur note serait un 100 fictif. C'est ce sous-ensemble qu'on exclut du
 * global et qu'on affiche « non mesuré », par opposition aux volets partiels qui ont quand
 * même relevé de vrais défauts (note plancher).
 */
export function piliersNonMesures(findings: Finding[], partiels: Pilier[]): Pilier[] {
  return partiels.filter((p) => !findings.some((f) => f.pilier === p));
}

/**
 * Volets dont une source de mesure a manqué.
 *
 * Une note se calcule en retirant des points pour chaque défaut constaté : si une source n'a
 * pas répondu, ses défauts éventuels n'ont pas pu être constatés et le volet ressort trop
 * favorable — Lighthouse indisponible et le volet technique afficherait 100/100. On le signale
 * plutôt que de laisser croire à un site parfait sur ce point.
 */
export function piliersPartiels(ctx: ContexteAudit): Pilier[] {
  const partiels = new Set<Pilier>();

  // Lighthouse alimente la performance, l'accessibilité, la note SEO et les Core Web Vitals.
  if (!ctx.lighthouse) {
    partiels.add("technique");
    partiels.add("design");
    partiels.add("seo");
  }
  // Protection email : un résolveur muet ne prouve pas l'absence de SPF ou de DMARC.
  const dns = ctx.dns;
  if (!dns || !dns.spf.verifie || !dns.dmarc.verifie || !dns.mx.verifie) partiels.add("securite");
  // Sondage désactivé (audit rapide) : les fichiers exposés n'ont pas été cherchés.
  if (ctx.fichiersExposes === null) partiels.add("securite");
  // Pages annexes non lues : robots.txt, sitemap et page 404 pèsent sur le référencement.
  if (!ctx.robots || !ctx.sitemap || !ctx.page404) partiels.add("seo");
  // Liens non vérifiés et poids des images non mesuré (audit rapide).
  if (ctx.liens === null) partiels.add("seo");
  if (ctx.imagesMesurees === null) partiels.add("design");

  return (["seo", "design", "securite", "technique"] as Pilier[]).filter((p) => partiels.has(p));
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
