// Règles SEO appliquées au contexte collecté.
// Une donnée absente du contexte (robots non lu, Lighthouse indisponible…) ne génère
// jamais de constat : on ne facture pas un défaut qu'on n'a pas vérifié.

import {
  aMetaPrefixe, attributLang, canonical, compteMots, images, liens, meta,
  niveauxTitres, texteVisible, titrePage, typesJsonLd,
} from "./html.ts";
import { anneesDepuis } from "./archive.ts";
import { telephonesDepuisHtml } from "./contacts.ts";
import { constate } from "./regles.ts";
import type { ContexteAudit, Finding } from "./types.ts";

const MOTS_CONTACT = /\b(contact|nous[- ]joindre|nous[- ]contacter|devis|rendez[- ]vous)\b/i;
const MOTS_MENTIONS = /\b(mentions[- ]l[eé]gales|impressum)\b/i;
const TYPES_ETABLISSEMENT = /^(LocalBusiness|Organization|Restaurant|Store|ProfessionalService|Hotel|Dentist|HairSalon|AutoRepair|BeautySalon|Bakery)$/i;

export function evalueSeo(ctx: ContexteAudit): Finding[] {
  const findings: Finding[] = [];
  const accueil = ctx.accueil;
  if (!accueil || accueil.statut >= 400) return findings;

  const html = accueil.html;

  // ── Indexabilité ──────────────────────────────────────────────────────────
  const robotsMeta = (meta(html, "robots") ?? "").toLowerCase();
  if (robotsMeta.includes("noindex")) {
    findings.push(constate("seo_noindex", `La page déclare « robots: ${robotsMeta} »`));
  }
  if (ctx.robots) {
    if (!ctx.robots.present) {
      findings.push(constate("seo_robots_absent", "Aucun fichier robots.txt à la racine du site"));
    } else if (/^\s*disallow:\s*\/\s*$/im.test(ctx.robots.contenu) && !/^\s*allow:/im.test(ctx.robots.contenu)) {
      findings.push(constate("seo_robots_bloquant", "Le robots.txt contient « Disallow: / »"));
    }
  }
  if (ctx.sitemap && !ctx.sitemap.present) {
    findings.push(constate("seo_sitemap_absent", "Ni /sitemap.xml ni déclaration dans le robots.txt"));
  }

  // ── Balises de la page d'accueil ──────────────────────────────────────────
  const titre = titrePage(html);
  if (!titre) {
    findings.push(constate("seo_title_absent", "Aucune balise <title> sur la page d'accueil"));
  } else if (titre.length < 30) {
    findings.push(constate("seo_title_court", `Titre de ${titre.length} caractères : « ${titre} »`));
  } else if (titre.length > 65) {
    findings.push(constate("seo_title_long", `Titre de ${titre.length} caractères, tronqué au-delà de 65`));
  }

  const description = meta(html, "description");
  if (description === null || description === "") {
    findings.push(constate("seo_description_absente", "Aucune balise meta description"));
  } else if (description.length < 70 || description.length > 165) {
    findings.push(
      constate("seo_description_longueur", `Description de ${description.length} caractères (cible : 70 à 165)`),
    );
  }

  const niveaux = niveauxTitres(html);
  const nbH1 = niveaux.filter((n) => n === 1).length;
  if (nbH1 === 0) {
    findings.push(constate("seo_h1_absent", "Aucun titre H1 sur la page d'accueil"));
  } else if (nbH1 > 1) {
    findings.push(constate("seo_h1_multiple", `${nbH1} titres H1 sur la même page`));
  }
  const premierSaut = niveaux.findIndex((niveau, i) => i > 0 && niveau > niveaux[i - 1] + 1);
  if (premierSaut > 0) {
    findings.push(
      constate("seo_hierarchie_titres", `Passage direct de H${niveaux[premierSaut - 1]} à H${niveaux[premierSaut]}`),
    );
  }

  if (!canonical(html)) {
    findings.push(constate("seo_canonical_absent", "Aucune balise <link rel=\"canonical\">"));
  }
  if (!attributLang(html)) {
    findings.push(constate("seo_lang_absent", "L'attribut lang est absent de la balise <html>"));
  }
  if (!aMetaPrefixe(html, "og:")) {
    findings.push(constate("seo_og_absent", "Aucune balise Open Graph (og:title, og:image…)"));
  }

  // ── Données structurées ──────────────────────────────────────────────────
  const types = typesJsonLd(html);
  if (!types.some((t) => TYPES_ETABLISSEMENT.test(t))) {
    findings.push(
      constate(
        "seo_donnees_structurees",
        types.length
          ? `Données structurées présentes (${types.slice(0, 3).join(", ")}) mais aucune fiche établissement`
          : "Aucune donnée structurée JSON-LD",
      ),
    );
  }

  // ── Contenu ──────────────────────────────────────────────────────────────
  const mots = compteMots(html);
  if (mots < 300) {
    findings.push(constate("seo_contenu_faible", `${mots} mots sur la page d'accueil (minimum conseillé : 300)`));
  }

  const toutesImages = images(html);
  const sansAlt = toutesImages.filter((img) => !img.aAlt).length;
  if (toutesImages.length >= 3 && sansAlt / toutesImages.length > 0.3) {
    findings.push(
      constate("seo_alt_manquants", `${sansAlt} image(s) sans attribut alt sur ${toutesImages.length}`),
    );
  }

  // ── Navigation, contact, mentions ────────────────────────────────────────
  const tousLiens = liens(html);
  const interneCount = tousLiens.filter((l) => !/^(https?:)?\/\//i.test(l.href) || l.href.includes(hote(accueil.urlFinale))).length;
  if (interneCount < 5) {
    findings.push(constate("seo_maillage_faible", `${interneCount} lien(s) interne(s) détecté(s)`));
  }

  const texte = texteVisible(html);
  const aContact = tousLiens.some((l) => MOTS_CONTACT.test(l.texte) || MOTS_CONTACT.test(l.href)) ||
    /<form/i.test(html);
  if (!aContact) {
    findings.push(constate("seo_page_contact_absente", "Aucun lien ni formulaire de contact identifiable"));
  }
  if (!tousLiens.some((l) => MOTS_MENTIONS.test(l.texte) || MOTS_MENTIONS.test(l.href))) {
    findings.push(constate("seo_mentions_absentes", "Aucun lien vers des mentions légales"));
  }

  // Détection linéaire : le motif à quantificateur imbriqué s'effondrait sur une page
  // contenant une longue suite de chiffres (plusieurs secondes de blocage).
  const aTelephone = telephonesDepuisHtml(texte).length > 0;
  const aAdresse = /\b\d{5}\b/.test(texte);
  if (!aTelephone || !aAdresse) {
    findings.push(
      constate(
        "seo_nap_absent",
        `Page d'accueil sans ${[!aTelephone && "téléphone", !aAdresse && "adresse postale"].filter(Boolean).join(" ni ")}`,
      ),
    );
  }

  if (ctx.page404 && (ctx.page404.statut !== 404 || !ctx.page404.personnalisee)) {
    findings.push(
      constate(
        "seo_404_non_personnalisee",
        ctx.page404.statut !== 404
          ? `Une adresse inexistante renvoie un code ${ctx.page404.statut} au lieu de 404`
          : "La page 404 est la page brute du serveur, sans navigation",
      ),
    );
  }

  // ── Note Lighthouse ──────────────────────────────────────────────────────
  if (ctx.lighthouse?.seo !== null && ctx.lighthouse?.seo !== undefined && ctx.lighthouse.seo < 80) {
    findings.push(constate("seo_lighthouse_faible", `Note SEO Google : ${ctx.lighthouse.seo}/100`));
  }

  // Canonique qui désigne une autre page : cause classique de disparition des résultats.
  const canonique = canonical(html);
  if (canonique && accueil) {
    try {
      const cible = new URL(canonique, accueil.urlFinale);
      const courante = new URL(accueil.urlFinale);
      const memePage = cible.hostname.replace(/^www\./, "") === courante.hostname.replace(/^www\./, "") &&
        cible.pathname.replace(/\/$/, "") === courante.pathname.replace(/\/$/, "");
      if (!memePage) {
        findings.push(constate(
          "seo_canonical_incoherente",
          `La page d'accueil déclare comme adresse officielle ${cible.toString()}`,
        ));
      }
    } catch {
      // Canonique inexploitable : la règle « canonical absent » couvre déjà le cas.
    }
  }

  // Titre et description identiques entre l'accueil et une page interne.
  if (accueil && ctx.pageInterne) {
    const titreAccueil = titrePage(html)?.trim();
    const titreInterne = titrePage(ctx.pageInterne.html)?.trim();
    if (titreAccueil && titreAccueil === titreInterne) {
      findings.push(constate(
        "seo_titre_duplique",
        `« ${titreAccueil.slice(0, 60)} » sert de titre à l'accueil et à ${new URL(ctx.pageInterne.urlFinale).pathname}`,
      ));
    }
  }

  // Adresses techniques : ?p=142, index.php?id=7…
  if (accueil) {
    const illisibles = liens(html)
      .map((lien) => lien.href)
      .filter((href) => /[?&](p|page_id|cat|id|product_id)=\d+/i.test(href) || /index\.php\?/i.test(href));
    if (illisibles.length >= 3) {
      findings.push(constate(
        "seo_urls_illisibles",
        `${illisibles.length} lien(s) en adresse technique, par exemple ${illisibles[0].slice(0, 50)}`,
      ));
    }
  }

  // Fiche établissement déclarée mais amputée : Google ne l'affiche pas.
  const typesFiche = typesJsonLd(html);
  if (typesFiche.some((type) => /LocalBusiness|Store|Restaurant|Organization/i.test(type))) {
    const manques = [
      /"address"\s*:/.test(html) ? null : "adresse",
      /"telephone"\s*:/.test(html) ? null : "téléphone",
      /"openingHours/i.test(html) ? null : "horaires",
    ].filter(Boolean);
    if (manques.length) {
      findings.push(constate("seo_fiche_incomplete", `Données structurées sans ${manques.join(", ")}`));
    }
  }

  // Liens vérifiés un par un : on cite les adresses, le prospect vérifie en un clic.
  if (ctx.liens && ctx.liens.casses.length) {
    const exemples = ctx.liens.casses.slice(0, 3)
      .map((lien) => {
        // Le chemin seul est trompeur quand l'adresse porte la page en paramètre (« /?p=12 »).
        const adresse = new URL(lien.url);
        return `${adresse.pathname}${adresse.search} (${lien.statut})`;
      })
      .join(", ");
    findings.push(constate(
      "seo_liens_morts",
      `${ctx.liens.casses.length} lien(s) cassé(s) sur ${ctx.liens.verifies} vérifié(s) : ${exemples}`,
    ));
  }

  // Historique public : le prospect peut ouvrir l'archive et constater lui-même.
  const anneesFige = anneesDepuis(ctx.archive?.inchangeDepuis ?? null, new Date(ctx.anneeCourante, 6, 1));
  if (anneesFige !== null && anneesFige >= 3) {
    findings.push(constate(
      "seo_site_fige",
      `Page d'accueil inchangée depuis ${ctx.archive!.inchangeDepuis} (${Math.floor(anneesFige)} ans), d'après l'Internet Archive`,
    ));
  }

  // Deux adresses pour le même contenu : constat seulement si la vérification a abouti.
  if (ctx.wwwDuplique === true) {
    findings.push(constate(
      "seo_www_duplique",
      "Les adresses avec et sans « www » répondent toutes les deux sans redirection",
    ));
  }

  return findings;
}

function hote(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
