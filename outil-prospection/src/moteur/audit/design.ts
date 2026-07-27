// Règles design / expérience utilisateur.
// Les constats de rendu réel (débordement mobile, contrastes, cibles tactiles, tailles de
// police) viennent de Lighthouse ; le reste est déduit du HTML.

import {
  aFavicon, anneeCopyright, comptePolices, feuillesDeStyle, images, liens, meta, scripts,
} from "./html.ts";
import { constate } from "./regles.ts";
import type { ContexteAudit, Finding, ResultatLighthouse } from "./types.ts";

/** Vrai si l'audit Lighthouse existe et est en échec (absent ⇒ pas de constat). */
function echoue(lighthouse: ResultatLighthouse | null, id: string): boolean {
  const audit = lighthouse?.audits?.[id];
  return Boolean(audit && !audit.reussi);
}

export function evalueDesign(ctx: ContexteAudit): Finding[] {
  const findings: Finding[] = [];
  const accueil = ctx.accueil;
  if (!accueil || accueil.statut >= 400) return findings;

  const html = accueil.html;
  const lh = ctx.lighthouse;

  // ── Adaptation mobile ─────────────────────────────────────────────────────
  const aViewport = /<meta[^>]+name=["']?viewport/i.test(html);
  if (!aViewport) {
    findings.push(constate("design_viewport_absent", "Aucune balise meta viewport : le site s'affiche en version bureau réduite"));
  }
  if (echoue(lh, "content-width")) {
    findings.push(constate("design_debordement_mobile", "Google mesure un contenu plus large que l'écran du téléphone"));
  }
  if (echoue(lh, "font-size")) {
    findings.push(constate("design_polices_petites", "Google relève des textes trop petits pour être lus sans zoomer"));
  }
  if (echoue(lh, "tap-targets")) {
    findings.push(constate("design_cibles_tactiles", "Google relève des boutons trop petits ou trop rapprochés"));
  }
  if (echoue(lh, "color-contrast")) {
    findings.push(constate("design_contrastes", "Google relève des contrastes texte/fond insuffisants"));
  }

  // ── Images et polices ─────────────────────────────────────────────────────
  if (echoue(lh, "modern-image-formats")) {
    findings.push(constate("design_images_non_optimisees", "Images en JPEG/PNG non compressées, formats WebP/AVIF non utilisés"));
  }
  if (echoue(lh, "uses-responsive-images")) {
    findings.push(constate("design_images_non_responsives", "Images servies en pleine résolution sur mobile"));
  }
  const polices = comptePolices(html) + feuillesDeStyle(html).filter((h) => /fonts\.googleapis/.test(h)).length;
  if (polices > 4) {
    findings.push(constate("design_trop_de_polices", `${polices} familles de polices différentes déclarées`));
  }

  // ── Technologies d'affichage ──────────────────────────────────────────────
  const tousScripts = scripts(html).join(" ").toLowerCase();
  const datees: string[] = [];
  const jquery = tousScripts.match(/jquery[.-]?(\d+)\.(\d+)/);
  if (jquery && Number(jquery[1]) < 2) datees.push(`jQuery ${jquery[1]}.${jquery[2]}`);
  const bootstrap = tousScripts.match(/bootstrap[.-]?(\d+)\.(\d+)/);
  if (bootstrap && Number(bootstrap[1]) < 4) datees.push(`Bootstrap ${bootstrap[1]}.${bootstrap[2]}`);
  if (/<(font|center|marquee|frameset|frame|blink)\b/i.test(html)) datees.push("balises HTML retirées du standard");
  const generateur = meta(html, "generator") ?? "";
  if (/frontpage|dreamweaver|publisher|jimdo|1&1|ionos mywebsite/i.test(generateur)) {
    datees.push(`générateur ${generateur}`);
  }
  if (datees.length) {
    findings.push(constate("design_technos_datees", `Détecté : ${datees.join(", ")}`));
  }

  const nbTableaux = (html.match(/<table\b/gi) ?? []).length;
  if (nbTableaux >= 3 || /\b(cellpadding|cellspacing|bgcolor)\s*=/i.test(html)) {
    findings.push(
      constate("design_layout_tableaux", nbTableaux >= 3
        ? `${nbTableaux} tableaux HTML et attributs de présentation obsolètes`
        : "Attributs de présentation obsolètes (bgcolor, cellpadding…)"),
    );
  }
  if (/application\/x-shockwave-flash|\.swf\b/i.test(html)) {
    findings.push(constate("design_flash", "Contenu Flash référencé dans la page"));
  }

  // ── Identité et passage à l'action ────────────────────────────────────────
  if (!aFavicon(html)) {
    findings.push(constate("design_favicon_absent", "Aucune icône de site déclarée"));
  }
  const tousLiens = liens(html);
  const aCta = tousLiens.some((l) => /^(tel:|mailto:)/i.test(l.href)) || /<form/i.test(html);
  if (!aCta) {
    findings.push(constate("design_cta_absent", "Ni téléphone cliquable, ni email, ni formulaire sur la page d'accueil"));
  }

  const annee = anneeCopyright(html, ctx.anneeCourante);
  if (annee !== null && ctx.anneeCourante - annee >= 3) {
    findings.push(
      constate("design_copyright_date", `Copyright ${annee} : dernière mise à jour visible il y a ${ctx.anneeCourante - annee} ans`),
    );
  }

  // ── Ressenti de chargement ────────────────────────────────────────────────
  if (lh?.lcpMs !== null && lh?.lcpMs !== undefined && lh.lcpMs > 2500) {
    findings.push(constate("design_lcp_lent", `Contenu principal affiché en ${(lh.lcpMs / 1000).toFixed(1)} s sur mobile`));
  }
  if (lh?.cls !== null && lh?.cls !== undefined && lh.cls > 0.1) {
    findings.push(constate("design_cls_eleve", `Décalage visuel mesuré à ${lh.cls.toFixed(2)} (seuil : 0,10)`));
  }
  if (lh?.accessibilite !== null && lh?.accessibilite !== undefined && lh.accessibilite < 80) {
    findings.push(constate("design_accessibilite_faible", `Note d'accessibilité Google : ${lh.accessibilite}/100`));
  }

  // Sans Lighthouse, un site sans viewport reste détecté comme non responsive ci-dessus ;
  // on complète par l'absence totale de media query dans le HTML.
  if (!lh && aViewport && !/@media[^{]*\((min|max)-width/i.test(html) && images(html).length > 0
      && feuillesDeStyle(html).length === 0) {
    findings.push(constate("design_debordement_mobile", "Aucune règle d'adaptation d'écran trouvée dans la page"));
  }

  // Poids réel mesuré image par image : indépendant de Lighthouse, et très concret.
  const lourdes = (ctx.imagesMesurees ?? []).filter((image) => image.octets > 700_000);
  if (lourdes.length) {
    const total = (ctx.imagesMesurees ?? []).reduce((somme, image) => somme + image.octets, 0);
    const plusLourde = lourdes[0];
    findings.push(constate(
      "design_image_lourde",
      `${nomFichier(plusLourde.url)} pèse ${enMo(plusLourde.octets)} Mo` +
        (lourdes.length > 1 ? ` (${lourdes.length} images de plus de 0,7 Mo)` : "") +
        ` — ${enMo(total)} Mo d'images sur la page d'accueil`,
    ));
  }

  return findings;
}

function enMo(octets: number): string {
  return (octets / 1_000_000).toFixed(1).replace(".", ",");
}

function nomFichier(url: string): string {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).pop() ?? url;
  } catch {
    return url;
  }
}
