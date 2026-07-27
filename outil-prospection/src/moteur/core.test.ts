import { describe, expect, it } from "vitest";

import {
  ageEnMois,
  analyseHtml,
  appliqueAudit,
  appliqueFiltres,
  candidatsDomaines,
  construireParamsRecherche,
  dernieresFinances,
  domaineCorrespond,
  estPageParking,
  extraitContacts,
  filtreSelonCible,
  filtresValides,
  mapEntreprise,
  normaliseNom,
  opportuniteSite,
  respecteFiltres,
  scoreBudget,
  scoreProspect,
  statutDepuisScoreSite,
  versCsv,
} from "./core.ts";
import { nafDesSecteurs, SECTEURS_CIBLES } from "./naf.ts";
import { rechercheEntreprises } from "./sirene.ts";
import { detecteEtAuditeSite } from "./website.ts";
import type { EntrepriseApi, Prospect } from "./types.ts";

const entrepriseApi: EntrepriseApi = {
  siren: "912345678",
  nom_complet: "BOULANGERIE DU MARCHE",
  nom_raison_sociale: "BOULANGERIE DU MARCHE",
  date_creation: "2025-03-01",
  activite_principale: "10.71C",
  section_activite_principale: "C",
  nature_juridique: "5710",
  categorie_entreprise: "PME",
  tranche_effectif_salarie: "02",
  etat_administratif: "A",
  nombre_etablissements_ouverts: 1,
  dirigeants: [{ nom: "DUPONT", prenoms: "Marie", qualite: "président" }],
  finances: { "2023": { ca: 240000 }, "2024": { ca: 310000 } },
  siege: {
    siret: "91234567800014",
    adresse: "12 RUE DU MARCHE 33000 BORDEAUX",
    code_postal: "33000",
    libelle_commune: "BORDEAUX",
    departement: "33",
    latitude: "44.84",
    longitude: "-0.58",
    liste_enseignes: ["LE FOURNIL DU MARCHE"],
  },
};

function prospectDeTest(surcharge: Partial<Prospect> = {}): Prospect {
  return { ...(mapEntreprise(entrepriseApi) as Prospect), ...surcharge };
}

describe("construireParamsRecherche", () => {
  it("mappe les filtres vers les paramètres de l'API et exclut les entreprises fermées", () => {
    const params = construireParamsRecherche(
      {
        departement: "33",
        activitePrincipale: ["56.10A", "56.10C"],
        creeApres: "2026-01-01",
        caMin: 150000,
        perPage: 25,
      },
      2,
    );

    expect(params).toMatchObject({
      page: "2",
      per_page: "25",
      etat_administratif: "A",
      departement: "33",
      activite_principale: "56.10A,56.10C",
      date_creation_min: "2026-01-01",
      ca_min: "150000",
    });
    expect(params.q).toBeUndefined();
  });

  it("borne per_page à la limite de l'API", () => {
    expect(construireParamsRecherche({ perPage: 500 }).per_page).toBe("25");
    expect(construireParamsRecherche({ perPage: 0 }).per_page).toBe("1");
  });

  it("refuse une recherche sans aucun critère discriminant", () => {
    expect(filtresValides({})).toBe(false);
    expect(filtresValides({ caMin: 1000 })).toBe(false);
    expect(filtresValides({ departement: "33" })).toBe(true);
    expect(filtresValides({ activitePrincipale: ["56.10A"] })).toBe(true);
  });
});

describe("mapEntreprise", () => {
  it("normalise une entreprise de l'API", () => {
    const prospect = mapEntreprise(entrepriseApi) as Prospect;

    expect(prospect.siren).toBe("912345678");
    expect(prospect.nom).toBe("BOULANGERIE DU MARCHE");
    expect(prospect.enseigne).toBe("LE FOURNIL DU MARCHE");
    expect(prospect.ville).toBe("BORDEAUX");
    expect(prospect.latitude).toBeCloseTo(44.84);
    expect(prospect.dirigeant).toBe("Marie DUPONT");
    expect(prospect.effectif_estime).toBe(4);
    expect(prospect.site_statut).toBe("non_verifie");
  });

  it("retient le dernier exercice comptable", () => {
    expect(dernieresFinances(entrepriseApi.finances)).toEqual({ annee: 2024, ca: 310000 });
    expect(dernieresFinances(null)).toBeNull();
    expect(dernieresFinances({})).toBeNull();
  });

  it("écarte les lignes inexploitables", () => {
    expect(mapEntreprise({ nom_complet: "SANS SIREN" })).toBeNull();
    expect(mapEntreprise({ siren: "123456789" })).toBeNull();
  });
});

describe("scoreBudget", () => {
  const maintenant = new Date("2026-07-01T00:00:00Z");

  it("classe une PME avec salariés au-dessus d'un auto-entrepreneur sans CA", () => {
    const pme = scoreBudget(
      {
        effectif_estime: 15,
        chiffre_affaires: 900000,
        nature_juridique: "5710",
        categorie_entreprise: "PME",
        date_creation: "2019-01-01",
      },
      2,
      maintenant,
    );
    const microEntreprise = scoreBudget(
      {
        effectif_estime: 0,
        chiffre_affaires: null,
        nature_juridique: "1000",
        categorie_entreprise: null,
        date_creation: "2019-01-01",
      },
      null,
      maintenant,
    );

    expect(pme).toBeGreaterThan(microEntreprise);
    expect(pme).toBeLessThanOrEqual(100);
    expect(microEntreprise).toBeGreaterThanOrEqual(0);
  });

  it("bonifie les entreprises créées récemment (budget de lancement)", () => {
    const base = {
      effectif_estime: 4,
      chiffre_affaires: 200000,
      nature_juridique: "5499",
      categorie_entreprise: "PME",
    };
    const recente = scoreBudget({ ...base, date_creation: "2026-02-01" }, null, maintenant);
    const ancienne = scoreBudget({ ...base, date_creation: "2010-02-01" }, null, maintenant);

    expect(recente).toBe(ancienne + 8);
  });

  it("calcule l'âge en mois", () => {
    expect(ageEnMois("2026-01-01", maintenant)).toBe(6);
    expect(ageEnMois(null)).toBeNull();
    expect(ageEnMois("pas-une-date")).toBeNull();
  });
});

describe("scoreProspect", () => {
  it("place une entreprise sans site devant une entreprise au site moderne", () => {
    const sansSite = scoreProspect({ site_statut: "aucun_site", site_score: 100, budget_score: 50 });
    const siteRecent = scoreProspect({ site_statut: "site_recent", site_score: 5, budget_score: 50 });

    expect(sansSite.score).toBeGreaterThan(siteRecent.score);
    expect(sansSite.priorite).toBe("chaud");
    expect(siteRecent.priorite).toBe("froid");
  });

  it("reste neutre tant que le site n'a pas été vérifié", () => {
    expect(opportuniteSite("non_verifie", null)).toBe(50);
    expect(opportuniteSite("aucun_site", null)).toBe(100);
    expect(opportuniteSite("site_injoignable", null)).toBe(90);
    expect(opportuniteSite("site_obsolete", 72)).toBe(72);
  });

  it("recalcule le score après audit", () => {
    const prospect = prospectDeTest({ budget_score: 60 });
    const apres = appliqueAudit(prospect, {
      url: "http://vieux-site.fr",
      statut: "site_obsolete",
      score: 80,
      signaux: ["Pas de HTTPS"],
      emailContact: "contact@vieux-site.fr",
      telephone: "05 56 00 00 00",
      verifieLe: "2026-07-01T10:00:00.000Z",
    });

    expect(apres.site_web).toBe("http://vieux-site.fr");
    expect(apres.site_score).toBe(80);
    expect(apres.email_contact).toBe("contact@vieux-site.fr");
    expect(apres.score).toBe(Math.round(0.55 * 80 + 0.45 * 60));
    expect(apres.priorite).toBe("chaud");
  });

  it("n'attribue pas de score de site quand il n'a pas été vérifié", () => {
    const apres = appliqueAudit(prospectDeTest(), {
      url: null,
      statut: "non_verifie",
      score: 0,
      signaux: [],
      emailContact: null,
      telephone: null,
      verifieLe: null,
    });
    expect(apres.site_score).toBeNull();
  });
});

describe("filtreSelonCible", () => {
  const prospects = [
    prospectDeTest({ siren: "1", site_statut: "aucun_site" }),
    prospectDeTest({ siren: "2", site_statut: "site_obsolete" }),
    prospectDeTest({ siren: "3", site_statut: "site_a_rafraichir" }),
    prospectDeTest({ siren: "4", site_statut: "site_recent" }),
    prospectDeTest({ siren: "5", site_statut: "site_injoignable" }),
  ];

  it("cible les entreprises sans site exploitable", () => {
    expect(filtreSelonCible(prospects, "sans_site").map((p) => p.siren)).toEqual(["1", "5"]);
  });

  it("cible les sites à refaire", () => {
    expect(filtreSelonCible(prospects, "site_a_refaire").map((p) => p.siren)).toEqual(["2", "3"]);
  });

  it("ne filtre rien par défaut", () => {
    expect(filtreSelonCible(prospects)).toHaveLength(5);
  });
});

describe("détection de domaine", () => {
  it("retire accents et formes juridiques", () => {
    expect(normaliseNom("SARL BOULANGERIE DÉLICES & Cie")).toBe("boulangerie delices cie");
    expect(normaliseNom("SAS L'ATELIER")).toBe("l atelier");
  });

  it("génère des domaines plausibles", () => {
    const domaines = candidatsDomaines("SARL GARAGE MARTIN", "GARAGE MARTIN");
    expect(domaines).toContain("garagemartin.fr");
    expect(domaines).toContain("garage-martin.fr");
    expect(domaines.length).toBeLessThanOrEqual(6);
  });

  it("ne génère rien pour un nom trop court", () => {
    expect(candidatsDomaines("SA")).toEqual([]);
  });

  it("vérifie que la page mentionne bien l'entreprise", () => {
    const html = "<html><title>Garage Martin - Bordeaux</title><body>Bienvenue chez Garage Martin</body></html>";
    expect(domaineCorrespond(html, "SARL GARAGE MARTIN", null)).toBe(true);
    expect(domaineCorrespond("<html><body>Plombier Lyon</body></html>", "SARL GARAGE MARTIN", null)).toBe(false);
  });

  it("repère les pages parking et les pages vides", () => {
    expect(estPageParking("<html><body>This domain is for sale</body></html>")).toBe(true);
    expect(estPageParking("<html><body>Site en construction</body></html>")).toBe(true);
    expect(estPageParking(`<html><body>${"contenu réel ".repeat(40)}</body></html>`)).toBe(false);
  });
});

describe("analyseHtml", () => {
  const contexteModerne = {
    urlFinale: "https://exemple.fr",
    statutHttp: 200,
    dureeMs: 400,
    octets: 90_000,
    anneeCourante: 2026,
  };

  const siteModerne = `
    <html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta name="description" content="Boulangerie artisanale à Bordeaux">
      <meta property="og:title" content="Le Fournil">
      <link rel="icon" href="/favicon.svg">
    </head><body><p>© 2026 Le Fournil</p></body></html>`;

  const siteObsolete = `
    <html><head>
      <meta name="generator" content="WordPress 4.9.8">
      <script src="/js/jquery-1.7.2.min.js"></script>
    </head><body bgcolor="#FFFFFF">
      <center><font size="2">Bienvenue</font></center>
      <p>Copyright 2011 - Garage Martin</p>
    </body></html>`;

  it("ne signale rien sur un site moderne", () => {
    const { score, signaux } = analyseHtml(siteModerne, contexteModerne);
    expect(score).toBe(0);
    expect(signaux).toEqual(["Site moderne : aucun signal d'obsolescence détecté"]);
    expect(statutDepuisScoreSite(score)).toBe("site_recent");
  });

  it("détecte les marqueurs d'un site dépassé", () => {
    const { score, signaux } = analyseHtml(siteObsolete, {
      ...contexteModerne,
      urlFinale: "http://garage-martin.fr",
    });

    expect(statutDepuisScoreSite(score)).toBe("site_obsolete");
    expect(signaux.join(" ")).toContain("Pas de HTTPS");
    expect(signaux.join(" ")).toContain("Non responsive");
    expect(signaux.join(" ")).toContain("WordPress 4.9");
    expect(signaux.join(" ")).toContain("jQuery 1.7");
    expect(signaux.join(" ")).toContain("Copyright 2011");
  });

  it("plafonne le score à 100", () => {
    const { score } = analyseHtml("<html><body><marquee>Flash</marquee><embed src='a.swf'></body></html>", {
      urlFinale: "http://vieux.fr",
      statutHttp: 500,
      dureeMs: 9000,
      octets: 5_000_000,
      anneeCourante: 2026,
    });
    expect(score).toBe(100);
  });

  it("classe les états intermédiaires", () => {
    expect(statutDepuisScoreSite(60)).toBe("site_obsolete");
    expect(statutDepuisScoreSite(35)).toBe("site_a_rafraichir");
    expect(statutDepuisScoreSite(10)).toBe("site_recent");
  });
});

describe("extraitContacts", () => {
  it("privilégie une adresse générique et normalise le téléphone", () => {
    const html = `
      <a href="mailto:jean.dupont@garage-martin.fr">Jean</a>
      <a href="mailto:contact@garage-martin.fr">Contact</a>
      <p>Tél : 05.56.12.34.56</p>`;
    expect(extraitContacts(html)).toEqual({
      email: "contact@garage-martin.fr",
      telephone: "05 56 12 34 56",
    });
  });

  it("ignore les adresses techniques", () => {
    const html = "<img src='logo@2x.png'><script>sentry@sentry.io</script>";
    expect(extraitContacts(html).email).toBeNull();
  });
});

describe("versCsv", () => {
  it("échappe les séparateurs et les guillemets", () => {
    const csv = versCsv([
      prospectDeTest({ nom: 'BOULANGERIE "DU MARCHE"; BORDEAUX', site_signaux: ["Pas de HTTPS", "Non responsive"] }),
    ]);
    const [entetes, ligne] = csv.split("\n");

    expect(entetes.startsWith("Score;Priorité;Nom")).toBe(true);
    expect(ligne).toContain('"BOULANGERIE ""DU MARCHE""; BORDEAUX"');
    expect(ligne).toContain("Pas de HTTPS | Non responsive");
  });

  it("neutralise les formules injectées par un site tiers", () => {
    const csv = versCsv([
      prospectDeTest({ nom: "=cmd|'/C calc'!A0", site_signaux: ["@SUM(1+1)"], dirigeant: "+33" }),
    ]);
    const ligne = csv.split("\n")[1];

    expect(ligne).toContain("'=cmd|'/C calc'!A0");
    expect(ligne).toContain("'@SUM(1+1)");
    expect(ligne).toContain("'+33");
  });
});

describe("secteurs NAF", () => {
  it("agrège les codes NAF sans doublon", () => {
    const codes = nafDesSecteurs(["restauration", "restauration", "beaute"]);
    expect(codes).toContain("56.10A");
    expect(codes).toContain("96.02A");
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("ignore les secteurs inconnus", () => {
    expect(nafDesSecteurs(["inexistant"])).toEqual([]);
    expect(SECTEURS_CIBLES.every((s) => s.naf.length > 0)).toBe(true);
  });
});

// ── Intégration avec fetch simulé ────────────────────────────────────────────

function reponseJson(donnees: unknown) {
  return {
    ok: true,
    status: 200,
    url: "https://recherche-entreprises.api.gouv.fr/search",
    headers: { get: () => "application/json" },
    json: async () => donnees,
    text: async () => JSON.stringify(donnees),
    body: null,
  } as unknown as Response;
}

function reponseHtml(url: string, html: string, status = 200) {
  return {
    ok: status < 400,
    status,
    url,
    headers: { get: () => "text/html; charset=utf-8" },
    text: async () => html,
    json: async () => ({}),
    body: null,
  } as unknown as Response;
}

describe("rechercheEntreprises", () => {
  it("pagine, dédoublonne et remonte le total disponible", async () => {
    const appels: string[] = [];
    const fetchSimule = (async (url: string) => {
      appels.push(String(url));
      const page = Number(new URL(String(url)).searchParams.get("page"));
      return reponseJson({
        total_results: 42,
        total_pages: 3,
        results: page === 1 ? [entrepriseApi, entrepriseApi] : [{ ...entrepriseApi, siren: "987654321" }],
      });
    }) as unknown as typeof fetch;

    const resultat = await rechercheEntreprises(
      { departement: "33", pages: 2 },
      { fetchImpl: fetchSimule, delaiEntrePagesMs: 0 },
    );

    expect(appels).toHaveLength(2);
    expect(resultat.totalDisponible).toBe(42);
    expect(resultat.prospects.map((p) => p.siren)).toEqual(["912345678", "987654321"]);
  });

  it("s'arrête quand l'API n'a plus de page", async () => {
    let appels = 0;
    const fetchSimule = (async () => {
      appels++;
      return reponseJson({ total_results: 1, total_pages: 1, results: [entrepriseApi] });
    }) as unknown as typeof fetch;

    await rechercheEntreprises({ departement: "33", pages: 5 }, { fetchImpl: fetchSimule, delaiEntrePagesMs: 0 });
    expect(appels).toBe(1);
  });

  it("refuse une recherche sans critère", async () => {
    await expect(rechercheEntreprises({}, { fetchImpl: (() => {}) as unknown as typeof fetch })).rejects.toThrow(
      /Filtres insuffisants/,
    );
  });
});

describe("detecteEtAuditeSite", () => {
  const options = { timeoutMs: 100, maxOctets: 100_000 };

  it("retient le domaine qui mentionne l'entreprise et l'audite", async () => {
    const fetchSimule = (async (url: string) => {
      if (String(url) === "https://garagemartin.fr") {
        return reponseHtml(
          "https://garagemartin.fr",
          `<html><head><meta name="viewport" content="width=device-width"></head>
           <body>${"Garage Martin, votre garage à Bordeaux. ".repeat(20)}
           <a href="mailto:contact@garagemartin.fr">Nous écrire</a></body></html>`,
        );
      }
      throw new Error("domaine inexistant");
    }) as unknown as typeof fetch;

    const audit = await detecteEtAuditeSite("SARL GARAGE MARTIN", null, { ...options, fetchImpl: fetchSimule });

    expect(audit.url).toBe("https://garagemartin.fr");
    expect(audit.statut).toBe("site_recent"); // responsive et en HTTPS : peu d'urgence
    expect(audit.signaux.join(" ")).toContain("Open Graph");
    expect(audit.emailContact).toBe("contact@garagemartin.fr");
  });

  it("ignore les pages parking et conclut à l'absence de site", async () => {
    const fetchSimule = (async (url: string) =>
      reponseHtml(String(url), "<html><body>This domain is for sale</body></html>")) as unknown as typeof fetch;

    const audit = await detecteEtAuditeSite("SARL GARAGE MARTIN", null, { ...options, fetchImpl: fetchSimule });

    expect(audit.statut).toBe("aucun_site");
    expect(audit.url).toBeNull();
    expect(audit.score).toBe(100);
  });

  it("ignore un site qui ne parle pas de l'entreprise", async () => {
    const fetchSimule = (async (url: string) =>
      reponseHtml(String(url), `<html><body>${"Pizzeria Napoli ".repeat(30)}</body></html>`)) as unknown as typeof fetch;

    const audit = await detecteEtAuditeSite("SARL GARAGE MARTIN", null, { ...options, fetchImpl: fetchSimule });
    expect(audit.statut).toBe("aucun_site");
  });
});

describe("respect des critères de recherche", () => {
  const filtres = {
    caMin: 100_000,
    creeApres: "2025-01-01",
    creeAvant: "2026-06-30",
    trancheEffectif: ["02", "03"],
    departement: "33",
  };

  it("laisse passer un prospect conforme à tous les critères", () => {
    const prospect = prospectDeTest({
      chiffre_affaires: 180_000, date_creation: "2025-09-15",
      tranche_effectif: "02", departement: "33",
    });
    expect(respecteFiltres(prospect, filtres)).toBeNull();
  });

  it("écarte un chiffre d'affaires trop faible, en le citant", () => {
    const raison = respecteFiltres(prospectDeTest({ chiffre_affaires: 45_000 }), { caMin: 100_000 });
    // Intl insère une espace insécable étroite entre les milliers.
    expect(raison?.replace(/\s/g, " ")).toContain("45 000 €");
    expect(raison).toContain("inférieur");
  });

  it("écarte une entreprise sans CA publié quand un CA minimum est demandé", () => {
    // L'API elle-même exclut ces entreprises : on le dit au lieu de laisser croire à un bug.
    expect(respecteFiltres(prospectDeTest({ chiffre_affaires: null }), { caMin: 100_000 }))
      .toBe("chiffre d'affaires non publié");
    // sans critère de CA, l'absence de comptes déposés n'écarte personne
    expect(respecteFiltres(prospectDeTest({ chiffre_affaires: null }), { departement: "33" })).toBeNull();
  });

  it("écarte une date de création hors de la période demandée", () => {
    expect(respecteFiltres(prospectDeTest({ date_creation: "2019-04-02" }), filtres))
      .toContain("avant la date demandée");
    expect(respecteFiltres(prospectDeTest({ date_creation: "2026-12-01" }), filtres))
      .toContain("après la date demandée");
  });

  it("écarte un effectif hors des tranches demandées", () => {
    expect(respecteFiltres(prospectDeTest({ tranche_effectif: "12" }), { trancheEffectif: ["02"] }))
      .toBe("effectif hors des tranches demandées");
    expect(respecteFiltres(prospectDeTest({ tranche_effectif: null }), { trancheEffectif: ["02"] }))
      .toBe("effectif non déclaré");
  });

  it("écarte un siège hors du département ou du code postal demandé", () => {
    expect(respecteFiltres(prospectDeTest({ departement: "44" }), { departement: "33" }))
      .toContain("département 44");
    expect(respecteFiltres(prospectDeTest({ code_postal: "33800" }), { codePostal: "33000" }))
      .toContain("33800");
  });

  it("sépare les prospects retenus des écartés en gardant la raison de chacun", () => {
    const { retenus, ecartes } = appliqueFiltres(
      [
        prospectDeTest({ siren: "111111111", nom: "Conforme", chiffre_affaires: 200_000, date_creation: "2025-05-02", tranche_effectif: "02", departement: "33" }),
        prospectDeTest({ siren: "222222222", nom: "Sans comptes", chiffre_affaires: null }),
        prospectDeTest({ siren: "333333333", nom: "Trop ancienne", chiffre_affaires: 500_000, date_creation: "2009-01-01", tranche_effectif: "02", departement: "33" }),
      ],
      filtres,
    );

    expect(retenus.map((p) => p.nom)).toEqual(["Conforme"]);
    expect(ecartes).toEqual([
      { siren: "222222222", nom: "Sans comptes", raison: "chiffre d'affaires non publié" },
      { siren: "333333333", nom: "Trop ancienne", raison: "créée le 2009-01-01, avant la date demandée" },
    ]);
  });
});

describe("export CSV : fiche Google", () => {
  it("exporte le lien publié par le site, sinon une recherche Google Maps", () => {
    const csv = versCsv([
      { ...prospectDeTest({ nom: "Avec fiche" }), google_maps_url: "https://g.page/garage" },
      prospectDeTest({ nom: "Sans fiche", ville: "Bordeaux", code_postal: "33000" }),
    ]);
    const [entetes, avec, sans] = csv.split("\n");
    expect(entetes).toContain("Fiche Google");
    expect(avec).toContain("https://g.page/garage");
    expect(decodeURIComponent(sans)).toContain("maps/search/?api=1&query=Sans fiche 33000 Bordeaux");
  });
});
