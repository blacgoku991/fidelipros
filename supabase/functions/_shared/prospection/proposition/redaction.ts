// Rédaction des livrables commerciaux : synthèse, email, SMS, script d'appel, rapport HTML.
//
// Tout est déterministe et testable. L'IA (voir ia.ts) ne fait que reformuler ces textes :
// si elle est indisponible, ces versions partent telles quelles.

import { LIBELLES_EFFORT, LIBELLES_PILIERS, LIBELLES_SEVERITE } from "../audit/regles.ts";
import { compteParSeverite, resumeSeverites } from "../audit/score.ts";
import { echappeHtml } from "../audit/html.ts";
import type { Finding, Pilier } from "../audit/types.ts";
import { euros } from "./devis.ts";
import type { ContexteProposition } from "./types.ts";

const PILIERS: Pilier[] = ["seo", "design", "securite", "technique"];

function nomCommercial(prospect: ContexteProposition["prospect"]): string {
  return prospect.enseigne?.trim() || prospect.nom;
}

function prenomDirigeant(dirigeant: string | null | undefined): string | null {
  if (!dirigeant) return null;
  const propre = dirigeant.replace(/\s+/g, " ").trim();
  return propre || null;
}

/** Synthèse en trois phrases, orientée conséquence commerciale. */
export function synthese(ctx: ContexteProposition): string {
  const nom = nomCommercial(ctx.prospect);
  if (!ctx.audit || ctx.prospect.site_statut === "aucun_site") {
    return (
      `${nom} n'a aujourd'hui aucun site web à son nom. ` +
      `Les clients qui cherchent un professionnel du secteur en ligne trouvent donc uniquement les concurrents. ` +
      `Un site vitrine et une fiche Google correctement remplie suffisent à capter ces recherches.`
    );
  }

  const compte = compteParSeverite(ctx.audit.findings);
  const global = ctx.audit.scores.global;
  const debut = `Le site de ${nom} obtient ${global}/100 à notre audit (${resumeSeverites(ctx.audit.findings)}).`;
  const milieu = ctx.arguments.length
    ? ` Les points les plus coûteux : ${ctx.arguments.map((f) => f.titre.toLowerCase()).join(", ")}.`
    : "";
  const fin = compte.critique
    ? ` Les défauts critiques se corrigent avant tout le reste : ils empêchent le site de vous rapporter des clients.`
    : ` Une intervention ciblée suffit à remettre le site au niveau de vos concurrents.`;
  return debut + milieu + fin;
}

/** Email de prise de contact : trois arguments, une proposition claire, un opt-out. */
export function emailPriseContact(ctx: ContexteProposition): { objet: string; corps: string } {
  const nom = nomCommercial(ctx.prospect);
  const ville = ctx.prospect.ville ?? "";
  const dirigeant = prenomDirigeant(ctx.prospect.dirigeant);
  const sansSite = !ctx.audit || ctx.prospect.site_statut === "aucun_site";

  const objet = sansSite
    ? `${nom} : votre site web (audit offert)`
    : `${nom} : ${ctx.audit!.findings.length} points à corriger sur votre site`;

  const salutation = dirigeant ? `Bonjour ${dirigeant},` : "Bonjour,";
  const accroche = sansSite
    ? `Je cherchais un professionnel comme vous${ville ? ` à ${ville}` : ""} et je n'ai trouvé aucun site à votre nom — seulement vos concurrents.`
    : `J'ai analysé le site de ${nom} ce matin. Il obtient ${ctx.audit!.scores.global}/100 sur les critères que Google et vos visiteurs regardent.`;

  const listeArguments = ctx.arguments
    .map((f) => `• ${f.titre} — ${f.impact}`)
    .join("\n");

  const chiffrage = ctx.devis.total_ht > 0
    ? `\nJ'ai préparé un devis détaillé : ${euros(ctx.devis.total_ht)} HT pour l'ensemble` +
      (ctx.devis.mensuel_ht > 0 ? `, puis ${euros(ctx.devis.mensuel_ht)} HT par mois pour le suivi` : "") +
      `. Chaque ligne correspond à un point précis de l'audit, rien de superflu.\n`
    : "";

  const corps = [
    salutation,
    "",
    accroche,
    "",
    sansSite ? "Concrètement, ce que vous perdez aujourd'hui :" : "Les trois points qui vous coûtent le plus :",
    listeArguments || "• Aucune présence en ligne exploitable",
    chiffrage,
    `Je peux vous envoyer le rapport complet (${ctx.audit ? ctx.audit.findings.length : 0} points vérifiés, gratuit et sans engagement) ou vous l'expliquer en 15 minutes au téléphone. Quel créneau vous arrange cette semaine ?`,
    "",
    "Bien à vous,",
    [ctx.emetteur.raison_sociale, ctx.emetteur.telephone, ctx.emetteur.email].filter(Boolean).join(" — "),
    "",
    "—",
    "Vous recevez ce message à titre professionnel. Vos coordonnées d'entreprise proviennent de l'annuaire public des entreprises (données Sirene en open data) et de votre site. Répondez « STOP » et je supprime immédiatement vos données de mon fichier.",
  ].join("\n");

  return { objet, corps };
}

/** SMS court : un seul argument, une question. */
export function sms(ctx: ContexteProposition): string {
  const nom = nomCommercial(ctx.prospect);
  const argument = ctx.arguments[0];
  const accroche = argument
    ? `${argument.titre.toLowerCase()}`
    : "aucun site web à votre nom";
  return (
    `Bonjour, ${ctx.emetteur.raison_sociale}. J'ai regardé la présence en ligne de ${nom} : ${accroche}. ` +
    `Je vous envoie l'audit complet gratuitement ? ${ctx.emetteur.email}. STOP pour ne plus être contacté.`
  ).slice(0, 480);
}

/** Script d'appel : accroche, qualification, objections, conclusion. */
export function scriptAppel(ctx: ContexteProposition): string {
  const nom = nomCommercial(ctx.prospect);
  const sansSite = !ctx.audit || ctx.prospect.site_statut === "aucun_site";
  const lignes: string[] = [];

  lignes.push(`SCRIPT D'APPEL — ${nom}${ctx.prospect.ville ? ` (${ctx.prospect.ville})` : ""}`);
  lignes.push("");
  lignes.push("1. ACCROCHE (15 secondes)");
  lignes.push(
    sansSite
      ? `« Bonjour, ${ctx.emetteur.raison_sociale}. Je vous appelle parce que j'ai cherché votre entreprise en ligne et je n'ai trouvé aucun site à votre nom. Est-ce un choix de votre part, ou c'est un projet que vous avez repoussé ? »`
      : `« Bonjour, ${ctx.emetteur.raison_sociale}. J'ai analysé votre site ce matin, il obtient ${ctx.audit!.scores.global} sur 100 sur les critères de Google. Vous avez deux minutes, je vous dis les trois points qui vous coûtent des clients ? »`,
  );
  lignes.push("");
  lignes.push("2. LES POINTS À ANNONCER");
  ctx.arguments.forEach((f, i) => {
    lignes.push(`   ${i + 1}. ${f.titre}`);
    lignes.push(`      Constat : ${f.constat}`);
    lignes.push(`      À dire : « ${f.impact} »`);
  });
  lignes.push("");
  lignes.push("3. QUALIFICATION");
  lignes.push("   • Qui s'occupe du site aujourd'hui ? (agence, neveu, personne)");
  lignes.push("   • Combien de demandes vous arrivent par le site chaque mois ?");
  lignes.push("   • Vous avez déjà budgété quelque chose là-dessus cette année ?");
  lignes.push("");
  lignes.push("4. OBJECTIONS");
  lignes.push("   « C'est trop cher » → « Le devis est découpé par priorité. On peut ne traiter que le point critique d'abord, c'est " +
    (ctx.devis.lignes_projet[0] ? euros(ctx.devis.lignes_projet[0].total) : "un budget réduit") + " HT. »");
  lignes.push("   « J'ai déjà quelqu'un » → « Parfait. Je vous envoie le rapport, vous le transmettez, il verra les points à corriger. Si ça reste en attente, rappelez-moi. »");
  lignes.push("   « Ça marche très bien comme ça » → « Combien de clients vous disent qu'ils vous ont trouvé sur Google ? C'est justement ce qu'on peut faire progresser. »");
  lignes.push("   « Envoyez-moi un mail » → « Je le fais dans l'heure. Je vous rappelle vendredi pour votre avis, ça vous va ? »");
  lignes.push("");
  lignes.push("5. CONCLUSION");
  lignes.push(
    `   « Je vous envoie le rapport complet et le devis à ${euros(ctx.devis.total_ht)} HT` +
      (ctx.devis.mensuel_ht ? ` plus ${euros(ctx.devis.mensuel_ht)} HT par mois de suivi` : "") +
      `. On se rappelle en fin de semaine pour en discuter ? »`,
  );
  return lignes.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Rapport HTML (imprimable en PDF)
// ─────────────────────────────────────────────────────────────────────────────

function couleurScore(score: number): string {
  if (score >= 80) return "#0f9d58";
  if (score >= 55) return "#f4b400";
  if (score >= 35) return "#ef6c00";
  return "#d93025";
}

function jauge(label: string, score: number): string {
  return `
    <div class="jauge">
      <div class="jauge-entete"><span>${echappeHtml(label)}</span><strong>${score}/100</strong></div>
      <div class="jauge-piste"><div class="jauge-remplissage" style="width:${score}%;background:${couleurScore(score)}"></div></div>
    </div>`;
}

function tableauFindings(findings: Finding[]): string {
  if (!findings.length) {
    return `<p class="ok">Aucun défaut relevé sur ce volet.</p>`;
  }
  const lignes = findings
    .map(
      (f) => `
      <tr>
        <td><span class="badge badge-${f.severite}">${LIBELLES_SEVERITE[f.severite]}</span></td>
        <td>
          <strong>${echappeHtml(f.titre)}</strong>
          <div class="constat">${echappeHtml(f.constat)}</div>
          <div class="impact">${echappeHtml(f.impact)}</div>
        </td>
        <td class="effort">${LIBELLES_EFFORT[f.effort]}</td>
      </tr>`,
    )
    .join("");
  return `<table class="findings"><tbody>${lignes}</tbody></table>`;
}

function tableauDevis(ctx: ContexteProposition): string {
  const { devis } = ctx;
  const ligne = (l: (typeof devis.lignes_projet)[number]) => `
    <tr>
      <td>
        <strong>${echappeHtml(l.libelle)}</strong>
        ${l.description ? `<div class="constat">${echappeHtml(l.description)}</div>` : ""}
        ${l.motifs.length ? `<div class="motifs">Corrige : ${echappeHtml(l.motifs.slice(0, 4).join(" · "))}</div>` : ""}
      </td>
      <td class="nombre">${l.quantite}</td>
      <td class="nombre">${euros(l.prix_unitaire)}${l.unite === "mois" ? " / mois" : ""}</td>
      <td class="nombre">${euros(l.total)}${l.unite === "mois" ? " / mois" : ""}</td>
    </tr>`;

  return `
    <table class="devis">
      <thead><tr><th>Prestation</th><th class="nombre">Qté</th><th class="nombre">P.U. HT</th><th class="nombre">Total HT</th></tr></thead>
      <tbody>
        ${devis.lignes_projet.map(ligne).join("")}
        ${devis.lignes_recurrentes.length
          ? `<tr class="section"><td colspan="4">Accompagnement mensuel</td></tr>${devis.lignes_recurrentes.map(ligne).join("")}`
          : ""}
      </tbody>
      <tfoot>
        ${devis.remise > 0
          ? `<tr><td colspan="3">Sous-total HT</td><td class="nombre">${euros(devis.sous_total_ht)}</td></tr>
             <tr><td colspan="3">Remise ${Math.round(devis.taux_remise * 100)} %</td><td class="nombre">− ${euros(devis.remise)}</td></tr>`
          : ""}
        <tr><td colspan="3">Total HT</td><td class="nombre">${euros(devis.total_ht)}</td></tr>
        <tr><td colspan="3">TVA ${devis.taux_tva} %</td><td class="nombre">${euros(devis.tva)}</td></tr>
        <tr class="total"><td colspan="3">Total TTC</td><td class="nombre">${euros(devis.total_ttc)}</td></tr>
        ${devis.mensuel_ht > 0
          ? `<tr class="total"><td colspan="3">Puis par mois HT</td><td class="nombre">${euros(devis.mensuel_ht)}</td></tr>`
          : ""}
      </tfoot>
    </table>`;
}

/**
 * Rapport d'audit complet, document HTML autonome (imprimable en PDF).
 * Tout contenu venant du site audité passe par `echappeHtml` : le rapport n'est pas
 * rendu par React et recevrait sinon du HTML tiers non maîtrisé.
 */
export function rapportHtml(ctx: ContexteProposition, syntheseTexte = synthese(ctx)): string {
  const { audit, prospect, emetteur } = ctx;
  const nom = nomCommercial(prospect);
  const scores = audit?.scores;

  const sections = audit
    ? PILIERS.map((pilier) => {
        const findings = audit.findings.filter((f) => f.pilier === pilier);
        return `
        <section class="pilier">
          <h2>${LIBELLES_PILIERS[pilier]} <span class="note" style="color:${couleurScore(scores![pilier])}">${scores![pilier]}/100</span></h2>
          ${tableauFindings(findings)}
        </section>`;
      }).join("")
    : `<section class="pilier"><h2>Présence en ligne</h2>
        <p class="ok">Aucun site web n'a été trouvé pour cette entreprise : il n'y a donc rien à auditer, tout est à construire.</p>
       </section>`;

  return `<article class="rapport">
  <style>
    .rapport { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; background: #fff; max-width: 820px; margin: 0 auto; padding: 32px; line-height: 1.5; }
    .rapport h1 { font-size: 26px; margin: 0 0 4px; }
    .rapport h2 { font-size: 17px; margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #e5e5e5; display: flex; justify-content: space-between; align-items: baseline; }
    .rapport h3 { font-size: 15px; margin: 20px 0 8px; }
    .rapport p { margin: 0 0 10px; }
    .entete { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 14px; }
    .entete .emetteur { text-align: right; font-size: 12px; color: #555; }
    .meta { font-size: 13px; color: #555; }
    .global { display: flex; gap: 20px; align-items: center; margin: 22px 0; padding: 16px; border: 1px solid #e5e5e5; border-radius: 12px; }
    .global .chiffre { font-size: 44px; font-weight: 600; line-height: 1; }
    .global .chiffre small { font-size: 15px; font-weight: 400; color: #666; }
    .jauges { flex: 1; display: grid; gap: 8px; }
    .jauge-entete { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; }
    .jauge-piste { height: 7px; background: #eee; border-radius: 4px; overflow: hidden; }
    .jauge-remplissage { height: 100%; border-radius: 4px; }
    .synthese { background: #f7f7f8; border-left: 3px solid #1a1a1a; padding: 12px 14px; border-radius: 0 8px 8px 0; }
    .capture { margin: 18px 0; text-align: center; }
    .capture img { max-width: 300px; border: 1px solid #ddd; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .findings td { padding: 9px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
    .findings td:first-child { width: 92px; }
    .constat { color: #555; font-size: 12px; margin-top: 2px; }
    .impact { color: #1a1a1a; font-size: 12px; margin-top: 4px; font-style: italic; }
    .motifs { color: #777; font-size: 11px; margin-top: 3px; }
    .effort { width: 70px; text-align: right; color: #666; font-size: 12px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .badge-critique { background: #fdecea; color: #b3261e; }
    .badge-majeur { background: #fff4e5; color: #a35200; }
    .badge-mineur { background: #eef1f4; color: #4a5560; }
    .ok { color: #0f9d58; font-size: 13px; }
    .devis th { text-align: left; padding: 8px; border-bottom: 2px solid #1a1a1a; font-size: 12px; }
    .devis td { padding: 9px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
    .devis .section td { background: #f7f7f8; font-weight: 600; font-size: 12px; }
    .devis tfoot td { padding: 7px 8px; font-size: 13px; }
    .devis tfoot .total td { font-weight: 700; font-size: 15px; border-top: 2px solid #1a1a1a; }
    .nombre { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .mentions { margin-top: 26px; padding-top: 12px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #666; }
    @media print { .rapport { padding: 0; max-width: none; } .pilier { break-inside: avoid; } }
  </style>

  <header class="entete">
    <div>
      <h1>Audit de présence en ligne</h1>
      <div class="meta">${echappeHtml(nom)}${prospect.ville ? ` — ${echappeHtml(prospect.ville)}` : ""}</div>
      ${audit?.urlFinale ? `<div class="meta">${echappeHtml(audit.urlFinale)}</div>` : ""}
    </div>
    <div class="emetteur">
      <strong>${echappeHtml(emetteur.raison_sociale)}</strong><br>
      ${echappeHtml(emetteur.adresse)}<br>
      ${echappeHtml(emetteur.email)}${emetteur.telephone ? ` — ${echappeHtml(emetteur.telephone)}` : ""}
      ${emetteur.siret ? `<br>SIRET ${echappeHtml(emetteur.siret)}` : ""}
    </div>
  </header>

  ${scores
      ? `<div class="global">
      <div class="chiffre" style="color:${couleurScore(scores.global)}">${scores.global}<small>/100</small></div>
      <div class="jauges">
        ${PILIERS.map((pilier) => jauge(LIBELLES_PILIERS[pilier], scores[pilier])).join("")}
      </div>
    </div>`
      : ""}

  <p class="synthese">${echappeHtml(syntheseTexte)}</p>

  ${audit?.captureDataUri
      ? `<div class="capture"><img src="${echappeHtml(audit.captureDataUri)}" alt="Aperçu du site sur mobile"><div class="meta">Aperçu mobile du site</div></div>`
      : ""}

  ${sections}

  <section>
    <h2>Proposition chiffrée</h2>
    ${tableauDevis(ctx)}
    <p class="meta">Devis valable jusqu'au ${echappeHtml(ctx.devis.valide_jusqu_au)}.</p>
  </section>

  <footer class="mentions">
    ${echappeHtml(emetteur.mentions)}<br>
    Audit réalisé le ${new Date().toLocaleDateString("fr-FR")} par lecture publique du site et des enregistrements DNS du domaine,
    sans aucune intrusion ni test d'authentification. Données d'entreprise issues de l'open data Sirene.
    ${audit?.erreurs.length ? `<br>Points non vérifiables lors de l'audit : ${echappeHtml(audit.erreurs.join(" · "))}.` : ""}
  </footer>
</article>`;
}

/** Rapport autonome, prêt à être enregistré en fichier .html. */
export function rapportHtmlAutonome(ctx: ContexteProposition, syntheseTexte?: string): string {
  const nom = nomCommercial(ctx.prospect);
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Audit — ${echappeHtml(nom)}</title></head>
<body style="margin:0;background:#f5f5f5">
${rapportHtml(ctx, syntheseTexte)}
</body></html>`;
}
