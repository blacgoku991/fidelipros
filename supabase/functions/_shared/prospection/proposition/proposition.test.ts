import { describe, expect, it } from "vitest";

import { constate } from "../audit/regles.ts";
import { calculeScores } from "../audit/score.ts";
import type { AuditSiteComplet, Finding } from "../audit/types.ts";
import type { Prospect } from "../types.ts";
import { construitDevis, EMETTEUR_PAR_DEFAUT, euros } from "./devis.ts";
import { reformule } from "./ia.ts";
import { emailPriseContact, rapportHtml, scriptAppel, sms, synthese } from "./redaction.ts";
import { construitProposition, emetteurDepuisSettings } from "./index.ts";
import type { ContexteProposition, Prestation } from "./types.ts";

const CATALOGUE: Prestation[] = [
  { code: "site_vitrine", libelle: "Création d'un site vitrine (5 pages)", prix: 1200, unite: "forfait", categorie: "creation", ordre: 10 },
  { code: "refonte_site", libelle: "Refonte complète du site existant", prix: 2500, unite: "forfait", categorie: "refonte", ordre: 20 },
  { code: "responsive_mobile", libelle: "Adaptation mobile et tablette", prix: 690, unite: "forfait", categorie: "design", ordre: 30 },
  { code: "accessibilite", libelle: "Mise en accessibilité", prix: 390, unite: "forfait", categorie: "design", ordre: 40 },
  { code: "optimisation_perf", libelle: "Optimisation de la vitesse", prix: 490, unite: "forfait", categorie: "design", ordre: 50 },
  { code: "seo_technique", libelle: "SEO technique", prix: 590, unite: "forfait", categorie: "seo", ordre: 60 },
  { code: "redaction_contenu", libelle: "Rédaction de contenu (5 pages)", prix: 550, unite: "forfait", categorie: "seo", ordre: 70 },
  { code: "seo_local", libelle: "Référencement local", prix: 450, unite: "mois", categorie: "seo", ordre: 80 },
  { code: "mise_https", libelle: "Passage en HTTPS", prix: 190, unite: "forfait", categorie: "securite", ordre: 90 },
  { code: "securisation_entetes", libelle: "Sécurisation du site", prix: 390, unite: "forfait", categorie: "securite", ordre: 100 },
  { code: "correctif_dns_email", libelle: "Protection de vos emails", prix: 290, unite: "forfait", categorie: "securite", ordre: 110 },
  { code: "mise_a_jour_cms", libelle: "Mise à jour et nettoyage du CMS", prix: 450, unite: "forfait", categorie: "securite", ordre: 120 },
  { code: "maintenance", libelle: "Maintenance et surveillance", prix: 79, unite: "mois", categorie: "maintenance", ordre: 130 },
  { code: "hebergement", libelle: "Hébergement et nom de domaine", prix: 15, unite: "mois", categorie: "maintenance", ordre: 140 },
];

const PROSPECT: ContexteProposition["prospect"] = {
  nom: "GARAGE MARTIN",
  enseigne: "Garage Martin",
  ville: "BORDEAUX",
  code_postal: "33000",
  activite_code: "45.20A",
  dirigeant: "Marie DUPONT",
  site_web: "http://garagemartin.fr",
  site_statut: "site_obsolete",
};

function audit(findings: Finding[], surcharge: Partial<AuditSiteComplet> = {}): AuditSiteComplet {
  return {
    url: "http://garagemartin.fr",
    urlFinale: "http://garagemartin.fr",
    profondeur: "complet",
    scores: calculeScores(findings),
    findings,
    lighthouse: null,
    fichiersExposes: [],
    captureDataUri: null,
    emailContact: "contact@garagemartin.fr",
    telephone: "05 56 12 34 56",
    erreurs: [],
    dureeMs: 4200,
    ...surcharge,
  };
}

/** Quelques défauts ciblés, sans faire tomber la note sous le seuil de refonte. */
const DEFAUTS_CIBLES = [
  constate("seo_description_absente", "Aucune balise meta description"),
  constate("sec_hsts_absent", "En-tête Strict-Transport-Security absent"),
  constate("sec_spf_absent", "Aucun enregistrement SPF sur le domaine"),
];

const DEFAUTS_LOURDS = [
  constate("design_viewport_absent", "Aucune balise meta viewport"),
  constate("design_layout_tableaux", "9 tableaux HTML"),
  constate("sec_https_absent", "Le site répond en HTTP"),
  constate("sec_cms_obsolete", "WordPress 4.9 détecté"),
  constate("seo_title_absent", "Aucune balise title"),
  constate("tech_perf_faible", "Note de performance : 22/100"),
];

describe("construitDevis", () => {
  it("ne facture que les prestations appelées par les défauts constatés", () => {
    const devis = construitDevis(audit(DEFAUTS_CIBLES), CATALOGUE);
    const codes = devis.lignes_projet.map((l) => l.code);

    expect(codes).toContain("seo_technique");
    expect(codes).toContain("securisation_entetes");
    expect(codes).toContain("correctif_dns_email");
    expect(codes).not.toContain("refonte_site");
    expect(codes).not.toContain("site_vitrine");
  });

  it("justifie chaque ligne par les défauts correspondants", () => {
    const devis = construitDevis(audit(DEFAUTS_CIBLES), CATALOGUE);
    const seo = devis.lignes_projet.find((l) => l.code === "seo_technique");
    expect(seo?.motifs).toContain("Aucune description de page");
  });

  it("bascule sur une refonte quand le site est trop dégradé", () => {
    const devis = construitDevis(audit(DEFAUTS_LOURDS), CATALOGUE);
    const codes = devis.lignes_projet.map((l) => l.code);

    expect(codes).toContain("refonte_site");
    // Les correctifs absorbés par la refonte ne sont pas facturés en plus.
    expect(codes).not.toContain("responsive_mobile");
    expect(codes).not.toContain("mise_https");
    expect(codes).not.toContain("seo_technique");
    // Ce que la refonte ne couvre pas reste facturé.
    expect(codes).toContain("mise_a_jour_cms");
  });

  it("propose une création de site quand il n'y en a aucun", () => {
    const devis = construitDevis(null, CATALOGUE);
    const codes = devis.lignes_projet.map((l) => l.code);

    expect(codes).toEqual(["site_vitrine"]);
    expect(devis.lignes_recurrentes.map((l) => l.code)).toEqual(["seo_local", "maintenance", "hebergement"]);
    expect(devis.total_ht).toBe(1200);
    expect(devis.mensuel_ht).toBe(544);
  });

  it("applique la remise au-delà de trois forfaits et calcule la TVA", () => {
    // Beaucoup de correctifs unitaires, mais un site encore récupérable (pas de refonte).
    const defauts = [
      ...DEFAUTS_CIBLES,
      constate("seo_contenu_faible", "120 mots sur la page d'accueil"),
      constate("design_images_non_optimisees", "Images en JPEG non compressées"),
    ];
    const devis = construitDevis(audit(defauts), CATALOGUE, {
      emetteur: { ...EMETTEUR_PAR_DEFAUT, taux_tva: 20, validite_jours: 30 },
      maintenant: new Date("2026-07-25T00:00:00Z"),
    });

    expect(devis.lignes_projet.length).toBeGreaterThan(3);
    expect(devis.taux_remise).toBe(0.1);
    expect(devis.remise).toBe(Math.round(devis.sous_total_ht * 0.1 * 100) / 100);
    expect(devis.total_ht).toBe(devis.sous_total_ht - devis.remise);
    expect(devis.tva).toBe(Math.round(devis.total_ht * 0.2 * 100) / 100);
    expect(devis.total_ttc).toBe(devis.total_ht + devis.tva);
    expect(devis.valide_jusqu_au).toBe("2026-08-24");
  });

  it("n'applique pas de remise sur un petit devis", () => {
    const devis = construitDevis(audit([constate("seo_title_absent", "")]), CATALOGUE);
    expect(devis.taux_remise).toBe(0);
    expect(devis.total_ht).toBe(devis.sous_total_ht);
  });

  it("ignore les prestations désactivées du catalogue", () => {
    const catalogue = CATALOGUE.map((p) => (p.code === "seo_technique" ? { ...p, actif: false } : p));
    const devis = construitDevis(audit([constate("seo_title_absent", "")]), catalogue);
    expect(devis.lignes_projet).toEqual([]);
    expect(devis.total_ht).toBe(0);
  });

  it("accepte l'ajout manuel d'une prestation", () => {
    const devis = construitDevis(audit(DEFAUTS_CIBLES), CATALOGUE, {
      prestationsSupplementaires: ["redaction_contenu"],
    });
    expect(devis.lignes_projet.map((l) => l.code)).toContain("redaction_contenu");
  });

  it("formate les montants à la française", () => {
    // Intl insère une espace insécable : on la normalise avant comparaison.
    const normalise = (valeur: string) => valeur.replace(/[\u00a0\u202f]/g, " ");
    expect(normalise(euros(1200))).toBe("1 200 €");
    expect(normalise(euros(79.5))).toBe("79,50 €");
  });
});

describe("emetteurDepuisSettings", () => {
  it("lit les réglages et complète les valeurs manquantes", () => {
    const emetteur = emetteurDepuisSettings({
      devis_raison_sociale: "Studio Web 33",
      devis_taux_tva: "0",
      devis_validite_jours: "abc",
    });
    expect(emetteur.raison_sociale).toBe("Studio Web 33");
    expect(emetteur.taux_tva).toBe(0);
    expect(emetteur.validite_jours).toBe(EMETTEUR_PAR_DEFAUT.validite_jours);
    expect(emetteur.email).toBe(EMETTEUR_PAR_DEFAUT.email);
  });
});

describe("rédaction", () => {
  function contexte(findings = DEFAUTS_LOURDS, prospect = PROSPECT): ContexteProposition {
    const auditComplet = audit(findings);
    return {
      prospect,
      audit: auditComplet,
      devis: construitDevis(auditComplet, CATALOGUE),
      emetteur: { ...EMETTEUR_PAR_DEFAUT, raison_sociale: "Studio Web 33", telephone: "05 56 00 00 00" },
      arguments: findings.slice(0, 3),
    };
  }

  it("résume l'audit avec la note et les points coûteux", () => {
    const texte = synthese(contexte());
    expect(texte).toContain("Garage Martin");
    expect(texte).toContain("/100");
    expect(texte).toContain("critique");
  });

  it("adapte la synthèse à une entreprise sans site", () => {
    const ctx = contexte(DEFAUTS_LOURDS, { ...PROSPECT, site_statut: "aucun_site" });
    expect(synthese({ ...ctx, audit: null })).toContain("aucun site web");
  });

  it("écrit un email complet, chiffré et conforme", () => {
    const { objet, corps } = emailPriseContact(contexte());

    expect(objet).toContain("Garage Martin");
    expect(corps).toContain("Bonjour Marie DUPONT,");
    expect(corps).toContain("Studio Web 33");
    expect(corps).toContain("HT");
    // Obligations CNIL pour la prospection B2B : origine des données et droit d'opposition.
    expect(corps).toContain("Sirene");
    expect(corps.toUpperCase()).toContain("STOP");
    // Trois arguments au maximum, un par puce.
    expect(corps.split("\n").filter((l) => l.startsWith("• "))).toHaveLength(3);
    expect(corps).not.toMatch(/\{\{|\}\}|undefined|null/);
  });

  it("écrit un SMS court avec possibilité de refus", () => {
    const texte = sms(contexte());
    expect(texte.length).toBeLessThanOrEqual(480);
    expect(texte).toContain("STOP");
    expect(texte).not.toContain("undefined");
  });

  it("écrit un script d'appel avec objections et conclusion chiffrée", () => {
    const texte = scriptAppel(contexte());
    expect(texte).toContain("ACCROCHE");
    expect(texte).toContain("OBJECTIONS");
    expect(texte).toContain("QUALIFICATION");
    expect(texte).toContain("€");
    expect(texte).not.toContain("undefined");
  });

  it("produit un rapport HTML avec les quatre volets et le devis", () => {
    const html = rapportHtml(contexte());
    expect(html).toContain("Référencement");
    expect(html).toContain("Design &amp; mobile");
    expect(html).toContain("Sécurité");
    expect(html).toContain("Performance technique");
    expect(html).toContain("Proposition chiffrée");
    expect(html).toContain("Total TTC");
    expect(html).toContain("sans aucune intrusion");
  });

  it("échappe le contenu venant du site audité", () => {
    const findings = [constate("sec_version_cms_visible", '<img src=x onerror=alert(1)>')];
    const ctx = contexte(findings, { ...PROSPECT, nom: '<script>alert("nom")</script>' });
    const html = rapportHtml(ctx);

    expect(html).not.toContain("<img src=x onerror");
    expect(html).not.toContain('<script>alert("nom")');
    expect(html).toContain("&lt;img src=x onerror");
  });

  it("indique dans le rapport ce qui n'a pas pu être vérifié", () => {
    const ctx = contexte();
    const html = rapportHtml({ ...ctx, audit: audit(DEFAUTS_LOURDS, { erreurs: ["Lighthouse : quota dépassé"] }) });
    expect(html).toContain("Lighthouse : quota dépassé");
  });
});

describe("reformule (IA)", () => {
  const ctxMinimal = (): ContexteProposition => ({
    prospect: PROSPECT,
    audit: audit(DEFAUTS_CIBLES),
    devis: construitDevis(audit(DEFAUTS_CIBLES), CATALOGUE),
    emetteur: EMETTEUR_PAR_DEFAUT,
    arguments: DEFAUTS_CIBLES.slice(0, 3),
  });

  it("ne fait aucun appel sans clé", async () => {
    const resultat = await reformule(ctxMinimal(), {
      fetchImpl: (() => { throw new Error("ne doit pas être appelé"); }) as unknown as typeof fetch,
    });
    expect(resultat).toBeNull();
  });

  it("lit les textes renvoyés par le gateway", async () => {
    const impl = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: JSON.stringify({
                  synthese: "Votre site perd des clients sur mobile.",
                  objet: "Garage Martin : 3 correctifs urgents",
                  corps: "Bonjour…",
                }),
              },
            }],
          },
        }],
      }),
    })) as unknown as typeof fetch;

    const resultat = await reformule(ctxMinimal(), { cle: "test", fetchImpl: impl });
    expect(resultat?.objet).toBe("Garage Martin : 3 correctifs urgents");
    expect(resultat?.synthese).toContain("mobile");
  });

  it("retombe sur null si la réponse est inexploitable", async () => {
    const vide = (async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    expect(await reformule(ctxMinimal(), { cle: "test", fetchImpl: vide })).toBeNull();

    const casse = (async () => { throw new Error("réseau"); }) as unknown as typeof fetch;
    expect(await reformule(ctxMinimal(), { cle: "test", fetchImpl: casse })).toBeNull();

    const partiel = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { tool_calls: [{ function: { arguments: '{"synthese":"a","objet":""}' } }] } }],
      }),
    })) as unknown as typeof fetch;
    expect(await reformule(ctxMinimal(), { cle: "test", fetchImpl: partiel })).toBeNull();
  });
});

describe("construitProposition", () => {
  it("assemble devis et livrables sans IA", async () => {
    const proposition = await construitProposition(
      PROSPECT as unknown as Prospect,
      audit(DEFAUTS_LOURDS),
      CATALOGUE,
    );

    expect(proposition.genere_par_ia).toBe(false);
    expect(proposition.devis.total_ht).toBeGreaterThan(0);
    expect(proposition.contexte.arguments).toHaveLength(3);
    expect(proposition.email.corps).toContain("STOP");
    expect(proposition.rapport_html).toContain("Proposition chiffrée");
    expect(proposition.script_appel).toContain("ACCROCHE");
  });

  it("utilise les textes de l'IA quand elle répond", async () => {
    const impl = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: JSON.stringify({
                  synthese: "Synthèse rédigée par l'IA.",
                  objet: "Objet IA",
                  corps: "Corps IA … STOP pour ne plus être contacté.",
                }),
              },
            }],
          },
        }],
      }),
    })) as unknown as typeof fetch;

    const proposition = await construitProposition(
      PROSPECT as unknown as Prospect,
      audit(DEFAUTS_CIBLES),
      CATALOGUE,
      { ia: { cle: "test", fetchImpl: impl } },
    );

    expect(proposition.genere_par_ia).toBe(true);
    expect(proposition.email.objet).toBe("Objet IA");
    expect(proposition.rapport_html).toContain("Synthèse rédigée par l&#39;IA.");
  });

  it("traite une entreprise sans site comme une création", async () => {
    const proposition = await construitProposition(
      { ...PROSPECT, site_statut: "aucun_site", site_web: null } as unknown as Prospect,
      null,
      CATALOGUE,
    );

    expect(proposition.devis.lignes_projet.map((l) => l.code)).toEqual(["site_vitrine"]);
    expect(proposition.email.objet).toContain("audit offert");
    expect(proposition.rapport_html).toContain("tout est à construire");
  });
});
