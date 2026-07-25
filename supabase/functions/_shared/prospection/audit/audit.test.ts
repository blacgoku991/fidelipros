import { describe, expect, it } from "vitest";

import { appliqueRegles, auditeSite } from "./index.ts";
import {
  collecte, collecte404, collecteDns, collecteLighthouse, collecteRobots, collecteSitemap,
  FICHIERS_SONDES, hotePublic, normaliseUrl, sondeFichiers,
} from "./collecte.ts";
import {
  anneeCopyright, compteMots, comptePolices, echappeHtml, formulaires, images, liens, meta,
  niveauxTitres, ressourcesNonSecurisees, texteVisible, titrePage, typesJsonLd,
} from "./html.ts";
import { REGLES, constate, reglesDuPilier } from "./regles.ts";
import { argumentsCles, calculeScores, resumeSeverites, scorePilier } from "./score.ts";
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
    redirigeVersHttps: true,
    robots: { present: true, contenu: "User-agent: *\nAllow: /\nSitemap: https://garagemartin.fr/sitemap.xml" },
    sitemap: { present: true, urls: 12 },
    pageInterne: null,
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
  valeurs: { mx?: string[]; spf?: string | null; dmarc?: string | null },
  verifie = true,
): ContexteAudit["dns"] {
  return {
    mx: { verifie, valeur: valeurs.mx ?? [] },
    spf: { verifie, valeur: valeurs.spf ?? null },
    dmarc: { verifie, valeur: valeurs.dmarc ?? null },
  };
}

function lighthouse(surcharge: Partial<ResultatLighthouse> = {}): ResultatLighthouse {
  return {
    performance: 92, seo: 95, accessibilite: 96, bonnesPratiques: 92,
    lcpMs: 1800, cls: 0.02, tbtMs: 120, octets: 800_000, requetes: 30,
    audits: {}, captureDataUri: null,
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

  it("conclut à l'indisponibilité quand rien ne répond", () => {
    const findings = evalueTechnique(contexte({ accueil: null }));
    expect(findings.map((f) => f.regle)).toEqual(["tech_site_injoignable"]);
    expect(findings[0].severite).toBe("critique");
  });

  it("signale une erreur HTTP sans chercher plus loin", () => {
    const findings = evalueTechnique(contexte({ accueil: reponse({ statut: 500 }) }));
    expect(findings.map((f) => f.regle)).toEqual(["tech_erreur_http"]);
  });

  it("mesure lenteur, poids et absence de compression", () => {
    const findings = evalueTechnique(contexte({
      accueil: reponse({ dureeMs: 2600, octets: 120_000, entetes: { "content-type": "text/html" } }),
      lighthouse: lighthouse({ performance: 28, octets: 4_200_000, requetes: 140 }),
    }));
    const ids = findings.map((f) => f.regle);

    expect(ids).toContain("tech_perf_faible");
    expect(ids).toContain("tech_page_lourde");
    expect(ids).toContain("tech_trop_de_requetes");
    expect(ids).toContain("tech_compression_absente");
    expect(ids).toContain("tech_ttfb_lent");
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

describe("normaliseUrl", () => {
  it("complète le schéma et rejette les saisies invalides", () => {
    expect(normaliseUrl("garagemartin.fr")).toBe("https://garagemartin.fr/");
    expect(normaliseUrl("http://garagemartin.fr/accueil")).toBe("http://garagemartin.fr/accueil");
    expect(normaliseUrl("pas-un-domaine")).toBeNull();
    expect(normaliseUrl("   ")).toBeNull();
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
      "https://cloudflare-dns.com/dns-query?name=x.fr&type=TXT": { json: { Status: 0, Answer: [{ data: '"v=spf1 -all"' }] } },
      "https://cloudflare-dns.com/dns-query?name=x.fr&type=MX": { json: { Status: 0, Answer: [{ data: "10 mx.x.fr." }] } },
      "https://cloudflare-dns.com/dns-query?name=_dmarc.x.fr&type=TXT": { json: { Status: 0, Answer: [{ data: '"v=DMARC1; p=reject"' }] } },
    });
    expect(await collecteDns("https://x.fr/", { fetchImpl: impl })).toEqual({
      mx: { verifie: true, valeur: ["10 mx.x.fr."] },
      spf: { verifie: true, valeur: "v=spf1 -all" },
      dmarc: { verifie: true, valeur: "v=DMARC1; p=reject" },
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

// ── Audit de bout en bout ───────────────────────────────────────────────────

describe("auditeSite", () => {
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

    expect(audit.scores.global).toBeGreaterThan(85);
    expect(audit.findings.filter((f) => f.severite === "critique")).toEqual([]);
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

  it("rejette une adresse invalide sans lancer de requête", async () => {
    const audit = await auditeSite("pas-une-url", {
      fetchImpl: (() => { throw new Error("ne doit pas être appelé"); }) as unknown as typeof fetch,
    });
    expect(audit.erreurs[0]).toContain("Adresse invalide");
    expect(audit.findings).toEqual([]);
  });
});
