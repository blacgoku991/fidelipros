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

/** « Site non sécurisé » → « site non sécurisé », pour l'insérer dans une phrase. */
/** « BORDEAUX » → « Bordeaux » : les villes arrivent en majuscules depuis Sirene. */
function villeLisible(ville: string | null | undefined): string {
  if (!ville) return "";
  if (ville !== ville.toUpperCase()) return ville;
  return ville.toLowerCase().replace(/(^|[\s'’-])([a-zà-ÿ])/g, (_, avant, lettre) => avant + lettre.toUpperCase());
}

function minuscule(texte: string): string {
  return texte.charAt(0).toLowerCase() + texte.slice(1);
}

function prenomDirigeant(dirigeant: string | null | undefined): string | null {
  if (!dirigeant) return null;
  const propre = dirigeant.replace(/\s+/g, " ").trim();
  return propre || null;
}

/** Vrai quand le site n'a pas pu être observé : on ne peut rien affirmer à son sujet. */
export function auditNonConcluant(ctx: ContexteProposition): boolean {
  return Boolean(ctx.audit && !ctx.audit.concluant);
}

/** Raison lisible de l'échec de l'audit, ponctuée pour s'enchaîner dans une phrase. */
function raisonNonConcluant(ctx: ContexteProposition): string {
  const raison = ctx.audit?.erreurs[0] ?? "Le site n'a pas pu être analysé";
  return /[.!?]$/.test(raison) ? raison : `${raison}.`;
}

/** Synthèse en trois phrases, orientée conséquence commerciale. */
export function synthese(ctx: ContexteProposition): string {
  const nom = nomCommercial(ctx.prospect);

  if (auditNonConcluant(ctx)) {
    return (
      `Le site de ${nom} n'a pas pu être analysé automatiquement : ${raisonNonConcluant(ctx)} ` +
      `Aucune conclusion n'est tirée sur son état, et aucun chiffrage n'est proposé. ` +
      `Une vérification manuelle est nécessaire avant tout contact commercial.`
    );
  }

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

  // Rien n'a pu être observé : pas de message de démarchage, une note de travail interne.
  if (auditNonConcluant(ctx)) {
    return {
      objet: `${nom} : audit à refaire manuellement`,
      corps: [
        `Audit non concluant pour ${nom}.`,
        "",
        raisonNonConcluant(ctx),
        "",
        "Aucun email de prospection n'a été rédigé : il faudrait affirmer des défauts qui n'ont pas",
        "été vérifiés. Ouvrez le site dans un navigateur, ou relancez l'audit depuis un autre réseau,",
        "puis régénérez la proposition.",
      ].join("\n"),
    };
  }
  const ville = villeLisible(ctx.prospect.ville);
  const dirigeant = prenomDirigeant(ctx.prospect.dirigeant);
  const sansSite = !ctx.audit || ctx.prospect.site_statut === "aucun_site";

  // Un objet précis et vérifiable ouvre mieux qu'un décompte de défauts : on met en avant le
  // point le plus grave réellement constaté, jamais une formule commerciale creuse.
  const pire = ctx.arguments[0];
  const objet = sansSite
    ? `${nom} n'apparaît pas sur Google${ville ? ` à ${ville}` : ""}`
    : pire
      ? `${nom} : ${minuscule(pire.titre)}`
      : `${nom} : le point de votre site qui vous coûte des clients`;

  const salutation = dirigeant ? `Bonjour ${dirigeant},` : "Bonjour,";
  const accroche = sansSite
    ? `Je cherchais un professionnel comme vous${ville ? ` à ${ville}` : ""} et je n'ai trouvé aucun site à votre nom — seulement vos concurrents.`
    : `J'ai regardé le site de ${nom}${ville ? ` (${ville})` : ""} ce matin, page par page. Il obtient ${ctx.audit!.scores.global}/100 sur les critères que Google et vos visiteurs regardent, et le détail est mesuré, pas estimé.`;

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
    `Est-ce que je vous envoie le rapport complet${ctx.audit ? ` (${ctx.audit.findings.length} points vérifiés)` : ""} ? C'est gratuit et sans engagement : vous le lisez, et vous faites corriger par qui vous voulez.`,
    "",
    "Un simple « oui » en réponse suffit, ou dites-moi un créneau de 15 minutes cette semaine.",
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
  if (auditNonConcluant(ctx)) {
    return `Audit non concluant pour ${nom} : à vérifier manuellement avant tout contact.`;
  }
  const argument = ctx.arguments[0];
  const accroche = argument
    ? `${argument.titre.toLowerCase()}`
    : "aucun site web à votre nom";
  return (
    `Bonjour, ${ctx.emetteur.raison_sociale}. J'ai regardé le site de ${nom} : ${accroche}. ` +
    `Je vous envoie le rapport détaillé, gratuitement ? Répondez OUI. ${ctx.emetteur.email} — STOP pour ne plus être contacté.`
  ).slice(0, 480);
}

/** Script d'appel : accroche, qualification, objections, conclusion. */
export function scriptAppel(ctx: ContexteProposition): string {
  const nom = nomCommercial(ctx.prospect);
  if (auditNonConcluant(ctx)) {
    return [
      `AUCUN SCRIPT — audit non concluant pour ${nom}`,
      "",
      raisonNonConcluant(ctx),
      "",
      "Vérifiez le site à la main (ou relancez l'audit depuis un autre réseau) avant d'appeler :",
      "annoncer des défauts non vérifiés vous décrédibiliserait dès la première minute.",
    ].join("\n");
  }
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

/** 2026-08-25 → 25/08/2026 : personne n'écrit une date en ISO dans un email. */
function dateFr(iso: string): string {
  const trouve = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return trouve ? `${trouve[3]}/${trouve[2]}/${trouve[1]}` : iso;
}

function couleurScore(score: number): string {
  if (score >= 80) return "#0f9d58";
  if (score >= 55) return "#f4b400";
  if (score >= 35) return "#ef6c00";
  return "#d93025";
}

// ─────────────────────────────────────────────────────────────────────────────
// Email HTML (prêt à coller dans Gmail / Outlook)
// ─────────────────────────────────────────────────────────────────────────────

// Contraintes des clients mail : mise en page en tableaux, styles en ligne uniquement,
// largeur 600 px, fond clair (le mode sombre des clients mail est imprévisible), aucune
// image distante. Le contenu est celui de l'email texte — même message, mise en forme lisible.

const POLICE_EMAIL =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

interface BlocEmail {
  genre: "paragraphe" | "arguments" | "signature" | "mentions";
  lignes: string[];
}

/** Découpe le corps texte en blocs, pour habiller chacun selon sa nature. */
function decoupeCorps(corps: string): BlocEmail[] {
  const blocs: BlocEmail[] = [];
  const estPuce = (ligne: string) => /^[•\-*]\s+/.test(ligne);

  for (const brut of corps.split(/\n\s*\n/)) {
    const lignes = brut.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lignes.length) continue;
    if (lignes.some(estPuce)) {
      // « Les trois points qui vous coûtent le plus : » suivi des puces, sans ligne vide :
      // l'introduction reste un paragraphe, les puces deviennent des cartes.
      const introduction = lignes.filter((l) => !estPuce(l));
      const puces = lignes.filter(estPuce).map((l) => l.replace(/^[•\-*]\s+/, ""));
      if (introduction.length) blocs.push({ genre: "paragraphe", lignes: introduction });
      blocs.push({ genre: "arguments", lignes: puces });
    } else if (lignes[0] === "—" || lignes.some((l) => /STOP|open data|droit d'opposition/i.test(l))) {
      blocs.push({ genre: "mentions", lignes: lignes.filter((l) => l !== "—") });
    } else if (/^(bien à vous|cordialement|bien cordialement|à bientôt)/i.test(lignes[0])) {
      blocs.push({ genre: "signature", lignes });
    } else {
      blocs.push({ genre: "paragraphe", lignes });
    }
  }
  return blocs;
}

function paragrapheEmail(texte: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1f2430">${echappeHtml(texte)}</p>`;
}

/** Un défaut = une carte : le titre, ce que ça coûte, et la mesure qui le prouve. */
function carteArgument(titre: string, ctx: ContexteProposition): string {
  const finding = ctx.arguments.find((f) => titre.startsWith(f.titre)) ?? null;
  const [libelle, suite] = finding
    ? [finding.titre, finding.impact]
    : [titre.split(" — ")[0], titre.split(" — ").slice(1).join(" — ")];
  const constat = finding?.constat;

  return `
        <tr><td style="padding:0 0 10px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:#f7f8fa;border-left:3px solid #d93025;border-radius:0 6px 6px 0">
            <tr><td style="padding:12px 14px">
              <div style="font-size:15px;font-weight:600;color:#1f2430">${echappeHtml(libelle)}</div>
              ${constat ? `<div style="font-size:13px;color:#6b7280;margin-top:3px">${echappeHtml(constat)}</div>` : ""}
              ${suite ? `<div style="font-size:14px;color:#374151;margin-top:5px;line-height:1.5">${echappeHtml(suite)}</div>` : ""}
            </td></tr>
          </table>
        </td></tr>`;
}

function bandeauScore(ctx: ContexteProposition): string {
  const scores = ctx.audit?.scores;
  if (!scores) return "";
  const volets = PILIERS.map((pilier) => `
            <td width="25%" align="center" style="padding:8px 4px">
              <div style="font-size:20px;font-weight:700;color:${couleurScore(scores[pilier])}">${scores[pilier]}</div>
              <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">${echappeHtml(LIBELLES_PILIERS[pilier])}</div>
            </td>`).join("");

  return `
        <tr><td style="padding:4px 0 18px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="border:1px solid #e5e7eb;border-radius:8px">
            <tr><td align="center" style="padding:14px 10px 4px">
              <div style="font-size:34px;font-weight:700;line-height:1;color:${couleurScore(scores.global)}">
                ${scores.global}<span style="font-size:15px;color:#9ca3af">/100</span></div>
              <div style="font-size:12px;color:#6b7280;margin-top:4px">Note globale de votre site</div>
            </td></tr>
            <tr><td style="padding:0 6px 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${volets}</tr></table></td></tr>
          </table>
        </td></tr>`;
}

function encadreDevis(ctx: ContexteProposition): string {
  const { devis } = ctx;
  if (!devis.lignes_projet.length && !devis.lignes_recurrentes.length) return "";
  const lignes = [...devis.lignes_projet, ...devis.lignes_recurrentes]
    .map((ligne) => `
              <tr>
                <td style="padding:5px 0;font-size:14px;color:#374151">${echappeHtml(ligne.libelle)}</td>
                <td align="right" style="padding:5px 0;font-size:14px;color:#1f2430;white-space:nowrap">
                  ${echappeHtml(euros(ligne.total))}${ligne.unite === "mois" ? " / mois" : ""}</td>
              </tr>`).join("");

  return `
        <tr><td style="padding:4px 0 18px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:#f0f6ff;border:1px solid #d6e4ff;border-radius:8px">
            <tr><td style="padding:14px 16px">
              <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#1d4ed8">Ce que je propose</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px">
                ${lignes}
                <tr><td colspan="2" style="border-top:1px solid #d6e4ff;padding-top:8px"></td></tr>
                <tr>
                  <td style="font-size:15px;font-weight:700;color:#1f2430">Total</td>
                  <td align="right" style="font-size:15px;font-weight:700;color:#1f2430;white-space:nowrap">
                    ${echappeHtml(euros(devis.total_ht))} HT${devis.mensuel_ht > 0 ? ` + ${echappeHtml(euros(devis.mensuel_ht))} / mois` : ""}</td>
                </tr>
              </table>
              <div style="font-size:12px;color:#6b7280;margin-top:8px">
                Devis valable jusqu'au ${echappeHtml(dateFr(devis.valide_jusqu_au))}. ${echappeHtml(ctx.emetteur.mentions)}</div>
            </td></tr>
          </table>
        </td></tr>`;
}

/**
 * Version HTML de l'email de prise de contact, prête à coller dans un client mail.
 * Reprend exactement le texte de `emailPriseContact` (ou sa reformulation IA) et l'habille :
 * notes de l'audit, défauts en cartes, chiffrage, bouton de réponse, mentions CNIL.
 */
export function emailHtml(
  ctx: ContexteProposition,
  email: { objet: string; corps: string } = emailPriseContact(ctx),
): string {
  const nom = nomCommercial(ctx.prospect);
  const emetteur = ctx.emetteur;
  const nonConcluant = auditNonConcluant(ctx);
  const blocs = decoupeCorps(email.corps);

  // Audit non concluant : l'email texte est une note de travail interne. On ne fabrique pas
  // un message commercial habillé par-dessus.
  if (nonConcluant) {
    return `<div style="font-family:${POLICE_EMAIL};max-width:600px;padding:16px;background:#fff8e1;border:1px solid #f5d76e;border-radius:8px;color:#7a5c00">
  <strong>Aucun email à envoyer : audit non concluant pour ${echappeHtml(nom)}.</strong>
  <p style="margin:8px 0 0;font-size:14px;line-height:1.6">${echappeHtml(raisonNonConcluant(ctx))}</p>
</div>`;
  }

  const contenu = blocs.map((bloc) => {
    switch (bloc.genre) {
      case "arguments":
        return `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${bloc.lignes.map((ligne) => carteArgument(ligne, ctx)).join("")}</table></td></tr>
          <tr><td style="height:6px"></td></tr>`;
      case "signature":
        return `<tr><td style="padding:6px 0 0;font-size:15px;line-height:1.6;color:#1f2430">
          ${bloc.lignes.map((l) => echappeHtml(l)).join("<br>")}</td></tr>`;
      case "mentions":
        return "";
      default:
        return `<tr><td>${bloc.lignes.map(paragrapheEmail).join("")}</td></tr>`;
    }
  });

  const mentions = blocs.filter((b) => b.genre === "mentions").flatMap((b) => b.lignes);
  const sujetReponse = encodeURIComponent(`Re: ${email.objet}`);

  return `<div style="margin:0;padding:0;background:#eef0f4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef0f4;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
           style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:${POLICE_EMAIL}">

      <tr><td style="background:#111827;padding:18px 24px">
        <div style="font-size:16px;font-weight:700;color:#ffffff">${echappeHtml(emetteur.raison_sociale)}</div>
        <div style="font-size:12px;color:#9ca3af;margin-top:2px">Audit de présence en ligne — ${echappeHtml(nom)}</div>
      </td></tr>

      <tr><td style="padding:22px 24px 4px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${bandeauScore(ctx)}
          ${contenu.join("")}
          ${encadreDevis(ctx)}
          <tr><td align="center" style="padding:6px 0 18px">
            <a href="mailto:${echappeHtml(emetteur.email)}?subject=${sujetReponse}"
               style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 26px;border-radius:8px">
              Recevoir le rapport complet</a>
            <div style="font-size:12px;color:#6b7280;margin-top:8px">Gratuit et sans engagement — répondez simplement à cet email.</div>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="background:#f7f8fa;border-top:1px solid #e5e7eb;padding:16px 24px">
        <div style="font-size:13px;color:#374151">
          ${[emetteur.raison_sociale, emetteur.telephone, emetteur.email].filter(Boolean).map((v) => echappeHtml(v)).join(" — ")}
        </div>
        ${emetteur.siret ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">SIRET ${echappeHtml(emetteur.siret)}${emetteur.adresse ? ` — ${echappeHtml(emetteur.adresse)}` : ""}</div>` : ""}
        ${mentions.length ? `<div style="font-size:11px;color:#9ca3af;line-height:1.5;margin-top:10px">${mentions.map((l) => echappeHtml(l)).join(" ")}</div>` : ""}
      </td></tr>
    </table>
  </td></tr>
</table>
</div>`;
}

/** Fichier .html autonome, pour ouvrir l'email dans un navigateur avant de le coller. */
export function emailHtmlAutonome(
  ctx: ContexteProposition,
  email: { objet: string; corps: string } = emailPriseContact(ctx),
): string {
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echappeHtml(email.objet)}</title></head>
<body style="margin:0;background:#eef0f4">
${emailHtml(ctx, email)}
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rapport HTML (imprimable en PDF)
// ─────────────────────────────────────────────────────────────────────────────

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
  const nonConcluant = auditNonConcluant(ctx);
  // Un audit non concluant n'affiche aucune note : elles ne mesureraient rien.
  const scores = nonConcluant ? undefined : audit?.scores;

  const sections = nonConcluant
    ? `<section class="pilier">
        <h2>Analyse impossible</h2>
        <p class="alerte">
          ${echappeHtml(raisonNonConcluant(ctx))}
          Aucun défaut n'est affirmé et aucun chiffrage n'est proposé : l'audit doit être refait
          depuis un réseau qui accède au site, ou vérifié à la main.
        </p>
       </section>`
    : audit
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
    .alerte { background: #fff4e5; border-left: 3px solid #a35200; color: #6b3800; padding: 12px 14px; border-radius: 0 8px 8px 0; font-size: 13px; }
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

  ${nonConcluant
      ? ""
      : `<section>
    <h2>Proposition chiffrée</h2>
    ${tableauDevis(ctx)}
    <p class="meta">Devis valable jusqu'au ${echappeHtml(ctx.devis.valide_jusqu_au)}.</p>
  </section>`}

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
