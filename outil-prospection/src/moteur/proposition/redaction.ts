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
  const marque = ctx.emetteur.raison_sociale;
  const dirigeant = prenomDirigeant(ctx.prospect.dirigeant);
  const pointCritique = ctx.arguments[0] ? minuscule(ctx.arguments[0].titre) : "un vrai point à corriger";
  const entree = ctx.devis.lignes_projet[0] ? `${euros(ctx.devis.lignes_projet[0].total)} HT` : "un budget réduit";
  const lignes: string[] = [];
  const T = "════════════════════════════════════════════════════════";

  lignes.push(T);
  lignes.push(`  SCRIPT D'APPEL — ${nom}${ctx.prospect.ville ? ` (${villeLisible(ctx.prospect.ville)})` : ""}`);
  lignes.push(T);
  // La plateforme n'est pas un défaut, mais elle oriente l'échange : un site fait sur un
  // éditeur en ligne ne s'exporte pas, un WordPress demande un suivi.
  if (ctx.audit?.technologie) {
    lignes.push(`Plateforme repérée : ${ctx.audit.technologie} (info interne, n'en parlez pas d'entrée).`);
  }
  lignes.push("");

  // ── Mémo pour débutant : le mental et les pièges, avant même de composer ────
  lignes.push("À LIRE AVANT DE DÉCROCHER (surtout si c'est vos premiers appels)");
  lignes.push("");
  lignes.push("Le but de cet appel n'est PAS de vendre. C'est d'obtenir un OUI pour");
  lignes.push("envoyer le rapport + un créneau de rappel. Vous vendrez plus tard.");
  lignes.push("");
  lignes.push("  1. Ne dites JAMAIS « c'est un appel commercial » ni « de la prospection ».");
  lignes.push("     Le mot tue l'appel en 2 secondes. Vous appelez parce que vous avez");
  lignes.push("     VRAIMENT regardé leur site et vu un problème concret — dites ça, c'est vrai.");
  lignes.push("  2. Souriez en parlant, ça s'entend. Parlez lentement, un ton plus bas.");
  lignes.push("  3. Les 15 premières secondes décident de tout : l'accroche se sait par cœur.");
  lignes.push("  4. Posez une question, puis TAISEZ-VOUS. Le premier qui parle a perdu.");
  lignes.push("  5. Un « non » est un réflexe, pas un mur. Une objection = une porte à pousser.");
  lignes.push("  6. Dès que vous avez le OUI + le créneau, vous remerciez et vous raccrochez.");
  lignes.push("     N'en rajoutez pas : on ne revend pas ce qui est déjà vendu.");
  lignes.push("");

  // ── Barrage secrétaire : on ne pitche pas, on récupère le bon interlocuteur ─
  lignes.push("SI UN STANDARD / UNE SECRÉTAIRE RÉPOND");
  lignes.push(
    `   « Bonjour, je cherche la personne qui s'occupe du site internet` +
      (dirigeant ? `, c'est bien ${dirigeant} ?` : " chez vous ?") +
      ` J'ai regardé leur site, j'ai un point technique à leur signaler. »`,
  );
  lignes.push("   (Ton calme, comme si votre appel était attendu. On ne vend rien à la secrétaire.)");
  lignes.push("");

  lignes.push("1. ACCROCHE (15 secondes — apprenez-la par cœur)");
  lignes.push(
    sansSite
      ? `   « Bonjour, ${marque} à l'appareil. Je vais être direct : j'ai cherché ${nom} sur Google et je n'ai trouvé aucun site à votre nom. Aujourd'hui un client qui vous cherche le soir et ne trouve rien appelle le concurrent. C'est ça que je veux vous éviter. Je vous vole 30 secondes ? »`
      : `   « Bonjour, ${marque} à l'appareil. Je vais être direct avec vous : j'ai regardé le site de ${nom} ce matin, il est à ${ctx.audit!.scores.global}/100 sur les critères que Google et vos clients regardent. Honnêtement il mérite mieux. Je vous dis les 3 points qui vous font perdre des clients, et vous jugez ? »`,
  );
  lignes.push("   ▸ Il vous laisse parler → étape 2.");
  lignes.push("   ▸ « C'est pour me vendre un truc ? » → réponse dans les OBJECTIONS ci-dessous.");
  lignes.push("   ▸ Il raccroche → tant pis, prospect suivant. Vous n'avez rien perdu.");
  lignes.push("");

  lignes.push("2. LES POINTS À ANNONCER (lisez-les tels quels, un par un, en marquant une pause)");
  if (ctx.arguments.length) {
    ctx.arguments.forEach((f, i) => {
      lignes.push(`   ${i + 1}. ${f.titre}`);
      lignes.push(`      Le constat (pour vous) : ${f.constat}`);
      lignes.push(`      Ce que vous dites (à voix haute) : « ${f.impact} »`);
    });
  } else {
    lignes.push("   (Aucun défaut majeur retenu : restez sur l'accroche et la qualification.)");
  }
  lignes.push("");

  lignes.push("3. QUALIFICATION (posez, écoutez, notez — c'est là que vous apprenez tout)");
  lignes.push("   • Qui s'occupe du site aujourd'hui ? (une agence, un proche, personne ?)");
  lignes.push("   • Combien de demandes vous arrivent par le site chaque mois ?");
  lignes.push("   • Vous aviez déjà prévu un budget là-dessus cette année ?");
  lignes.push("");

  lignes.push("4. OBJECTIONS (il va forcément en sortir une — vous êtes prêt)");
  lignes.push(`   « C'est de la prospection / vous voulez me vendre un truc ? »`);
  lignes.push(`      → « Honnêtement ? Oui, je fais des sites. Mais je ne vous aurais pas appelé`);
  lignes.push(`         sans avoir vu un vrai problème sur le vôtre : ${pointCritique}. Laissez-moi`);
  lignes.push(`         30 secondes, si ça ne vous parle pas vous raccrochez. »`);
  lignes.push(`   « C'est trop cher »`);
  lignes.push(`      → « Le devis est découpé par priorité. On peut ne traiter que le point critique`);
  lignes.push(`         d'abord, c'est ${entree}. On avance pas à pas. »`);
  lignes.push(`   « J'ai déjà quelqu'un »`);
  lignes.push(`      → « Parfait. Je vous envoie le rapport, vous le lui transmettez : il verra les`);
  lignes.push(`         points à corriger. Si ça reste en attente, vous me rappelez. »`);
  lignes.push(`   « Ça marche très bien comme ça »`);
  lignes.push(`      → « Combien de clients vous disent vous avoir trouvé sur Google ? C'est justement`);
  lignes.push(`         ce qu'on peut faire progresser, sans rien changer à ce qui marche. »`);
  lignes.push(`   « Envoyez-moi un mail »`);
  lignes.push(`      → « Je le fais dans l'heure. Je vous rappelle ${jourRelance()} pour votre avis, ça vous va ? »`);
  lignes.push(`   « C'est pas le moment »`);
  lignes.push(`      → « Aucun souci, je ne vais pas vous embêter. Je vous rappelle ${jourRelance()} à la`);
  lignes.push(`         même heure ? » (vous notez le rappel, et vous raccrochez.)`);
  lignes.push("");

  lignes.push("5. ON CONCLUT (dès qu'il montre un intérêt, on arrête de parler du problème)");
  lignes.push(
    `   « Voilà ce que je vous propose : je vous envoie le rapport complet en PDF, tout est`,
  );
  lignes.push(
    `     détaillé et vérifiable dedans. On se cale 15 minutes ${jourRelance()} pour que je vous`,
  );
  lignes.push(
    `     montre l'essentiel. Vous préférez plutôt le matin ou l'après-midi ? »`,
  );
  lignes.push(`   (« matin ou après-midi » le fait choisir un créneau sans avoir à dire « oui ».)`);
  lignes.push("");

  lignes.push("SI VOUS TOMBEZ SUR LE RÉPONDEUR (message court, vous rappellerez)");
  lignes.push(
    `   « Bonjour, ${marque}. J'ai regardé le site de ${nom} et relevé 2-3 points qui vous coûtent`,
  );
  lignes.push(
    `     des clients — rien de grave, ça se corrige. Je vous rappelle ${jourRelance()}` +
      (ctx.emetteur.telephone ? `, ou joignez-moi au ${ctx.emetteur.telephone}` : "") + `. Bonne journée ! »`,
  );
  lignes.push("");

  lignes.push("APRÈS L'APPEL (ne zappez pas, c'est ce qui fait signer)");
  lignes.push("   ✓ Envoyez le rapport PDF dans l'heure, tant que vous êtes frais dans sa tête.");
  lignes.push("   ✓ Notez la date de rappel dans l'agenda.");
  lignes.push("   ✓ Mettez à jour le statut du prospect dans l'outil.");
  return lignes.join("\n");
}

/** Jour de relance « neutre » : évite de dater le script, tout en donnant un repère concret. */
function jourRelance(): string {
  return "en fin de semaine";
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
// Email d'approche (premier contact) — présentation de l'agence, sans devis
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Email de première prise de contact.
 * Objectif : se présenter (agence de création de sites), montrer qu'on a vraiment regardé le
 * site du prospect, pointer les deux ou trois points qui comptent, et annoncer l'audit complet
 * joint en PDF — sans devis. Le devis vient plus tard, quand le prospect a répondu.
 */
export function emailIntroduction(ctx: ContexteProposition): { objet: string; corps: string } {
  const nom = nomCommercial(ctx.prospect);
  const agence = ctx.emetteur.raison_sociale;

  if (auditNonConcluant(ctx)) {
    return {
      objet: `${nom} : audit à refaire manuellement`,
      corps: [
        `Audit non concluant pour ${nom} — aucun email d'approche n'a été rédigé.`,
        "",
        raisonNonConcluant(ctx),
      ].join("\n"),
    };
  }

  const dirigeant = prenomDirigeant(ctx.prospect.dirigeant);
  const ville = villeLisible(ctx.prospect.ville);
  const sansSite = !ctx.audit || ctx.prospect.site_statut === "aucun_site";
  const pire = ctx.arguments[0];

  const objet = sansSite
    ? `${nom} : je crée des sites web, et le vôtre reste à faire`
    : pire
      ? `${nom} : quelques points à revoir sur votre site`
      : `${nom} : un mot sur votre site web`;

  const salutation = dirigeant ? `Bonjour ${dirigeant},` : "Bonjour,";
  const presentation = `Je m'appelle ${agence}, je crée et je refais des sites web pour les entreprises${
    ville ? ` de la région de ${ville}` : ""}.`;

  const accroche = sansSite
    ? `En cherchant ${nom} en ligne, je n'ai trouvé aucun site à votre nom — uniquement vos concurrents. Aujourd'hui, un client qui vous cherche sur Google ne vous trouve pas.`
    : `J'ai pris le temps de regarder votre site${ctx.audit ? `, il obtient ${ctx.audit.scores.global}/100` : ""} sur les critères que Google et vos visiteurs regardent. Honnêtement, il mérite mieux.`;

  const listeArguments = sansSite
    ? "• Aucune présence en ligne : vos concurrents captent les recherches à votre place."
    : ctx.arguments.slice(0, 3).map((f) => `• ${f.titre} — ${f.impact}`).join("\n");

  const corps = [
    salutation,
    "",
    presentation,
    "",
    accroche,
    "",
    sansSite ? "Ce que ça vous coûte :" : "Les points qui vous font perdre des clients aujourd'hui :",
    listeArguments,
    "",
    `Vous trouverez le détail complet dans l'audit en pièce jointe (PDF) : chaque point est mesuré, rien n'est inventé, et vous pouvez tout vérifier vous-même.`,
    "",
    `Si le sujet vous intéresse, répondez simplement à cet email ou appelez-moi : je vous montre concrètement à quoi ressemblerait un site à la hauteur de votre travail. Sans engagement.`,
    "",
    "Bien à vous,",
    [ctx.emetteur.raison_sociale, ctx.emetteur.telephone, ctx.emetteur.email, sansUrl(ctx.emetteur.site_web)]
      .filter(Boolean).join(" — "),
    "",
    "—",
    `Vous recevez ce message à titre professionnel. Vos coordonnées d'entreprise proviennent de l'annuaire public des entreprises (données Sirene en open data) et de votre site. Répondez « STOP » et je supprime immédiatement vos données de mon fichier.`,
  ].join("\n");

  return { objet, corps };
}

/** « https://smartfixx.fr » → « smartfixx.fr » pour une signature lisible. */
function sansUrl(site: string | null | undefined): string {
  return (site ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * Version HTML de l'email d'approche : mise en page propre aux couleurs de l'agence, sans
 * devis. Rappelle en évidence que l'audit complet est joint en PDF.
 */
export function emailIntroductionHtml(
  ctx: ContexteProposition,
  email: { objet: string; corps: string } = emailIntroduction(ctx),
): string {
  const nom = nomCommercial(ctx.prospect);
  const emetteur = ctx.emetteur;

  if (auditNonConcluant(ctx)) {
    return `<div style="font-family:${POLICE_EMAIL};max-width:600px;padding:16px;background:#fff8e1;border:1px solid #f5d76e;border-radius:8px;color:#7a5c00">
  <strong>Aucun email à envoyer : audit non concluant pour ${echappeHtml(nom)}.</strong>
  <p style="margin:8px 0 0;font-size:14px;line-height:1.6">${echappeHtml(raisonNonConcluant(ctx))}</p>
</div>`;
  }

  const score = ctx.audit?.scores;
  const arguments3 = ctx.arguments.slice(0, 3);
  const site = sansUrl(emetteur.site_web);
  const sujetReponse = encodeURIComponent(`Re: ${email.objet}`);

  const bandeauScore = score
    ? `<tr><td style="padding:2px 0 20px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e6e8ee;border-radius:10px">
          <tr><td align="center" style="padding:16px 12px 6px">
            <div style="font-size:34px;font-weight:700;line-height:1;color:${couleurScore(score.global)}">${score.global}<span style="font-size:15px;color:#9aa2b1">/100</span></div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px">La note de votre site aujourd'hui</div>
          </td></tr>
          <tr><td style="padding:0 8px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            ${PILIERS.map((pilier) => `<td width="25%" align="center" style="padding:6px 4px">
              <div style="font-size:18px;font-weight:700;color:${couleurScore(score[pilier])}">${score[pilier]}</div>
              <div style="font-size:10.5px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">${echappeHtml(LIBELLES_PILIERS[pilier])}</div>
            </td>`).join("")}
          </tr></table></td></tr>
        </table>
       </td></tr>`
    : "";

  const cartesArguments = arguments3.length
    ? `<tr><td style="padding:0 0 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${arguments3.map((f) => `<tr><td style="padding:0 0 10px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f8fc;border-left:3px solid #2f6df6;border-radius:0 8px 8px 0">
            <tr><td style="padding:12px 14px">
              <div style="font-size:15px;font-weight:600;color:#1f2430">${echappeHtml(f.titre)}</div>
              <div style="font-size:14px;color:#3a4150;margin-top:4px;line-height:1.5">${echappeHtml(f.impact)}</div>
            </td></tr></table></td></tr>`).join("")}
       </table></td></tr>`
    : "";

  return `<div style="margin:0;padding:0;background:#eef1f6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef1f6;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:${POLICE_EMAIL}">

      <tr><td style="background:linear-gradient(135deg,#1b2a4a,#0f1b34);padding:22px 26px">
        <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.02em">${echappeHtml(emetteur.raison_sociale)}</div>
        <div style="font-size:12.5px;color:#9fb3d9;margin-top:3px">Création &amp; refonte de sites web${site ? ` · ${echappeHtml(site)}` : ""}</div>
      </td></tr>

      <tr><td style="padding:24px 26px 6px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${decoupeCorps(email.corps).filter((b) => b.genre === "paragraphe").slice(0, 3)
            .map((b) => `<tr><td>${b.lignes.map(paragrapheEmail).join("")}</td></tr>`).join("")}
          ${bandeauScore}
          ${cartesArguments}

          <tr><td style="padding:4px 0 18px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef6ee;border:1px solid #cfe6cf;border-radius:8px">
              <tr>
                <td width="42" align="center" style="padding:14px 0 14px 14px;font-size:22px">📎</td>
                <td style="padding:14px 14px 14px 10px;font-size:14px;color:#2f5d33;line-height:1.5">
                  <strong>L'audit complet est joint à cet email (PDF).</strong> Chaque point y est mesuré et vérifiable.
                </td>
              </tr>
            </table>
          </td></tr>

          <tr><td align="center" style="padding:2px 0 20px">
            <a href="mailto:${echappeHtml(emetteur.email)}?subject=${sujetReponse}"
               style="display:inline-block;background:#2f6df6;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px">
              Échanger 15 minutes</a>
            <div style="font-size:12px;color:#6b7280;margin-top:8px">Sans engagement — répondez simplement à cet email.</div>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="background:#f7f8fb;border-top:1px solid #e6e8ee;padding:16px 26px">
        <div style="font-size:13px;color:#374151;font-weight:600">${echappeHtml(emetteur.raison_sociale)}</div>
        <div style="font-size:12.5px;color:#6b7280;margin-top:2px">
          ${[emetteur.telephone, emetteur.email, site].filter(Boolean).map((v) => echappeHtml(v)).join(" · ")}
        </div>
        <div style="font-size:11px;color:#9aa2b1;line-height:1.5;margin-top:10px">
          ${decoupeCorps(email.corps).filter((b) => b.genre === "mentions").flatMap((b) => b.lignes).map((l) => echappeHtml(l)).join(" ")}
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</div>`;
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
        // Une source manquante rend la note optimiste : le prospect doit le lire aussi.
        const partiel = (scores!.partiels ?? []).includes(pilier);
        return `
        <section class="pilier">
          <h2>${LIBELLES_PILIERS[pilier]} <span class="note" style="color:${couleurScore(scores![pilier])}">${scores![pilier]}/100</span>${
            partiel ? ` <span class="mesure-partielle">mesure partielle</span>` : ""}</h2>
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
    .mesure-partielle { font-size: 11px; font-weight: 600; color: #a35200; background: #fff4e5; padding: 2px 8px; border-radius: 999px; }
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
