import { describe, expect, it } from "vitest";

import { appliqueRegles, auditeSite } from "./index.ts";
import {
  cheminAutorise, cheminsInterdits, collecte, collecte404, collecteDns, collecteLighthouse,
  collecteRobots, collecteSitemap, estBlocageParPareFeu, FICHIERS_SONDES, hotePublic, normaliseUrl,
  mesureImages, resoutDomaine, sondeFichiers, verifieDuplicationWww, verifieLiens,
} from "./collecte.ts";
import { causeEchec, domaine, nomDepuisDomaine } from "./http.ts";
import { collecteArchive, dateDepuisHorodatage } from "./archive.ts";
import { litCertificat } from "./certificat.ts";
import {
  agregeContacts, contactsVides, decodeEmailsProteges, deobfusqueEmails, emailsDepuisHtml,
  formateTelephone, lienGoogleMaps, rechercheGoogleMaps, reseauxSociaux, telephonesDepuisHtml,
} from "./contacts.ts";
import { aBandeauConsentement, traceurs } from "./html.ts";
import {
  anneeCopyright, compteMots, comptePolices, echappeHtml, formulaires, images, liens, meta,
  composantsDetectes, niveauxTitres, ressourcesNonSecurisees, technologie, texteVisible, titrePage,
  typesJsonLd,
} from "./html.ts";
import { compareVersions, failleDe } from "./composants.ts";
import { logicielsObsoletes } from "./logiciels.ts";
import { REGLES, constate, reglesDuPilier } from "./regles.ts";
import {
  argumentsCles, calculeScores, piliersNonMesures, piliersPartiels, resumeSeverites, scorePilier,
} from "./score.ts";
import { evalueSeo } from "./seo.ts";
import { evalueDesign } from "./design.ts";
import { evalueSecurite } from "./securite.ts";
import { evalueTechnique } from "./technique.ts";
import type { ContexteAudit, Pilier, ReponseHttp, ResultatLighthouse } from "./types.ts";

// ── Fixtures ────────────────────────────────────────────────────────────────

const SITE_MODERNE = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Garage Martin — Réparation automobile toutes marques à Bordeaux</title>
  <meta name="description" content="Garage indépendant à Bordeaux : entretien, révision, freinage et diagnostic électronique pour toutes les marques. Devis gratuit en 24 h.">
  <link rel="canonical" href="https://garagemartin.fr/">
  <link rel="icon" href="/favicon.svg">
  <meta property="og:title" content="Garage Martin">
  <meta property="og:image" content="https://garagemartin.fr/atelier.jpg">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"AutoRepair","name":"Garage Martin","telephone":"05 56 12 34 56"}</script>
  <style>@media (min-width: 768px) { .grille { display: grid } }</style>
</head>
<body>
  <h1>Garage Martin, votre garage de quartier à Bordeaux</h1>
  <nav>
    <a href="/services">Nos services</a><a href="/tarifs">Tarifs</a><a href="/avis">Avis clients</a>
    <a href="/contact">Contact</a><a href="/mentions-legales">Mentions légales</a>
    <a href="/politique-de-confidentialite">Politique de confidentialité</a>
  </nav>
  <h2>Entretien et révision</h2>
  <img src="/atelier.webp" alt="Atelier du garage Martin" width="800" height="600">
  <p>${"Notre équipe entretient votre véhicule dans son atelier bordelais depuis 1998. ".repeat(30)}</p>
  <h2>Nous trouver</h2>
  <p>12 rue du Marché, 33000 Bordeaux — <a href="tel:0556123456">05 56 12 34 56</a></p>
  <form action="/contact" method="post"><input name="email"><button>Envoyer</button></form>
  <footer>© 2026 Garage Martin</footer>
</body></html>`;

const SITE_DATE = `<html>
<head>
  <title>Bienvenue</title>
  <meta name="generator" content="WordPress 4.9.8">
  <script src="/js/jquery-1.7.2.min.js"></script>
  <script src="/js/bootstrap-3.1.0.min.js"></script>
</head>
<body bgcolor="#FFFFFF">
  <table cellpadding="4"><tr><td>
    <center><font size="2">Bienvenue sur notre site</font></center>
    <img src="/photo1.jpg"><img src="/photo2.jpg"><img src="/photo3.jpg">
    <embed src="/intro.swf" type="application/x-shockwave-flash">
    <table><tr><td>Nos produits</td></tr></table>
    <table><tr><td>Contactez-nous par courrier</td></tr></table>
    <p>Copyright 2011 - Tous droits réservés</p>
  </td></tr></table>
</body></html>`;

function reponse(surcharge: Partial<ReponseHttp> = {}): ReponseHttp {
  return {
    url: "https://garagemartin.fr",
    urlFinale: "https://garagemartin.fr",
    statut: 200,
    html: SITE_MODERNE,
    entetes: {
      "content-type": "text/html; charset=utf-8",
      "content-encoding": "br",
      "strict-transport-security": "max-age=31536000",
      "content-security-policy": "default-src 'self'",
      "x-frame-options": "SAMEORIGIN",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "alt-svc": 'h3=":443"',
    },
    cookies: [],
    dureeMs: 320,
    octets: 60_000,
    ...surcharge,
  };
}

function contexte(surcharge: Partial<ContexteAudit> = {}): ContexteAudit {
  return {
    url: "https://garagemartin.fr",
    accueil: reponse(),
    accessibilite: "ok",
    resolutionDns: true,
    redirigeVersHttps: true,
    wwwDuplique: null,
    erreurCertificat: null,
    liens: null,
    imagesMesurees: null,
    archive: null,
    certificat: null,
    wordpress: null,
    securityTxt: null,
    robots: { present: true, contenu: "User-agent: *\nAllow: /\nSitemap: https://garagemartin.fr/sitemap.xml" },
    sitemap: { present: true, urls: 12 },
    pageInterne: null,
    pagesContact: [],
    contacts: contactsVides(),
    page404: { statut: 404, personnalisee: true },
    dns: dns({ mx: ["10 mx.ovh.net."], spf: "v=spf1 include:mx.ovh.com ~all", dmarc: "v=DMARC1; p=quarantine" }),
    lighthouse: null,
    fichiersExposes: [],
    anneeCourante: 2026,
    erreurs: [],
    ...surcharge,
  };
}

/** Enregistrements DNS vérifiés, sauf mention contraire. */
function dns(
  valeurs: { mx?: string[]; spf?: string | null; dmarc?: string | null; dnssec?: boolean },
  verifie = true,
): ContexteAudit["dns"] {
  return {
    mx: { verifie, valeur: valeurs.mx ?? [] },
    spf: { verifie, valeur: valeurs.spf ?? null },
    dmarc: { verifie, valeur: valeurs.dmarc ?? null },
    dnssec: { verifie, valeur: valeurs.dnssec ?? true },
  };
}

function lighthouse(surcharge: Partial<ResultatLighthouse> = {}): ResultatLighthouse {
  return {
    performance: 92, seo: 95, accessibilite: 96, bonnesPratiques: 92,
    lcpMs: 1800, cls: 0.02, tbtMs: 120, octets: 800_000, requetes: 30,
    audits: {}, terrain: null, captureDataUri: null,
    ...surcharge,
  };
}

// ── Extracteurs HTML ────────────────────────────────────────────────────────

describe("extracteurs HTML", () => {
  it("lit les balises principales", () => {
    expect(titrePage(SITE_MODERNE)).toContain("Garage Martin");
    expect(meta(SITE_MODERNE, "description")).toContain("Garage indépendant");
    expect(meta(SITE_MODERNE, "viewport")).toContain("width=device-width");
    expect(typesJsonLd(SITE_MODERNE)).toEqual(["AutoRepair"]);
    expect(niveauxTitres(SITE_MODERNE)).toEqual([1, 2, 2]);
  });

  it("ignore le contenu des scripts dans le texte visible", () => {
    const texte = texteVisible('<p>Bonjour</p><script>var secret = "cache"</script>');
    expect(texte).toBe("Bonjour");
    expect(compteMots("<p>un deux trois</p>")).toBe(3);
  });

  it("décrit les images, liens et formulaires", () => {
    const [image] = images(SITE_MODERNE);
    expect(image).toEqual({ src: "/atelier.webp", aAlt: true, aDimensions: true });
    expect(images('<img src="a.jpg">')[0].aAlt).toBe(false);
    expect(liens(SITE_MODERNE).some((l) => l.href === "tel:0556123456")).toBe(true);
    expect(formulaires(SITE_MODERNE)).toEqual([{ action: "/contact", methode: "post" }]);
  });

  it("repère le contenu mixte et le copyright", () => {
    expect(ressourcesNonSecurisees('<img src="http://cdn.exemple.fr/a.png">')).toEqual([
      "http://cdn.exemple.fr/a.png",
    ]);
    expect(anneeCopyright(SITE_DATE, 2026)).toBe(2011);
    expect(anneeCopyright("<p>sans date</p>", 2026)).toBeNull();
    expect(anneeCopyright("<p>© 2099 futur</p>", 2026)).toBeNull();
  });

  it("ne prend pas un lien de navigation http:// pour du contenu mixte (faux positif retiré)", () => {
    // Un <a href="http://…"> est une navigation, pas une ressource chargée : ce n'est PAS
    // du contenu mixte. Seules img/script/iframe (src) et <link> (href) en sont.
    expect(ressourcesNonSecurisees('<a href="http://vieux-partenaire.fr">Notre partenaire</a>')).toEqual([]);
    expect(ressourcesNonSecurisees(
      '<a href="http://x.fr">lien</a><script src="http://cdn.fr/a.js"></script>' +
      '<link rel="stylesheet" href="http://cdn.fr/s.css">',
    )).toEqual(["http://cdn.fr/a.js", "http://cdn.fr/s.css"]);
  });

  it("compte les familles de polices", () => {
    expect(comptePolices('<style>body{font-family:"Inter",sans-serif}h1{font-family:Georgia}</style>')).toBe(2);
  });

  it("échappe le contenu tiers", () => {
    expect(echappeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(echappeHtml(null)).toBe("");
  });
});

// ── Catalogue de règles ─────────────────────────────────────────────────────

describe("catalogue de règles", () => {
  it("associe chaque règle à au moins une prestation facturable", () => {
    for (const [id, regle] of Object.entries(REGLES)) {
      expect(regle.prestations.length, `règle ${id}`).toBeGreaterThan(0);
      expect(regle.poids, `règle ${id}`).toBeGreaterThan(0);
      expect(regle.impact.length, `règle ${id}`).toBeGreaterThan(20);
    }
  });

  it("couvre les quatre piliers", () => {
    for (const pilier of ["seo", "design", "securite", "technique"] as Pilier[]) {
      expect(reglesDuPilier(pilier).length).toBeGreaterThan(5);
    }
  });

  it("refuse un identifiant de règle inconnu", () => {
    expect(() => constate("regle_inexistante", "test")).toThrow(/inconnue/);
  });
});

// ── Règles SEO ──────────────────────────────────────────────────────────────

describe("evalueSeo", () => {
  it("ne signale rien de bloquant sur un site bien construit", () => {
    const findings = evalueSeo(contexte());
    expect(findings.filter((f) => f.severite !== "mineur")).toEqual([]);
  });

  it("détecte les manques d'un site daté", () => {
    const findings = evalueSeo(contexte({ accueil: reponse({ html: SITE_DATE }) }));
    const ids = findings.map((f) => f.regle);

    expect(ids).toContain("seo_title_court");
    expect(ids).toContain("seo_description_absente");
    expect(ids).toContain("seo_h1_absent");
    expect(ids).toContain("seo_donnees_structurees");
    expect(ids).toContain("seo_contenu_faible");
    expect(ids).toContain("seo_alt_manquants");
    expect(ids).toContain("seo_nap_absent");
    expect(ids).toContain("seo_page_contact_absente");
  });

  it("ne prend pas un nombre à 5 chiffres quelconque pour une adresse postale (faux positif retiré)", () => {
    const tel = "05 56 12 34 56";
    const sansAdresse = `<p>Téléphone ${tel} — Référence produit 12345 — commande 90210</p>`;
    expect(evalueSeo(contexte({ accueil: reponse({ html: sansAdresse }) })).map((f) => f.regle))
      .toContain("seo_nap_absent");
    const avecAdresse = `<p>8 rue de la Paix, 33000 Bordeaux — Tél. ${tel}</p>`;
    expect(evalueSeo(contexte({ accueil: reponse({ html: avecAdresse }) })).map((f) => f.regle))
      .not.toContain("seo_nap_absent");
  });

  it("ne compte pas un lien externe contenant le domaine comme lien interne (faux positif retiré)", () => {
    const html = `<html><body>
      <a href="/services">Services</a><a href="/tarifs">Tarifs</a>
      <a href="/contact">Contact</a><a href="/a-propos">À propos</a>
      <a href="https://annuaire-spam.com/?u=garagemartin.fr">annuaire</a>
    </body></html>`;
    expect(evalueSeo(contexte({ accueil: reponse({ html }) })).map((f) => f.regle))
      .toContain("seo_maillage_faible");
  });

  it("signale un site désindexé", () => {
    const html = SITE_MODERNE.replace("<meta charset=\"utf-8\">", '<meta name="robots" content="noindex, nofollow">');
    const findings = evalueSeo(contexte({ accueil: reponse({ html }) }));
    expect(findings.find((f) => f.regle === "seo_noindex")?.severite).toBe("critique");
  });

  it("signale un robots.txt bloquant et un sitemap absent", () => {
    const findings = evalueSeo(contexte({
      robots: { present: true, contenu: "User-agent: *\nDisallow: /" },
      sitemap: { present: false, urls: 0 },
    }));
    const ids = findings.map((f) => f.regle);
    expect(ids).toContain("seo_robots_bloquant");
    expect(ids).toContain("seo_sitemap_absent");
  });

  it("ne conclut rien sur ce qui n'a pas pu être collecté", () => {
    const findings = evalueSeo(contexte({ robots: null, sitemap: null, page404: null, lighthouse: null }));
    const ids = findings.map((f) => f.regle);
    expect(ids).not.toContain("seo_robots_absent");
    expect(ids).not.toContain("seo_sitemap_absent");
    expect(ids).not.toContain("seo_404_non_personnalisee");
    expect(ids).not.toContain("seo_lighthouse_faible");
  });

  it("reprend la note SEO de Lighthouse", () => {
    const findings = evalueSeo(contexte({ lighthouse: lighthouse({ seo: 62 }) }));
    expect(findings.find((f) => f.regle === "seo_lighthouse_faible")?.constat).toContain("62/100");
  });
});

// ── Règles design ───────────────────────────────────────────────────────────

describe("evalueDesign", () => {
  it("laisse passer un site responsive et récent", () => {
    const findings = evalueDesign(contexte({ lighthouse: lighthouse() }));
    expect(findings.map((f) => f.regle)).toEqual([]);
  });

  it("détecte un site d'une autre époque", () => {
    const findings = evalueDesign(contexte({ accueil: reponse({ html: SITE_DATE }) }));
    const ids = findings.map((f) => f.regle);

    expect(ids).toContain("design_viewport_absent");
    expect(ids).toContain("design_technos_datees");
    expect(ids).toContain("design_layout_tableaux");
    expect(ids).toContain("design_flash");
    expect(ids).toContain("design_favicon_absent");
    expect(ids).toContain("design_cta_absent");
    expect(ids).toContain("design_copyright_date");
    expect(findings.find((f) => f.regle === "design_technos_datees")?.constat).toContain("jQuery 1.7");
  });

  it("reprend les mesures de rendu réel de Lighthouse", () => {
    const findings = evalueDesign(contexte({
      lighthouse: lighthouse({
        accessibilite: 61,
        lcpMs: 5200,
        cls: 0.34,
        audits: {
          "content-width": { note: 0, reussi: false },
          "tap-targets": { note: 0, reussi: false },
          "color-contrast": { note: 0, reussi: false },
          "font-size": { note: 0, reussi: false },
        },
      }),
    }));
    const ids = findings.map((f) => f.regle);

    expect(ids).toContain("design_debordement_mobile");
    expect(ids).toContain("design_cibles_tactiles");
    expect(ids).toContain("design_contrastes");
    expect(ids).toContain("design_polices_petites");
    expect(ids).toContain("design_lcp_lent");
    expect(ids).toContain("design_cls_eleve");
    expect(ids).toContain("design_accessibilite_faible");
  });

  it("ignore les audits Lighthouse non applicables", () => {
    const findings = evalueDesign(contexte({
      lighthouse: lighthouse({ audits: { "tap-targets": { note: null, reussi: true } } }),
    }));
    expect(findings.map((f) => f.regle)).not.toContain("design_cibles_tactiles");
  });
});

// ── Règles sécurité ─────────────────────────────────────────────────────────

describe("evalueSecurite", () => {
  it("laisse passer un site correctement configuré", () => {
    const findings = evalueSecurite(contexte({
      accueil: reponse({ html: SITE_MODERNE.replace(/tel:0556123456/, "#") }),
    }));
    // Seul l'email en clair peut subsister sur un site vitrine : rien de majeur.
    expect(findings.filter((f) => f.severite !== "mineur").map((f) => f.regle)).toEqual([]);
  });

  it("détecte l'absence de HTTPS et un formulaire en clair", () => {
    const findings = evalueSecurite(contexte({
      accueil: reponse({ urlFinale: "http://garagemartin.fr", entetes: { "content-type": "text/html" } }),
      redirigeVersHttps: null,
    }));
    const ids = findings.map((f) => f.regle);

    expect(ids).toContain("sec_https_absent");
    expect(ids).toContain("sec_formulaire_non_chiffre");
    expect(ids).toContain("sec_csp_absente");
    expect(ids).not.toContain("sec_hsts_absent"); // sans HTTPS, HSTS n'a pas de sens
  });

  it("détecte un CMS obsolète, ses bibliothèques et sa version affichée", () => {
    const findings = evalueSecurite(contexte({
      accueil: reponse({ html: SITE_DATE, entetes: { "content-type": "text/html", server: "Apache/2.2.15" } }),
    }));
    const ids = findings.map((f) => f.regle);

    expect(ids).toContain("sec_cms_obsolete");
    expect(ids).toContain("sec_version_cms_visible");
    expect(ids).toContain("sec_lib_vulnerable");
    expect(ids).toContain("sec_divulgation_serveur");
    expect(findings.find((f) => f.regle === "sec_lib_vulnerable")?.constat).toContain("jQuery 1.7");
  });

  it("signale les défauts de protection email", () => {
    const findings = evalueSecurite(contexte({ dns: dns({ dmarc: "v=DMARC1; p=none" }) }));
    const ids = findings.map((f) => f.regle);

    expect(ids).toContain("sec_spf_absent");
    expect(ids).toContain("sec_dmarc_permissif");
    expect(ids).toContain("sec_mx_absent");
    expect(ids).not.toContain("sec_dmarc_absent");
  });

  it("évalue la protection email même si le site est injoignable", () => {
    const findings = evalueSecurite(contexte({ accueil: null, dns: dns({}) }));
    expect(findings.map((f) => f.regle)).toEqual(["sec_spf_absent", "sec_dmarc_absent", "sec_mx_absent"]);
  });

  it("ne conclut rien sur la protection email si le résolveur n'a pas répondu", () => {
    const findings = evalueSecurite(contexte({ accueil: null, dns: dns({}, false) }));
    expect(findings).toEqual([]);
  });

  it("signale les cookies non protégés et les fichiers exposés", () => {
    const findings = evalueSecurite(contexte({
      accueil: reponse({ cookies: ["PHPSESSID=abc; Path=/"] }),
      fichiersExposes: [
        { chemin: "/.env", statut: 200, indice: "Variables d'environnement" },
        { chemin: "/wp-content/uploads/", statut: 200, indice: "Listing" },
      ],
    }));
    const ids = findings.map((f) => f.regle);

    expect(ids).toContain("sec_cookies_non_securises");
    expect(ids).toContain("sec_fichier_expose");
    expect(ids).toContain("sec_listing_repertoire");
    expect(findings.find((f) => f.regle === "sec_fichier_expose")?.severite).toBe("critique");
  });
});

// ── Règles techniques ───────────────────────────────────────────────────────

describe("evalueTechnique", () => {
  it("ne signale rien sur un hébergement sain", () => {
    expect(evalueTechnique(contexte({ lighthouse: lighthouse() })).map((f) => f.regle)).toEqual([]);
  });

  it("conclut à l'indisponibilité seulement si le domaine ne résout pas", () => {
    const findings = evalueTechnique(
      contexte({ accueil: null, accessibilite: "injoignable", resolutionDns: false }),
    );
    expect(findings.map((f) => f.regle)).toEqual(["tech_site_injoignable"]);
    expect(findings[0].severite).toBe("critique");
  });

  it("ne conclut rien quand le site n'a pas pu être vu", () => {
    // Pare-feu applicatif ou blocage réseau : affirmer « site en panne » serait faux.
    expect(evalueTechnique(contexte({ accueil: null, accessibilite: "bloque" }))).toEqual([]);
    expect(
      evalueTechnique(contexte({ accueil: reponse({ statut: 403 }), accessibilite: "bloque" })),
    ).toEqual([]);
  });

  it("signale une erreur HTTP sans chercher plus loin", () => {
    const findings = evalueTechnique(
      contexte({ accueil: reponse({ statut: 500 }), accessibilite: "erreur_serveur" }),
    );
    expect(findings.map((f) => f.regle)).toEqual(["tech_erreur_http"]);
  });

  it("mesure lenteur, poids et absence de compression", () => {
    const findings = evalueTechnique(contexte({
      accueil: reponse({ dureeMs: 2600, octets: 120_000, entetes: { "content-type": "text/html" } }),
      lighthouse: lighthouse({
        performance: 28, octets: 4_200_000, requetes: 140,
        // TTFB ne vient QUE de la vraie mesure Google, pas du temps total de notre requête.
        audits: { "server-response-time": { note: null, reussi: false } },
      }),
    }));
    const ids = findings.map((f) => f.regle);

    expect(ids).toContain("tech_perf_faible");
    expect(ids).toContain("tech_page_lourde");
    expect(ids).toContain("tech_trop_de_requetes");
    expect(ids).toContain("tech_compression_absente");
    expect(ids).toContain("tech_ttfb_lent");
  });

  it("ne présente plus le temps total de requête comme un TTFB serveur (faux positif retiré)", () => {
    // dureeMs élevé mais AUCUNE mesure Lighthouse de server-response-time : on ne conclut rien
    // sur le serveur (le temps total inclut le téléchargement et notre propre latence réseau).
    const findings = evalueTechnique(contexte({
      accueil: reponse({ dureeMs: 5000, octets: 120_000, entetes: { "content-encoding": "gzip", "content-type": "text/html" } }),
      lighthouse: null,
    }));
    expect(findings.map((f) => f.regle)).not.toContain("tech_ttfb_lent");
    // Le check « protocole HTTP obsolète » déduit de l'absence d'alt-svc est supprimé.
    expect(findings.map((f) => f.regle)).not.toContain("tech_http2_absent");
  });
});

// ── Notation ────────────────────────────────────────────────────────────────

describe("notation", () => {
  it("note 100 partout quand rien n'est constaté", () => {
    expect(calculeScores([])).toEqual({
      global: 100, seo: 100, design: 100, securite: 100, technique: 100, urgence: "faible",
    });
  });

  it("retire le poids des défauts au pilier concerné", () => {
    const findings = [constate("seo_title_absent", ""), constate("seo_h1_absent", "")];
    expect(scorePilier(findings, "seo")).toBe(100 - 20 - 12);
    expect(scorePilier(findings, "securite")).toBe(100);
  });

  it("exclut du global un volet non mesuré, au lieu de compter un faux 100", () => {
    // Cas réel « Lighthouse en 429 » : des défauts SEO/sécurité, mais la performance non mesurée.
    const findings = [
      constate("seo_title_absent", ""),          // seo : 100 - 20 = 80
      constate("sec_https_absent", ""),          // securite : 100 - 40 = 60
    ];
    const avec = calculeScores(findings);                 // technique compté à 100
    const sans = calculeScores(findings, ["technique"]);  // technique exclu du global

    // Le volet technique reste à 100 dans le détail, mais ne gonfle plus le global.
    expect(sans.technique).toBe(100);
    expect(sans.global).toBeLessThan(avec.global);
    // Renormalisé sur seo+design+securite (poids 0.3+0.25+0.25 = 0.8) :
    // (80*0.3 + 100*0.25 + 60*0.25) / 0.8 = (24 + 25 + 15) / 0.8 = 80.
    expect(sans.global).toBe(80);
  });

  it("piliersNonMesures ne retient qu'un volet partiel ET sans défaut", () => {
    const findings = [constate("sec_https_absent", "")];
    // technique partiel + 0 défaut → non mesuré ; securite partiel mais a un défaut → mesuré.
    expect(piliersNonMesures(findings, ["technique", "securite"])).toEqual(["technique"]);
  });

  it("borne les scores à zéro et déclenche l'urgence critique", () => {
    const scores = calculeScores([
      constate("sec_https_absent", ""), constate("sec_fichier_expose", ""),
      constate("design_viewport_absent", ""), constate("seo_noindex", ""),
      constate("tech_site_injoignable", ""),
    ]);
    expect(scores.securite).toBe(25);
    expect(scores.technique).toBe(30);
    expect(scores.urgence).toBe("critique");
    expect(scores.global).toBeLessThan(50);
  });

  it("choisit un argument par pilier, du plus grave au moins grave", () => {
    const findings = [
      constate("seo_title_court", ""), constate("sec_https_absent", ""),
      constate("design_viewport_absent", ""), constate("seo_noindex", ""),
    ];
    const cles = argumentsCles(findings, 3);
    // Trié par gravité puis par poids : noindex (45) passe devant l'absence de HTTPS (40).
    expect(cles.map((f) => f.pilier)).toEqual(["seo", "securite", "design"]);
    expect(cles[0].regle).toBe("seo_noindex");
  });

  it("complète les arguments quand il y a moins de piliers que demandé", () => {
    const findings = [constate("seo_noindex", ""), constate("seo_title_absent", "")];
    expect(argumentsCles(findings, 3)).toHaveLength(2);
  });

  it("résume le volume de défauts", () => {
    expect(resumeSeverites([constate("seo_noindex", ""), constate("seo_title_court", "")]))
      .toBe("1 critique, 1 important");
    expect(resumeSeverites([])).toBe("aucun défaut bloquant");
  });
});

// ── Collecte (fetch simulé) ─────────────────────────────────────────────────

interface ReponseSimulee {
  statut?: number;
  corps?: string;
  entetes?: Record<string, string>;
  json?: unknown;
}

function fetchSimule(routes: Record<string, ReponseSimulee | (() => never)>, appels: string[] = []) {
  return (async (url: string) => {
    const cle = String(url);
    appels.push(cle);
    const trouve = Object.entries(routes).find(([motif]) => cle.startsWith(motif));
    if (!trouve) throw new Error(`hôte injoignable : ${cle}`);
    const valeur = trouve[1];
    if (typeof valeur === "function") valeur();
    const { statut = 200, corps = "", entetes = {}, json } = valeur as ReponseSimulee;
    return {
      ok: statut < 400,
      status: statut,
      url: cle,
      headers: { get: (nom: string) => entetes[nom.toLowerCase()] ?? null },
      text: async () => corps,
      json: async () => json ?? {},
      body: null,
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe("identité déduite d'une URL", () => {
  it("extrait le domaine sans www", () => {
    expect(domaine("https://www.garage-martin.fr/contact")).toBe("garage-martin.fr");
    expect(domaine("pas une url")).toBeNull();
  });

  it("déduit un nom présentable du domaine", () => {
    expect(nomDepuisDomaine("garage-martin.fr")).toBe("Garage Martin");
    expect(nomDepuisDomaine("www.smartfixx.fr")).toBe("Smartfixx");
    expect(nomDepuisDomaine("le_fournil_du_marche.com")).toBe("Le Fournil Du Marche");
  });
});

describe("normaliseUrl", () => {
  it("complète le schéma et rejette les saisies invalides", () => {
    expect(normaliseUrl("garagemartin.fr")).toBe("https://garagemartin.fr/");
    expect(normaliseUrl("http://garagemartin.fr/accueil")).toBe("http://garagemartin.fr/accueil");
    expect(normaliseUrl("pas-un-domaine")).toBeNull();
    expect(normaliseUrl("   ")).toBeNull();
  });

  it("accepte un hôte privé uniquement quand on l'autorise explicitement", () => {
    expect(normaliseUrl("http://127.0.0.1:8099/")).toBeNull();
    expect(normaliseUrl("http://127.0.0.1:8099/", true)).toBe("http://127.0.0.1:8099/");
  });

  it("refuse les hôtes internes et les schémas exotiques", () => {
    for (const saisie of [
      "http://localhost:8080",
      "http://127.0.0.1/",
      "https://169.254.169.254/latest/meta-data/",
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://172.16.4.2/",
      "https://serveur.internal/",
      "https://intranet.local/",
      "https://exemple.test/",
      "file:///etc/passwd",
    ]) {
      expect(normaliseUrl(saisie), saisie).toBeNull();
    }
    expect(hotePublic("garagemartin.fr")).toBe(true);
  });
});

describe("collecteurs", () => {
  const entetesHtml = { "content-type": "text/html" };

  it("lit robots.txt et le sitemap qu'il déclare", async () => {
    const appels: string[] = [];
    const impl = fetchSimule({
      "https://x.fr/robots.txt": { corps: "User-agent: *\nSitemap: https://x.fr/plan.xml", entetes: { "content-type": "text/plain" } },
      "https://x.fr/plan.xml": { corps: "<urlset><url><loc>https://x.fr/</loc></url></urlset>", entetes: { "content-type": "application/xml" } },
    }, appels);

    const robots = await collecteRobots("https://x.fr/", { fetchImpl: impl });
    expect(robots).toEqual({ present: true, contenu: expect.stringContaining("Sitemap") });
    const sitemap = await collecteSitemap("https://x.fr/", robots, { fetchImpl: impl });
    expect(sitemap).toEqual({ present: true, urls: 1 });
    expect(appels[1]).toBe("https://x.fr/plan.xml");
  });

  it("détecte une page 404 non personnalisée", async () => {
    const impl = fetchSimule({
      "https://x.fr/fidelipro-verification-404": { statut: 404, corps: "Not Found", entetes: entetesHtml },
    });
    expect(await collecte404("https://x.fr/", { fetchImpl: impl })).toEqual({ statut: 404, personnalisee: false });
  });

  it("lit SPF, DMARC et MX via DNS-over-HTTPS", async () => {
    const impl = fetchSimule({
      "https://cloudflare-dns.com/dns-query?name=x.fr&type=TXT": { json: { Status: 0, AD: true, Answer: [{ data: '"v=spf1 -all"' }] } },
      "https://cloudflare-dns.com/dns-query?name=x.fr&type=MX": { json: { Status: 0, Answer: [{ data: "10 mx.x.fr." }] } },
      "https://cloudflare-dns.com/dns-query?name=_dmarc.x.fr&type=TXT": { json: { Status: 0, Answer: [{ data: '"v=DMARC1; p=reject"' }] } },
    });
    expect(await collecteDns("https://x.fr/", { fetchImpl: impl })).toEqual({
      mx: { verifie: true, valeur: ["10 mx.x.fr."] },
      spf: { verifie: true, valeur: "v=spf1 -all" },
      dmarc: { verifie: true, valeur: "v=DMARC1; p=reject" },
      dnssec: { verifie: true, valeur: true },
    });
  });

  it("distingue « aucun enregistrement » de « résolveur injoignable »", async () => {
    const absent = fetchSimule({ "https://cloudflare-dns.com": { json: { Status: 3 } } });
    const resultat = await collecteDns("https://x.fr/", { fetchImpl: absent });
    expect(resultat?.spf).toEqual({ verifie: true, valeur: null });

    const injoignable = fetchSimule({});
    await expect(collecteDns("https://x.fr/", { fetchImpl: injoignable })).rejects.toThrow(/DNS/);
  });

  it("extrait scores, métriques et capture de PageSpeed Insights", async () => {
    const impl = fetchSimule({
      "https://www.googleapis.com/pagespeedonline": {
        json: {
          lighthouseResult: {
            categories: {
              performance: { score: 0.42 }, seo: { score: 0.71 },
              accessibility: { score: 0.66 }, "best-practices": { score: 0.83 },
            },
            audits: {
              "largest-contentful-paint": { numericValue: 4300 },
              "cumulative-layout-shift": { numericValue: 0.21 },
              "total-byte-weight": { numericValue: 3_100_000 },
              "network-requests": { details: { items: [1, 2, 3] } },
              "content-width": { score: 0 },
              "tap-targets": { score: null, scoreDisplayMode: "notApplicable" },
              "final-screenshot": { details: { data: "data:image/jpeg;base64,AAA" } },
            },
          },
        },
      },
    });
    const resultat = await collecteLighthouse("https://x.fr/", { fetchImpl: impl });

    expect(resultat?.performance).toBe(42);
    expect(resultat?.seo).toBe(71);
    expect(resultat?.lcpMs).toBe(4300);
    expect(resultat?.requetes).toBe(3);
    expect(resultat?.audits["content-width"].reussi).toBe(false);
    expect(resultat?.audits["tap-targets"].reussi).toBe(true);
    expect(resultat?.captureDataUri).toContain("data:image/jpeg");
  });

  it("remonte l'erreur PageSpeed sans la masquer", async () => {
    const impl = fetchSimule({ "https://www.googleapis.com": { statut: 429, corps: "quota" } });
    await expect(collecteLighthouse("https://x.fr/", { fetchImpl: impl })).rejects.toThrow(/429/);
  });

  it("ne retient un fichier exposé que si son contenu est caractéristique", async () => {
    const impl = fetchSimule({
      "https://x.fr/.env": { corps: "DB_PASSWORD=secret", entetes: { "content-type": "text/plain" } },
      "https://x.fr/.git/HEAD": { corps: "<html>page 404 personnalisée</html>", entetes: entetesHtml },
      "https://x.fr/phpinfo.php": { corps: "<html>Accueil du site</html>", entetes: entetesHtml },
    });
    const exposes = await sondeFichiers("https://x.fr/", { fetchImpl: impl, delaiSondeMs: 0 });

    expect(exposes.map((f) => f.chemin)).toEqual(["/.env"]);
    expect(FICHIERS_SONDES.length).toBeGreaterThan(5);
  });

  it("survit à la panne de chaque collecteur secondaire", async () => {
    const impl = fetchSimule({
      "https://x.fr/": { corps: SITE_MODERNE, entetes: entetesHtml },
      "https://www.googleapis.com": { statut: 500, corps: "boom" },
    });
    const ctx = await collecte("https://x.fr/", { fetchImpl: impl, avecLighthouse: true, delaiSondeMs: 0 });

    expect(ctx.accueil?.statut).toBe(200);
    expect(ctx.lighthouse).toBeNull();
    expect(ctx.erreurs.join(" ")).toContain("Lighthouse");
    // Un audit reste possible malgré les collecteurs en échec.
    expect(appliqueRegles(ctx).length).toBeGreaterThan(0);
  });
});

// ── Accessibilité : voir le site, ou ne rien affirmer ───────────────────────

describe("accessibilité du site", () => {
  const entetesHtml = { "content-type": "text/html" };

  it("reconnaît un blocage par pare-feu applicatif", () => {
    expect(estBlocageParPareFeu(reponse({ statut: 403, entetes: { "cf-ray": "8a1b2c3d" } }))).toBe(true);
    expect(estBlocageParPareFeu(reponse({ statut: 503, entetes: { server: "cloudflare" } }))).toBe(true);
    expect(estBlocageParPareFeu(reponse({ statut: 429, html: "<html>Just a moment…</html>" }))).toBe(true);
    // Une vraie erreur serveur ne doit pas être confondue avec un blocage.
    expect(estBlocageParPareFeu(reponse({ statut: 500, html: "<html>Erreur interne</html>" }))).toBe(false);
    expect(estBlocageParPareFeu(reponse({ statut: 200 }))).toBe(false);
  });

  it("classe un 403 de pare-feu en « bloqué » et n'émet aucun constat", async () => {
    const impl = fetchSimule({
      "https://protege.fr": {
        statut: 403,
        corps: "<html><body>Attention Required! | Cloudflare</body></html>",
        entetes: { ...entetesHtml, "cf-ray": "8a1b2c3d" },
      },
    });
    const ctx = await collecte("https://protege.fr/", { fetchImpl: impl });

    expect(ctx.accessibilite).toBe("bloque");
    expect(ctx.accueil).toBeNull();
    expect(appliqueRegles(ctx)).toEqual([]);
    expect(ctx.erreurs.join(" ")).toContain("anti-robot");
  });

  it("distingue un domaine mort d'un site simplement injoignable", async () => {
    const mort = fetchSimule({
      "https://cloudflare-dns.com/dns-query?name=disparu.fr&type=A": { json: { Status: 3 } },
      "https://cloudflare-dns.com/dns-query?name=disparu.fr&type=MX": { json: { Status: 3 } },
    });
    const ctxMort = await collecte("https://disparu.fr/", { fetchImpl: mort });
    expect(ctxMort.accessibilite).toBe("injoignable");
    expect(appliqueRegles(ctxMort).map((f) => f.regle)).toEqual(["tech_site_injoignable"]);

    const vivant = fetchSimule({
      "https://cloudflare-dns.com/dns-query?name=vivant.fr&type=A": { json: { Status: 0, Answer: [{ data: "1.2.3.4" }] } },
    });
    const ctxVivant = await collecte("https://vivant.fr/", { fetchImpl: vivant });
    expect(ctxVivant.accessibilite).toBe("bloque");
    expect(appliqueRegles(ctxVivant)).toEqual([]);
  });

  it("reste prudent quand le résolveur DNS ne répond pas non plus", async () => {
    const ctx = await collecte("https://inconnu.fr/", { fetchImpl: fetchSimule({}) });
    expect(ctx.resolutionDns).toBeNull();
    expect(ctx.accessibilite).toBe("bloque");
    expect(appliqueRegles(ctx)).toEqual([]);
  });

  it("résout un domaine via l'enregistrement MX quand il n'a pas d'adresse", async () => {
    const impl = fetchSimule({
      "https://cloudflare-dns.com/dns-query?name=courrier.fr&type=A": { json: { Status: 0 } },
      "https://cloudflare-dns.com/dns-query?name=courrier.fr&type=MX": { json: { Status: 0, Answer: [{ data: "10 mx.fr." }] } },
    });
    expect(await resoutDomaine("https://courrier.fr/", { fetchImpl: impl })).toBe(true);
  });
});

// ── Audit de bout en bout ───────────────────────────────────────────────────

describe("auditeSite", () => {
  it("marque l'audit non concluant quand le site est bloqué", async () => {
    const impl = fetchSimule({
      "https://protege.fr": {
        statut: 403,
        corps: "<html>Checking your browser…</html>",
        entetes: { "content-type": "text/html", "cf-ray": "abc" },
      },
      "https://cloudflare-dns.com": { json: { Status: 0, Answer: [{ data: "1.2.3.4" }] } },
    });
    const audit = await auditeSite("https://protege.fr/", { fetchImpl: impl, profondeur: "rapide" });

    expect(audit.concluant).toBe(false);
    expect(audit.accessibilite).toBe("bloque");
    expect(audit.findings).toEqual([]);
  });

  it("note très bas un site daté et injoignable en HTTPS", async () => {
    const impl = fetchSimule({
      "https://vieuxsite.fr": { corps: SITE_DATE, entetes: { "content-type": "text/html" } },
      "http://vieuxsite.fr": { corps: SITE_DATE, entetes: { "content-type": "text/html" } },
      "https://cloudflare-dns.com": { json: {} },
    });
    const audit = await auditeSite("vieuxsite.fr", {
      fetchImpl: impl, profondeur: "rapide", anneeCourante: 2026,
    });

    expect(audit.scores.global).toBeLessThan(60);
    expect(audit.scores.urgence).toBe("critique");
    expect(audit.findings[0].severite).toBe("critique");
    expect(audit.lighthouse).toBeNull();
    expect(audit.fichiersExposes).toEqual([]);
  });

  it("note haut un site moderne", async () => {
    const impl = fetchSimule({
      "https://garagemartin.fr": {
        corps: SITE_MODERNE,
        entetes: {
          "content-type": "text/html",
          "content-encoding": "br",
          "strict-transport-security": "max-age=31536000",
          "content-security-policy": "default-src 'self'",
          "x-frame-options": "DENY",
          "x-content-type-options": "nosniff",
          "referrer-policy": "same-origin",
        },
      },
      "https://cloudflare-dns.com/dns-query?name=garagemartin.fr&type=TXT": { json: { Answer: [{ data: '"v=spf1 -all"' }] } },
      "https://cloudflare-dns.com/dns-query?name=garagemartin.fr&type=MX": { json: { Answer: [{ data: "10 mx.fr." }] } },
      "https://cloudflare-dns.com/dns-query?name=_dmarc.garagemartin.fr&type=TXT": { json: { Answer: [{ data: '"v=DMARC1; p=reject"' }] } },
    });
    const audit = await auditeSite("https://garagemartin.fr/", {
      fetchImpl: impl, profondeur: "rapide", anneeCourante: 2026,
    });

    // Site propre : note élevée et aucun défaut critique. En profondeur « rapide », Lighthouse
    // n'est pas lancé : la performance est donc « non mesurée » et exclue du global plutôt que
    // comptée 100/100 — le global reste haut sans ce faux point parfait.
    expect(audit.scores.global).toBeGreaterThan(78);
    expect(audit.findings.filter((f) => f.severite === "critique")).toEqual([]);
    // La performance n'ayant pas été mesurée, le volet technique est signalé comme partiel.
    expect(audit.scores.partiels).toContain("technique");
    expect(audit.findings.filter((f) => f.pilier === "technique")).toEqual([]);
    expect(audit.emailContact).toBeNull();
  });

  it("n'audite pas une redirection vers un hôte interne", async () => {
    const impl = (async () => ({
      ok: true,
      status: 200,
      url: "http://169.254.169.254/latest/meta-data/",
      headers: { get: () => "text/html" },
      text: async () => "<html>metadonnees</html>",
      json: async () => ({}),
      body: null,
    })) as unknown as typeof fetch;

    const audit = await auditeSite("https://garagemartin.fr/", { fetchImpl: impl, profondeur: "rapide" });
    expect(audit.erreurs.join(" ")).toContain("hôte non public");
    expect(audit.findings.map((f) => f.regle)).toContain("tech_site_injoignable");
  });

  it("signale des traceurs seulement s'il n'y a aucun bandeau de consentement", () => {
    const avecGa = `<html><head><script src="https://www.googletagmanager.com/gtag/js?id=G-ABC"></script>
      </head><body>Garage</body></html>`;
    expect(traceurs(avecGa)).toContain("Google Analytics");
    expect(aBandeauConsentement(avecGa)).toBe(false);

    const ctxSansBandeau = contexte({ accueil: reponse({ html: avecGa }) });
    expect(evalueSecurite(ctxSansBandeau).map((f) => f.regle)).toContain("sec_traceurs_sans_consentement");

    // Solution de consentement présente : aucun constat, on n'a pas testé son comportement réel.
    const avecBandeau = avecGa.replace("<body>", `<body><script src="/tarteaucitron/tarteaucitron.js"></script>`);
    expect(aBandeauConsentement(avecBandeau)).toBe(true);
    const ctxAvecBandeau = contexte({ accueil: reponse({ html: avecBandeau }) });
    expect(evalueSecurite(ctxAvecBandeau).map((f) => f.regle)).not.toContain("sec_traceurs_sans_consentement");

    // Aucun traceur : rien à signaler non plus.
    const ctxSansTraceur = contexte({ accueil: reponse({ html: "<html><body>Garage</body></html>" }) });
    expect(evalueSecurite(ctxSansTraceur).map((f) => f.regle)).not.toContain("sec_traceurs_sans_consentement");
  });

  it("détecte la duplication www / sans www, et s'abstient si l'autre adresse ne répond pas", async () => {
    // Les deux formes servent la page : contenu dupliqué.
    const duplique = fetchSimule({ "https://www.garage-martin.fr/": { corps: "<html>Garage</html>" } });
    expect(await verifieDuplicationWww(reponse({ urlFinale: "https://garage-martin.fr/" }), { fetchImpl: duplique }))
      .toBe(true);

    // Redirection vers la forme canonique : rien à signaler.
    const redirige = (async () => ({
      ok: true, status: 200, url: "https://garage-martin.fr/",
      headers: { get: () => "text/html" }, text: async () => "<html>Garage</html>", json: async () => ({}), body: null,
    })) as unknown as typeof fetch;
    expect(await verifieDuplicationWww(reponse({ urlFinale: "https://garage-martin.fr/" }), { fetchImpl: redirige }))
      .toBe(false);

    // Autre adresse injoignable : question non tranchée, donc aucun constat.
    const injoignable = fetchSimule({});
    expect(await verifieDuplicationWww(reponse({ urlFinale: "https://garage-martin.fr/" }), { fetchImpl: injoignable }))
      .toBeNull();
    expect(evalueSeo(contexte({ wwwDuplique: null })).map((f) => f.regle)).not.toContain("seo_www_duplique");
    expect(evalueSeo(contexte({ wwwDuplique: true })).map((f) => f.regle)).toContain("seo_www_duplique");
  });

  it("ne sonde pas les chemins interdits par le robots.txt", async () => {
    const robots = "User-agent: *\nDisallow: /.env\nDisallow: /admin\n";
    expect(cheminsInterdits(robots)).toEqual(["/.env", "/admin"]);
    expect(cheminAutorise("/.env", cheminsInterdits(robots))).toBe(false);
    expect(cheminAutorise("/backup.zip", cheminsInterdits(robots))).toBe(true);
    // Un robots.txt qui interdit tout arrête le sondage complet.
    expect(cheminAutorise("/backup.zip", cheminsInterdits("User-agent: *\nDisallow: /"))).toBe(false);
    // Les consignes destinées à un autre robot ne nous concernent pas.
    expect(cheminsInterdits("User-agent: AhrefsBot\nDisallow: /")).toEqual([]);

    const appels: string[] = [];
    const impl = fetchSimule({ "https://garage-martin.fr/": { corps: "secret" } }, appels);
    await sondeFichiers("https://garage-martin.fr/", { fetchImpl: impl, delaiSondeMs: 0 }, robots);
    expect(appels).not.toContain("https://garage-martin.fr/.env");
    expect(appels).toContain("https://garage-martin.fr/backup.zip");
  });

  it("rejette une adresse invalide sans lancer de requête", async () => {
    const audit = await auditeSite("pas-une-url", {
      fetchImpl: (() => { throw new Error("ne doit pas être appelé"); }) as unknown as typeof fetch,
    });
    expect(audit.erreurs[0]).toContain("Adresse invalide");
    expect(audit.findings).toEqual([]);
  });
});

describe("récupération des coordonnées", () => {
  it("lit les emails dans les liens mailto, le texte et les adresses masquées", () => {
    const html = `<html><body>
      <a href="mailto:Contact@Garage-Martin.fr?subject=Devis">Écrivez-nous</a>
      <p>Direction : marie.dupont@garage-martin.fr</p>
      <p>Comptabilité : compta [at] garage-martin [point] fr</p>
      <a class="__cf_email__" data-cfemail="c9a4a8b3a1e9b8a4a3adaba8b3a1e989a4a8aae7aaa6a4">[email&#160;protected]</a>
      <img src="logo@2x.png"> <span>noreply@garage-martin.fr</span>
    </body></html>`;

    const emails = emailsDepuisHtml(html);
    expect(emails).toContain("contact@garage-martin.fr");
    expect(emails).toContain("marie.dupont@garage-martin.fr");
    expect(emails).toContain("compta@garage-martin.fr");
    // masqué par Cloudflare : décodé comme le navigateur le fait
    expect(emails.some((e) => e.endsWith("@garage-martin.fr") && e.includes("@"))).toBe(true);
    // technique ou inexploitable : jamais proposé comme interlocuteur
    expect(emails).not.toContain("noreply@garage-martin.fr");
    expect(emails.join(" ")).not.toContain("logo@2x.png");
  });

  it("décode une adresse protégée par Cloudflare", () => {
    // « contact@site.fr » chiffré avec la clé 0x2a (XOR octet par octet)
    const clair = "contact@site.fr";
    const cle = 0x2a;
    const hexa = [cle, ...[...clair].map((c) => c.charCodeAt(0) ^ cle)]
      .map((o) => o.toString(16).padStart(2, "0")).join("");
    expect(decodeEmailsProteges(`<a data-cfemail="${hexa}">x</a>`)).toEqual([clair]);
  });

  it("remet en forme les adresses écrites contre les robots", () => {
    expect(deobfusqueEmails("contact (at) site (point) fr")).toContain("contact@site.fr");
    expect(deobfusqueEmails("contact [arobase] site.fr")).toContain("contact@site.fr");
  });

  it("normalise les téléphones français et écarte les numéros surtaxés", () => {
    const html = `<a href="tel:+33556123456">05.56.12.34.56</a>
      <p>Standard : 08 92 70 12 34</p><p>Mobile 06-12-34-56-78</p>`;
    const telephones = telephonesDepuisHtml(html);
    expect(telephones).toContain("05 56 12 34 56");
    expect(telephones).toContain("06 12 34 56 78");
    expect(telephones.some((t) => t.startsWith("08 92"))).toBe(false);
  });

  it("formate un numéro par paires de chiffres", () => {
    expect(formateTelephone("0556123456")).toBe("05 56 12 34 56");
  });

  it("trouve le lien de la fiche Google publié sur le site", () => {
    expect(lienGoogleMaps(`<a href="https://maps.app.goo.gl/AbCdEf123">Nous trouver</a>`))
      .toBe("https://maps.app.goo.gl/AbCdEf123");
    expect(lienGoogleMaps(`<iframe src="https://www.google.com/maps/embed?pb=!1m18!2sfr"></iframe>`))
      .toContain("google.com/maps");
    expect(lienGoogleMaps(`<a href="https://g.page/garage-martin">Avis</a>`)).toBe("https://g.page/garage-martin");
    // aucune fiche publiée : on n'en invente pas
    expect(lienGoogleMaps("<html><body>Garage Martin</body></html>")).toBeNull();
  });

  it("repère les réseaux sociaux", () => {
    const reseaux = reseauxSociaux(`
      <a href="https://www.facebook.com/garagemartin">fb</a>
      <a href="https://instagram.com/garagemartin">insta</a>`);
    expect(reseaux.facebook).toContain("facebook.com/garagemartin");
    expect(reseaux.instagram).toContain("instagram.com/garagemartin");
    expect(reseaux.linkedin).toBeNull();
  });

  it("classe l'adresse du domaine et l'adresse générique en premier", () => {
    const page = (url: string, html: string): ReponseHttp => ({
      url, urlFinale: url, statut: 200, html, entetes: {}, cookies: [], dureeMs: 10, octets: html.length,
    });
    const contacts = agregeContacts(
      [
        page("https://garage-martin.fr/", "<p>garagemartin33@gmail.com</p>"),
        page("https://garage-martin.fr/contact", `<a href="mailto:contact@garage-martin.fr">nous</a>
          <p>marie.dupont@garage-martin.fr</p><a href="tel:0556123456">tel</a>`),
      ],
      "garage-martin.fr",
    );

    expect(contacts.email).toBe("contact@garage-martin.fr");
    expect(contacts.emails).toEqual([
      "contact@garage-martin.fr",
      "marie.dupont@garage-martin.fr",
      "garagemartin33@gmail.com",
    ]);
    expect(contacts.telephone).toBe("05 56 12 34 56");
    expect(contacts.sources).toEqual(["https://garage-martin.fr/", "https://garage-martin.fr/contact"]);
  });

  it("propose une recherche Google Maps quand le site n'en publie pas", () => {
    const lien = rechercheGoogleMaps("Garage Martin", "Bordeaux", "33000");
    expect(lien).toContain("google.com/maps/search");
    expect(decodeURIComponent(lien)).toContain("Garage Martin 33000 Bordeaux");
  });

  it("ne relit pas une page déjà récupérée comme page interne", async () => {
    const accueil = `<html><head><title>Garage Martin, mécanique générale</title></head><body>
      <h1>Garage Martin</h1><a href="/contact">Contact</a>
      ${"Entretien, réparation, pneus à Bordeaux. ".repeat(20)}</body></html>`;
    const appels: string[] = [];
    const impl = fetchSimule({
      "https://garage-martin.fr/contact": { corps: `<a href="mailto:contact@garage-martin.fr">Écrire</a>` },
      "https://garage-martin.fr/": { corps: accueil },
    }, appels);

    const audit = await auditeSite("https://garage-martin.fr/", { fetchImpl: impl, profondeur: "rapide" });

    expect(audit.emailContact).toBe("contact@garage-martin.fr");
    // la page contact est aussi la première page interne : une seule requête, une seule source
    expect(appels.filter((a) => a === "https://garage-martin.fr/contact")).toHaveLength(1);
    expect(audit.contacts.sources).toEqual(["https://garage-martin.fr/contact"]);
  });

  it("lit la page contact liée depuis l'accueil pour compléter les coordonnées", async () => {
    const accueil = `<html><head><title>Garage Martin, mécanique</title></head><body>
      <h1>Garage Martin</h1><a href="/nous-contacter">Contact</a>
      ${"Entretien, réparation, pneus à Bordeaux. ".repeat(20)}</body></html>`;
    // Les routes sont testées par préfixe : la plus spécifique d'abord.
    const impl = fetchSimule({
      "https://garage-martin.fr/nous-contacter": {
        corps: `<html><body><a href="mailto:contact@garage-martin.fr">Écrire</a>
          <a href="https://maps.app.goo.gl/ZzZ">Voir sur Google Maps</a>
          <a href="tel:0556123456">05 56 12 34 56</a></body></html>`,
      },
      "https://garage-martin.fr/": { corps: accueil },
    });

    const audit = await auditeSite("https://garage-martin.fr/", { fetchImpl: impl, profondeur: "rapide" });

    expect(audit.emailContact).toBe("contact@garage-martin.fr");
    expect(audit.telephone).toBe("05 56 12 34 56");
    expect(audit.contacts.googleMaps).toBe("https://maps.app.goo.gl/ZzZ");
    expect(audit.contacts.sources).toContain("https://garage-martin.fr/nous-contacter");
  });
});

describe("robustesse face à une page hostile", () => {
  // Une page peut contenir n'importe quoi. Ces motifs faisaient s'effondrer les expressions
  // régulières (12 s de blocage sur 100 000 chiffres) : l'audit doit rester quasi instantané.
  const BUDGET_MS = 3000;

  const pages: Array<[string, string]> = [
    ["100 000 chiffres", `<html><body>${"0".repeat(100_000)}</body></html>`],
    ["100 000 lettres", `<html><body>${"a".repeat(100_000)}</body></html>`],
    ["domaine à tirets interminable", `<html><body>x@${"a-".repeat(5000)}!</body></html>`],
    ["arobases en masse", `<html><body>${"a@".repeat(50_000)}</body></html>`],
    ["lien tel démesuré", `<html><body><a href="tel:${"1".repeat(50_000)}">x</a></body></html>`],
    ["page de 1 Mo", `<html><body>${"lorem ipsum 06 12 34 56 78 contact@site.fr ".repeat(25_000)}</body></html>`],
  ];

  it.each(pages)("applique les règles sur « %s » sans s'effondrer", (_nom, page) => {
    const debut = Date.now();
    const ctx = contexte({ accueil: reponse({ html: page, octets: page.length }) });
    expect(appliqueRegles(ctx).length).toBeGreaterThan(0);
    expect(Date.now() - debut).toBeLessThan(BUDGET_MS);
  });

  it.each(pages)("extrait les coordonnées de « %s » sans s'effondrer", (_nom, page) => {
    const debut = Date.now();
    emailsDepuisHtml(page);
    telephonesDepuisHtml(page);
    lienGoogleMaps(page);
    expect(Date.now() - debut).toBeLessThan(BUDGET_MS);
  });

  it("trouve quand même les coordonnées dans une page très longue", () => {
    const page = `<html><body>${"lorem ipsum ".repeat(30_000)}<p>05 56 78 12 34</p>
      <a href="mailto:contact@garage.fr">nous écrire</a></body></html>`;
    expect(emailsDepuisHtml(page)).toContain("contact@garage.fr");
    expect(telephonesDepuisHtml(page)).toContain("05 56 78 12 34");
  });

  it("n'interroge pas l'hôte alternatif s'il n'est pas public", async () => {
    const appels: string[] = [];
    const impl = fetchSimule({ "http://": { corps: "x" } }, appels);
    const resultat = await verifieDuplicationWww(
      reponse({ urlFinale: "http://intranet.local/" }),
      { fetchImpl: impl },
    );
    expect(resultat).toBeNull();
    expect(appels).toEqual([]);
  });
});

describe("volets partiellement mesurés", () => {
  it("signale les volets dont une source a manqué", () => {
    // Lighthouse absent : performance, accessibilité et note SEO manquent.
    const sansLighthouse = piliersPartiels(contexte({ lighthouse: null }));
    expect(sansLighthouse).toContain("technique");
    expect(sansLighthouse).toContain("design");
    expect(sansLighthouse).toContain("seo");

    // Résolveur DNS muet : on ne peut rien conclure sur SPF / DMARC.
    expect(piliersPartiels(contexte({ dns: null }))).toContain("securite");
    expect(piliersPartiels(contexte({
      dns: { mx: { verifie: true, valeur: [] }, spf: { verifie: false, valeur: null }, dmarc: { verifie: true, valeur: null }, dnssec: { verifie: true, valeur: true } },
    }))).toContain("securite");

    // Sondage désactivé (audit rapide) : les fichiers exposés n'ont pas été cherchés.
    expect(piliersPartiels(contexte({ fichiersExposes: null }))).toContain("securite");

    // Pages annexes non lues : le référencement n'est que partiellement mesuré.
    expect(piliersPartiels(contexte({ robots: null }))).toContain("seo");
  });

  it("ne signale rien quand tout a été mesuré", () => {
    const complet = contexte({
      lighthouse: {
        performance: 40, seo: 70, accessibilite: 60, bonnesPratiques: 70,
        lcpMs: 3000, cls: 0.05, tbtMs: 200, octets: 900_000, requetes: 40,
        audits: {}, terrain: null, captureDataUri: null,
      },
      fichiersExposes: [],
      liens: { verifies: 12, casses: [] },
      imagesMesurees: [],
    });
    expect(piliersPartiels(complet)).toEqual([]);
  });

  it("porte l'information dans le résultat de l'audit", async () => {
    // Sans clé PageSpeed et sans DNS joignable, le volet technique afficherait 100/100 :
    // le rapport doit dire que la mesure est partielle.
    const impl = fetchSimule({
      "https://garage-martin.fr/": {
        corps: `<html><head><title>Garage Martin, mécanique générale à Bordeaux</title>
          <meta name="description" content="${"Entretien et réparation toutes marques à Bordeaux. ".repeat(3)}">
          <meta name="viewport" content="width=device-width"></head>
          <body><h1>Garage Martin</h1>${"Entretien, réparation, pneus. ".repeat(30)}</body></html>`,
      },
    });
    const audit = await auditeSite("https://garage-martin.fr/", { fetchImpl: impl, profondeur: "rapide" });
    expect(audit.scores.partiels).toContain("technique");
    expect(audit.scores.partiels).toContain("securite");
  });
});

describe("seconde chance sur la page d'accueil", () => {
  it("réessaie une fois avant de déclarer un site non analysable", async () => {
    let appels = 0;
    // Premier appel : incident réseau. Second : le site répond normalement.
    const impl = (async (url: string) => {
      appels++;
      if (appels === 1) throw new Error("ECONNRESET");
      return {
        ok: true, status: 200, url: String(url),
        headers: { get: (nom: string) => (nom.toLowerCase() === "content-type" ? "text/html" : null) },
        text: async () => `<html><head><title>Garage Martin, mécanique à Bordeaux</title></head>
          <body><h1>Garage Martin</h1>${"Entretien et réparation. ".repeat(30)}</body></html>`,
        json: async () => ({}),
        body: null,
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const audit = await auditeSite("https://garage-martin.fr/", { fetchImpl: impl, profondeur: "rapide" });

    expect(appels).toBeGreaterThan(1);
    expect(audit.concluant).toBe(true);
    expect(audit.accessibilite).toBe("ok");
  });

  it("conclut à l'impossibilité d'analyser si les deux tentatives échouent", async () => {
    const impl = (async () => { throw new Error("timeout"); }) as unknown as typeof fetch;
    const audit = await auditeSite("https://garage-martin.fr/", { fetchImpl: impl, profondeur: "rapide" });
    expect(audit.concluant).toBe(false);
    expect(audit.findings).toEqual([]);
  });
});

describe("certificat HTTPS invalide", () => {
  /** Erreur de fetch telle que Node la remonte quand la poignée de main TLS échoue. */
  function echecTls(code: string) {
    const erreur = new TypeError("fetch failed");
    (erreur as unknown as { cause: { code: string; message: string } }).cause =
      { code, message: `certificate error: ${code}` };
    return erreur;
  }

  it("traduit les codes TLS en motif lisible", () => {
    expect(causeEchec(echecTls("CERT_HAS_EXPIRED"))).toEqual({
      code: "CERT_HAS_EXPIRED", message: "certificat expiré", certificat: true,
    });
    expect(causeEchec(echecTls("ERR_TLS_CERT_ALTNAME_INVALID")).message)
      .toBe("certificat délivré pour un autre domaine");
    // Une panne réseau ordinaire n'est pas un problème de certificat.
    expect(causeEchec(echecTls("ECONNREFUSED")).certificat).toBe(false);
  });

  it("audite le contenu en HTTP et constate le certificat cassé", async () => {
    const appels: string[] = [];
    const impl = (async (url: string) => {
      appels.push(String(url));
      if (String(url).startsWith("https://")) throw echecTls("CERT_HAS_EXPIRED");
      return {
        ok: true, status: 200, url: String(url),
        headers: { get: (nom: string) => (nom.toLowerCase() === "content-type" ? "text/html" : null) },
        text: async () => `<html><head><title>Garage Martin, mécanique à Bordeaux</title></head>
          <body><h1>Garage Martin</h1>${"Entretien et réparation. ".repeat(30)}</body></html>`,
        json: async () => ({}), body: null,
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const audit = await auditeSite("https://garage-martin.fr/", { fetchImpl: impl, profondeur: "rapide" });

    // Le site est analysé (contenu lu en HTTP) et le défaut est nommé précisément.
    expect(audit.concluant).toBe(true);
    const certificat = audit.findings.find((f) => f.regle === "sec_certificat_invalide");
    expect(certificat?.constat).toContain("certificat expiré");
    expect(certificat?.severite).toBe("critique");
    // Une seule tentative HTTPS : inutile de réessayer, le certificat ne va pas changer.
    expect(appels.filter((a) => a.startsWith("https://garage-martin.fr/")).length).toBe(1);
  });

  it("reste concluant quand même le HTTP ne répond pas, au lieu de dire « analyse impossible »", async () => {
    const impl = (async (url: string) => { throw echecTls(String(url).startsWith("https") ? "CERT_HAS_EXPIRED" : "ECONNREFUSED"); }) as unknown as typeof fetch;
    const audit = await auditeSite("https://garage-martin.fr/", { fetchImpl: impl, profondeur: "rapide" });

    expect(audit.accessibilite).toBe("erreur_serveur");
    expect(audit.concluant).toBe(true);
    expect(audit.findings.map((f) => f.regle)).toContain("sec_certificat_invalide");
    expect(audit.erreurs.join(" ")).toContain("certificat expiré");
    // Les notes sont annoncées comme partielles : rien du contenu n'a pu être mesuré.
    expect(audit.scores.partiels).toEqual(["seo", "design", "securite", "technique"]);
  });
});

describe("plateforme du site", () => {
  it("reconnaît les plateformes qui se déclarent", () => {
    expect(technologie(`<img src="https://static.wixstatic.com/media/x.jpg">`)).toBe("Wix");
    expect(technologie(`<link href="/wp-content/themes/x/style.css">`)).toBe("WordPress");
    expect(technologie(`<script src="https://cdn.shopify.com/s/files/x.js">`)).toBe("Shopify");
    expect(technologie("<html><body>site sur mesure</body></html>", {})).toBeNull();
    // Un en-tête propre à la plateforme suffit, même sans indice dans le HTML.
    expect(technologie("<html></html>", { "x-shopid": "12345" })).toBe("Shopify");
  });

  it("porte la plateforme dans le résultat de l'audit et dans le script d'appel", async () => {
    const impl = fetchSimule({
      "https://boutique.fr/": {
        corps: `<html><head><title>Boutique en ligne de créateurs à Bordeaux</title>
          <meta name="generator" content="WordPress 6.5"></head>
          <body><h1>Boutique</h1><link href="/wp-content/x.css">${"Vente de créations. ".repeat(30)}</body></html>`,
      },
    });
    const audit = await auditeSite("https://boutique.fr/", { fetchImpl: impl, profondeur: "rapide" });
    expect(audit.technologie).toBe("WordPress");
  });
});

describe("historique Internet Archive", () => {
  const reponseCdx = (lignes: string[][]) => ({
    corps: JSON.stringify([["timestamp", "digest"], ...lignes]),
  });

  it("lit la date d'apparition du contenu actuel et la première capture", async () => {
    const impl = (async (url: string) => {
      // `limit=1` → première capture ; `limit=-40` → dernières versions.
      const premiere = String(url).includes("limit=1&") || String(url).endsWith("limit=1");
      const corps = premiere
        ? reponseCdx([["20090412120000", "AAA"]]).corps
        : reponseCdx([
          ["20090412120000", "AAA"],
          ["20120310090000", "BBB"],
          ["20150620143000", "CCC"],
        ]).corps;
      return {
        ok: true, status: 200, url: String(url),
        headers: { get: () => "application/json" },
        text: async () => corps, json: async () => JSON.parse(corps), body: null,
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const archive = await collecteArchive("https://garage-martin.fr/", { fetchImpl: impl });
    expect(archive).toEqual({
      premiereCapture: "2009-04-12",
      derniereCapture: "2015-06-20",
      inchangeDepuis: "2015-06-20",
      versions: 3,
    });
  });

  it("ne conclut rien quand l'archive ne connaît pas le site", async () => {
    const vide = fetchSimule({ "https://web.archive.org/": { corps: "[]" } });
    expect(await collecteArchive("https://tout-neuf.fr/", { fetchImpl: vide })).toBeNull();
    // Pas d'archive : aucun constat « site figé ».
    expect(evalueSeo(contexte({ archive: null })).map((f) => f.regle)).not.toContain("seo_site_fige");
  });

  it("constate un site figé au-delà de trois ans, en citant la date", () => {
    const findings = evalueSeo(contexte({
      anneeCourante: 2026,
      archive: { premiereCapture: "2009-04-12", derniereCapture: "2015-06-20", inchangeDepuis: "2015-06-20", versions: 3 },
    }));
    const fige = findings.find((f) => f.regle === "seo_site_fige");
    expect(fige?.constat).toContain("2015-06-20");
    expect(fige?.constat).toContain("11 ans");

    // Un site retouché l'an dernier n'est pas figé.
    expect(evalueSeo(contexte({
      anneeCourante: 2026,
      archive: { premiereCapture: "2009-04-12", derniereCapture: "2025-11-02", inchangeDepuis: "2025-11-02", versions: 12 },
    })).map((f) => f.regle)).not.toContain("seo_site_fige");
  });

  it("convertit les horodatages de l'archive", () => {
    expect(dateDepuisHorodatage("20150620143000")).toBe("2015-06-20");
    expect(dateDepuisHorodatage("bidon")).toBeNull();
  });
});

describe("liens et images vérifiés sur le site", () => {
  it("cite les liens cassés, et retente en GET quand HEAD est refusé", async () => {
    const appels: string[] = [];
    const impl = (async (url: string, init?: RequestInit) => {
      const adresse = String(url);
      appels.push(`${init?.method ?? "GET"} ${adresse}`);
      const statut = adresse.endsWith("/devis") ? 404
        : adresse.endsWith("/services") && init?.method === "HEAD" ? 405
        : 200;
      return {
        ok: statut < 400, status: statut, url: adresse,
        headers: { get: () => "text/html" }, text: async () => "<html></html>",
        json: async () => ({}), body: null,
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const accueil = reponse({
      html: `<a href="/services">Services</a><a href="/devis">Devis</a><a href="/contact">Contact</a>`,
    });
    const resultat = await verifieLiens(accueil, { fetchImpl: impl, delaiSondeMs: 0 });

    expect(resultat.verifies).toBe(3);
    expect(resultat.casses.map((c) => c.url)).toEqual(["https://garagemartin.fr/devis"]);
    // HEAD refusé sur /services : une seconde tentative en GET avant de conclure.
    expect(appels).toContain("HEAD https://garagemartin.fr/services");
    expect(appels).toContain("GET https://garagemartin.fr/services");

    const findings = evalueSeo(contexte({ liens: resultat }));
    const morts = findings.find((f) => f.regle === "seo_liens_morts");
    expect(morts?.constat).toContain("/devis (404)");
    expect(morts?.constat).toContain("sur 3 vérifié");
  });

  it("mesure le poids réel des images et nomme la plus lourde", async () => {
    const tailles: Record<string, string> = {
      "https://garagemartin.fr/banniere.jpg": "4200000",
      "https://garagemartin.fr/atelier.jpg": "150000",
    };
    const impl = (async (url: string) => ({
      ok: true, status: 200, url: String(url),
      headers: { get: (nom: string) => (nom.toLowerCase() === "content-length" ? tailles[String(url)] ?? null : null) },
      text: async () => "", json: async () => ({}), body: null,
    })) as unknown as typeof fetch;

    const accueil = reponse({
      html: `<img src="/banniere.jpg"><img src="/atelier.jpg"><img src="data:image/gif;base64,R0lGOD">`,
    });
    const mesurees = await mesureImages(accueil, { fetchImpl: impl, delaiSondeMs: 0 });

    expect(mesurees.map((i) => i.octets)).toEqual([4_200_000, 150_000]);
    const finding = evalueDesign(contexte({ imagesMesurees: mesurees }))
      .find((f) => f.regle === "design_image_lourde");
    expect(finding?.constat).toContain("banniere.jpg");
    expect(finding?.constat).toContain("4,2 Mo");
  });

  it("ne signale rien quand les images sont légères", () => {
    const findings = evalueDesign(contexte({
      imagesMesurees: [{ url: "https://garagemartin.fr/logo.webp", octets: 40_000 }],
    }));
    expect(findings.map((f) => f.regle)).not.toContain("design_image_lourde");
  });
});

describe("certificat TLS", () => {
  const certificat = (surcharge = {}) => ({
    emetteur: "Let's Encrypt", expireLe: "2026-09-12", joursRestants: 60,
    protocole: "TLSv1.3", domaineCouvert: true, ...surcharge,
  });

  it("lit le certificat via le lecteur injecté, et ignore les sites en HTTP", async () => {
    const lecteur = async () => certificat();
    expect(await litCertificat("https://garage-martin.fr/", { lecteur })).toEqual(certificat());
    expect(await litCertificat("http://garage-martin.fr/", { lecteur })).toBeNull();
    expect(await litCertificat("pas-une-url", { lecteur })).toBeNull();
  });

  it("alerte sur une expiration proche et sur un protocole dépassé", () => {
    const proche = evalueSecurite(contexte({ certificat: certificat({ joursRestants: 9 }) }));
    const alerte = proche.find((f) => f.regle === "sec_certificat_bientot_expire");
    expect(alerte?.constat).toContain("9 jour(s)");
    expect(alerte?.constat).toContain("Let's Encrypt");

    const vieux = evalueSecurite(contexte({ certificat: certificat({ protocole: "TLSv1" }) }));
    expect(vieux.find((f) => f.regle === "sec_tls_obsolete")?.constat).toContain("TLSv1");

    // Certificat sain : aucun constat.
    const sain = evalueSecurite(contexte({ certificat: certificat() })).map((f) => f.regle);
    expect(sain).not.toContain("sec_certificat_bientot_expire");
    expect(sain).not.toContain("sec_tls_obsolete");
  });

  it("dit depuis combien de jours un certificat est expiré", () => {
    const finding = evalueSecurite(contexte({ certificat: certificat({ joursRestants: -4 }) }))
      .find((f) => f.regle === "sec_certificat_bientot_expire");
    expect(finding?.constat).toContain("expiré depuis 4 jour(s)");
  });
});

describe("mesures des visiteurs réels (données terrain)", () => {
  it("extrait les données terrain de la réponse PageSpeed", async () => {
    const corps = JSON.stringify({
      loadingExperience: {
        overall_category: "SLOW",
        metrics: {
          LARGEST_CONTENTFUL_PAINT_MS: { percentile: 4200, category: "SLOW" },
          INTERACTION_TO_NEXT_PAINT: { percentile: 310, category: "AVERAGE" },
          CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 18, category: "AVERAGE" },
        },
      },
      lighthouseResult: { categories: { performance: { score: 0.3 } }, audits: {} },
    });
    const impl = (async () => ({
      ok: true, status: 200, url: "https://psi",
      headers: { get: () => "application/json" },
      text: async () => corps, json: async () => JSON.parse(corps), body: null,
    })) as unknown as typeof fetch;

    const resultat = await collecteLighthouse("https://garage-martin.fr/", { fetchImpl: impl });
    expect(resultat?.terrain).toEqual({ lcpMs: 4200, inpMs: 310, cls: 0.18, categorie: "SLOW" });
  });

  it("constate la lenteur vécue par les visiteurs, pas seulement le test de laboratoire", () => {
    const lent = evalueTechnique(contexte({
      lighthouse: lighthouse({ terrain: { lcpMs: 4200, inpMs: 310, cls: 0.18, categorie: "SLOW" } }),
    }));
    const finding = lent.find((f) => f.regle === "tech_terrain_lent");
    expect(finding?.constat).toContain("4,2 s");
    expect(finding?.constat).toContain("visiteurs réels");

    // Trafic insuffisant pour des données terrain : aucun constat inventé.
    expect(evalueTechnique(contexte({ lighthouse: lighthouse({ terrain: null }) }))
      .map((f) => f.regle)).not.toContain("tech_terrain_lent");
  });
});

describe("sécurité approfondie : qualité des en-têtes", () => {
  const avecEntetes = (entetes: Record<string, string>) =>
    contexte({ accueil: reponse({ urlFinale: "https://garagemartin.fr/", entetes: { "content-type": "text/html", ...entetes } }) });

  it("distingue une politique de sécurité réelle d'une politique de façade", () => {
    // Présente mais inopérante : les scripts inline restent autorisés.
    const permissive = evalueSecurite(avecEntetes({
      "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    }));
    const finding = permissive.find((f) => f.regle === "sec_csp_permissive");
    expect(finding?.constat).toContain("unsafe-inline");
    expect(finding?.constat).toContain("unsafe-eval");
    expect(permissive.map((f) => f.regle)).not.toContain("sec_csp_absente");

    // Politique stricte : aucun constat.
    const stricte = evalueSecurite(avecEntetes({
      "content-security-policy": "default-src 'self'; script-src 'self'; frame-ancestors 'none'",
    })).map((f) => f.regle);
    expect(stricte).not.toContain("sec_csp_permissive");
    expect(stricte).not.toContain("sec_csp_absente");
  });

  it("mesure la durée du forçage HTTPS au lieu de se contenter de sa présence", () => {
    const court = evalueSecurite(avecEntetes({ "strict-transport-security": "max-age=86400" }));
    expect(court.find((f) => f.regle === "sec_hsts_faible")?.constat).toContain("1 jour(s)");

    const correct = evalueSecurite(avecEntetes({
      "strict-transport-security": "max-age=31536000; includeSubDomains",
    })).map((f) => f.regle);
    expect(correct).not.toContain("sec_hsts_faible");
    expect(correct).not.toContain("sec_hsts_absent");
  });

  it("ne signale le partage de ressources ouvert que s'il porte les identifiants de session", () => {
    const dangereux = evalueSecurite(avecEntetes({
      "access-control-allow-origin": "*",
      "access-control-allow-credentials": "true",
    }));
    expect(dangereux.map((f) => f.regle)).toContain("sec_cors_permissif");

    // Étoile seule : courant et sans danger pour un site vitrine, donc aucun constat.
    expect(evalueSecurite(avecEntetes({ "access-control-allow-origin": "*" })).map((f) => f.regle))
      .not.toContain("sec_cors_permissif");
  });
});

describe("sécurité approfondie : composants et chaîne d'approvisionnement", () => {
  it("compare les versions et cite la référence publique de la faille", () => {
    expect(compareVersions("5.2.6", "5.4.6")).toBeLessThan(0);
    expect(compareVersions("5.4.6", "5.4.6")).toBe(0);
    expect(compareVersions("6.1", "5.4.6")).toBeGreaterThan(0);

    // revslider est cité sans CVE incertain : la référence renvoie à la base WPScan.
    expect(failleDe("revslider", "5.2.6")?.reference).toContain("wpscan.com");
    expect(failleDe("revslider", "6.0.0")).toBeNull();
    // Une extension avec CVE certain le conserve.
    expect(failleDe("wp-file-manager", "6.0")?.cve).toBe("CVE-2020-25213");
    expect(failleDe("plugin-inconnu", "1.0")).toBeNull();
  });

  it("détecte les extensions WordPress et leur version dans les URL de ressources", () => {
    const html = `<link href="/wp-content/plugins/revslider/public/css/rs6.css?ver=5.2.6">
      <script src="/wp-content/plugins/contact-form-7/includes/js/index.js?ver=5.6.4"></script>
      <link href="/wp-content/themes/monTheme/style.css?ver=1.2.0">
      <script src="/js/jquery-1.7.2.min.js"></script>`;
    const composants = composantsDetectes(html);
    expect(composants).toContainEqual({ nom: "revslider", version: "5.2.6", source: "plugin WordPress" });
    expect(composants).toContainEqual({ nom: "monTheme", version: "1.2.0", source: "thème WordPress" });
    expect(composants).toContainEqual({ nom: "jQuery", version: "1.7.2", source: "fichier" });
  });

  it("constate une extension à faille connue avec sa conséquence", () => {
    const html = `<link href="/wp-content/plugins/wp-file-manager/x.css?ver=6.0">`;
    const finding = evalueSecurite(contexte({ accueil: reponse({ html }) }))
      .find((f) => f.regle === "sec_composant_vulnerable");
    expect(finding?.constat).toContain("wp-file-manager 6.0");
    expect(finding?.constat).toContain("corrigé en 6.9");
    expect(finding?.constat).toContain("exécution de code");
    expect(finding?.constat).toContain("CVE-2020-25213");
    expect(finding?.constat).toContain("Vérifier :");
    expect(finding?.severite).toBe("critique");
  });

  it("signale les scripts externes sans contrôle d'intégrité, en ignorant les mesures d'audience", () => {
    const html = `<script src="https://cdn.exemple-tiers.net/lib.js"></script>
      <script src="https://cdn.autre.net/x.js" integrity="sha384-abc"></script>
      <script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>
      <script src="/js/local.js"></script>`;
    const finding = evalueSecurite(contexte({
      accueil: reponse({ html, urlFinale: "https://garagemartin.fr/" }),
    })).find((f) => f.regle === "sec_sri_absente");

    expect(finding?.constat).toContain("1 script");
    expect(finding?.constat).toContain("cdn.exemple-tiers.net");
  });
});

describe("sécurité approfondie : RGPD et points d'entrée WordPress", () => {
  it("prouve le dépôt de cookies de suivi avant tout consentement", () => {
    const finding = evalueSecurite(contexte({
      accueil: reponse({ cookies: ["_ga=GA1.2.123; Path=/", "_fbp=fb.1.456; Path=/", "PHPSESSID=abc; Path=/"] }),
    })).find((f) => f.regle === "sec_traceurs_avant_consentement");

    expect(finding?.constat).toContain("_ga");
    expect(finding?.constat).toContain("_fbp");
    // Un cookie de session technique n'est pas un traceur.
    expect(finding?.constat).not.toContain("PHPSESSID");
  });

  it("interroge les deux points d'entrée sur un site WordPress", async () => {
    const appels: string[] = [];
    const impl = fetchSimule({
      "https://boutique.fr/wp-json/wp/v2/users": { corps: `[{"id":1,"name":"Marie","slug":"marie"}]` },
      "https://boutique.fr/xmlrpc.php": { statut: 405, corps: "XML-RPC server accepts POST requests only." },
      "https://boutique.fr/": { corps: `<html><head><title>Boutique</title></head><body><link href="/wp-content/themes/x/style.css"></body></html>` },
    }, appels);

    const ctx = await collecte("https://boutique.fr/", { fetchImpl: impl, avecSonde: true, delaiSondeMs: 0 });
    expect(ctx.wordpress?.comptes).toEqual(["marie"]);
    expect(ctx.wordpress?.xmlrpc).toBe(true);
  });

  it("relève l'exposition des identifiants et l'interface XML-RPC", () => {
    const findings = evalueSecurite(contexte({
      wordpress: { comptes: ["admin", "marie"], xmlrpc: true },
    }));
    expect(findings.find((f) => f.regle === "sec_enumeration_comptes")?.constat).toContain("admin");
    expect(findings.map((f) => f.regle)).toContain("sec_xmlrpc_ouvert");
  });

  it("n'interroge les points d'entrée WordPress que sur un site WordPress", async () => {
    const appels: string[] = [];
    const impl = fetchSimule({
      "https://site-sur-mesure.fr/": { corps: "<html><body>Site sur mesure</body></html>" },
    }, appels);
    const ctx = await collecte("https://site-sur-mesure.fr/", { fetchImpl: impl, avecSonde: true, delaiSondeMs: 0 });
    expect(appels.some((a) => a.includes("/wp-json/"))).toBe(false);
    expect(appels.some((a) => a.includes("/xmlrpc.php"))).toBe(false);
    expect(ctx.wordpress).toBeNull();
  });
});

describe("référencement approfondi", () => {
  it("signale une adresse canonique qui désigne une autre page", () => {
    const html = `<html><head><link rel="canonical" href="https://autre-site.fr/accueil"></head><body>x</body></html>`;
    const finding = evalueSeo(contexte({ accueil: reponse({ html, urlFinale: "https://garagemartin.fr/" }) }))
      .find((f) => f.regle === "seo_canonical_incoherente");
    expect(finding?.constat).toContain("autre-site.fr/accueil");
    expect(finding?.severite).toBe("critique");

    // Canonique qui pointe sur la page elle-même : rien à signaler.
    const propre = `<link rel="canonical" href="https://garagemartin.fr/">`;
    expect(evalueSeo(contexte({ accueil: reponse({ html: propre, urlFinale: "https://garagemartin.fr/" }) }))
      .map((f) => f.regle)).not.toContain("seo_canonical_incoherente");
  });

  it("repère un titre réutilisé tel quel sur une page interne", () => {
    const titre = "<title>Garage Martin — mécanique générale à Bordeaux</title>";
    const finding = evalueSeo(contexte({
      accueil: reponse({ html: `<html><head>${titre}</head><body>x</body></html>` }),
      pageInterne: reponse({ html: `<html><head>${titre}</head><body>y</body></html>`, urlFinale: "https://garagemartin.fr/services" }),
    })).find((f) => f.regle === "seo_titre_duplique");
    expect(finding?.constat).toContain("/services");
  });

  it("signale des adresses techniques et une fiche établissement amputée", () => {
    const html = `<html><head><script type="application/ld+json">{"@type":"LocalBusiness","name":"Garage"}</script></head>
      <body><a href="/?p=12">A</a><a href="/?p=34">B</a><a href="/index.php?id=7">C</a></body></html>`;
    const findings = evalueSeo(contexte({ accueil: reponse({ html }) })).map((f) => f.regle);
    expect(findings).toContain("seo_urls_illisibles");
    expect(findings).toContain("seo_fiche_incomplete");
  });
});

describe("page interne représentative", () => {
  it("passe au lien suivant quand la page interne répond en erreur", async () => {
    const accueil = `<html><head><title>Boulangerie</title></head><body>
      <a href="/?p=12">Nos pains</a><a href="/services">Services</a>
      ${"Pain au levain cuit au feu de bois. ".repeat(20)}</body></html>`;
    const impl = fetchSimule({
      "https://boulangerie.fr/services": { corps: "<html><head><title>Services</title></head><body>Nos services</body></html>" },
      "https://boulangerie.fr/?p=12": { statut: 404, corps: "<html>Not found</html>" },
      "https://boulangerie.fr/": { corps: accueil },
    });

    const ctx = await collecte("https://boulangerie.fr/", { fetchImpl: impl });
    // La page retenue est celle qui répond, pas la première trouvée.
    expect(ctx.pageInterne?.urlFinale).toBe("https://boulangerie.fr/services");
    expect(ctx.pageInterne?.statut).toBe(200);
  });

  it("cite l'adresse complète d'un lien cassé, paramètres compris", () => {
    const finding = evalueSeo(contexte({
      liens: { verifies: 5, casses: [{ url: "https://boulangerie.fr/?p=12", statut: 404, texte: "Nos pains" }] },
    })).find((f) => f.regle === "seo_liens_morts");
    expect(finding?.constat).toContain("/?p=12 (404)");
  });
});

describe("logiciel serveur en fin de vie", () => {
  it("détecte PHP et Apache en fin de support à partir des en-têtes", () => {
    expect(logicielsObsoletes({ "x-powered-by": "PHP/7.4.3" })[0]?.logiciel).toBe("PHP");
    expect(logicielsObsoletes({ "server": "Apache/2.2.15 (CentOS)" })[0]?.logiciel).toBe("Apache httpd");
    // Version encore supportée : rien.
    expect(logicielsObsoletes({ "x-powered-by": "PHP/8.3.2" })).toEqual([]);
    expect(logicielsObsoletes({})).toEqual([]);
  });

  it("produit un constat critique renvoyant vers la source officielle", () => {
    const finding = evalueSecurite(contexte({
      accueil: reponse({ entetes: { "content-type": "text/html", "x-powered-by": "PHP/5.4.16" } }),
    })).find((f) => f.regle === "sec_logiciel_serveur_eol");
    expect(finding?.constat).toContain("PHP 5.4.16");
    expect(finding?.constat).toContain("php.net");
    expect(finding?.severite).toBe("critique");
  });
});

describe("protection email approfondie", () => {
  it("signale un SPF qui autorise tout le monde", () => {
    const permissif = evalueSecurite(contexte({ dns: dns({ spf: "v=spf1 include:mail.fr +all", mx: ["10 mx.fr"] }) }));
    expect(permissif.find((f) => f.regle === "sec_spf_permissif")?.constat).toContain("+all");

    // Un SPF strict ne déclenche rien.
    expect(evalueSecurite(contexte({ dns: dns({ spf: "v=spf1 include:mail.fr -all", mx: ["10 mx.fr"] }) }))
      .map((f) => f.regle)).not.toContain("sec_spf_permissif");
  });

  it("signale un DMARC actif mais sans adresse de rapport", () => {
    const sansRapport = evalueSecurite(contexte({ dns: dns({ dmarc: "v=DMARC1; p=quarantine", mx: ["10 mx.fr"] }) }));
    expect(sansRapport.map((f) => f.regle)).toContain("sec_dmarc_sans_rapport");
    // Avec rua : rien.
    expect(evalueSecurite(contexte({ dns: dns({ dmarc: "v=DMARC1; p=reject; rua=mailto:a@b.fr", mx: ["10 mx.fr"] }) }))
      .map((f) => f.regle)).not.toContain("sec_dmarc_sans_rapport");
  });

  it("signale un domaine de messagerie non signé par DNSSEC", () => {
    const nonSigne = evalueSecurite(contexte({ dns: dns({ mx: ["10 mx.fr"], dnssec: false, spf: "v=spf1 -all" }) }));
    expect(nonSigne.map((f) => f.regle)).toContain("sec_dnssec_absent");
    // Signé : rien.
    expect(evalueSecurite(contexte({ dns: dns({ mx: ["10 mx.fr"], dnssec: true, spf: "v=spf1 -all" }) }))
      .map((f) => f.regle)).not.toContain("sec_dnssec_absent");
    // Sans MX (pas de messagerie), on n'exige pas DNSSEC.
    expect(evalueSecurite(contexte({ dns: dns({ mx: [], dnssec: false }) }))
      .map((f) => f.regle)).not.toContain("sec_dnssec_absent");
  });
});

describe("security.txt", () => {
  it("signale l'absence d'un moyen de signaler une faille", () => {
    expect(evalueSecurite(contexte({ securityTxt: false })).map((f) => f.regle)).toContain("sec_securitytxt_absent");
    expect(evalueSecurite(contexte({ securityTxt: true })).map((f) => f.regle)).not.toContain("sec_securitytxt_absent");
    // Non vérifié : aucun constat.
    expect(evalueSecurite(contexte({ securityTxt: null })).map((f) => f.regle)).not.toContain("sec_securitytxt_absent");
  });
});
