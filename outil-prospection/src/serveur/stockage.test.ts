import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { Stockage, type ProspectStocke } from "./stockage.ts";
import { contactsVides } from "../moteur/audit/contacts.ts";
import type { AuditSiteComplet } from "../moteur/audit/types.ts";
import type { Prospect } from "../moteur/types.ts";

let dossier: string;
let chemin: string;

beforeEach(() => {
  dossier = mkdtempSync(join(tmpdir(), "prospection-test-"));
  chemin = join(dossier, "donnees", "prospection.json");
});

afterEach(() => rmSync(dossier, { recursive: true, force: true }));

function prospectSirene(surcharge: Partial<Prospect> = {}): Prospect {
  return {
    siren: "912345678", siret_siege: "91234567800017", nom: "BOULANGERIE LEMOINE",
    enseigne: "Le Fournil", activite_code: "10.71C", activite_section: "C",
    nature_juridique: "5710", categorie_entreprise: "PME", date_creation: "2025-09-15",
    tranche_effectif: "02", effectif_estime: 4, chiffre_affaires: 180_000, annee_finances: 2025,
    adresse: "12 rue des Remparts", code_postal: "33000", ville: "BORDEAUX", departement: "33",
    latitude: 44.84, longitude: -0.58, dirigeant: "Marie Lemoine",
    site_web: null, site_statut: "non_verifie", site_score: null, site_signaux: [],
    site_verifie_le: null, email_contact: null, telephone: null,
    budget_score: 62, score: 55, priorite: "tiede",
    ...surcharge,
  };
}

function auditFictif(surcharge: Partial<AuditSiteComplet> = {}): AuditSiteComplet {
  return {
    url: "https://garage-dupont.fr/", urlFinale: "https://garage-dupont.fr/",
    profondeur: "complet", accessibilite: "ok", concluant: true,
    scores: { global: 42, seo: 30, design: 40, securite: 50, technique: 60, urgence: "elevee" },
    findings: [], lighthouse: null, fichiersExposes: [],
    captureDataUri: null, technologie: null, archive: null, certificat: null, contacts: contactsVides(),
    emailContact: null, telephone: null, erreurs: [], dureeMs: 1200,
    ...surcharge,
  };
}

describe("stockage local", () => {
  it("part d'une base vide avec le catalogue complet et l'identité par défaut", () => {
    const stockage = new Stockage(chemin);
    expect(stockage.prospects()).toEqual([]);
    expect(stockage.prestations().length).toBeGreaterThanOrEqual(15);
    expect(stockage.prestations().map((p) => p.code)).toContain("conformite_rgpd");
    expect(stockage.emetteur().taux_tva).toBe(20);
    // Rien n'est écrit avant la première modification.
    expect(existsSync(chemin)).toBe(false);
  });

  it("écrit le fichier de façon atomique, sans laisser de fichier temporaire", () => {
    const stockage = new Stockage(chemin);
    stockage.enregistreProspects([prospectSirene()]);
    expect(existsSync(chemin)).toBe(true);
    expect(existsSync(`${chemin}.tmp`)).toBe(false);
    expect(JSON.parse(readFileSync(chemin, "utf8")).prospects).toHaveLength(1);
  });

  it("relit ce qui a été écrit", () => {
    new Stockage(chemin).enregistreProspects([prospectSirene()]);
    const relu = new Stockage(chemin);
    expect(relu.prospects().map((p) => p.nom)).toEqual(["BOULANGERIE LEMOINE"]);
  });

  it("ne réécrase jamais le suivi commercial lors d'une nouvelle recherche", () => {
    const stockage = new Stockage(chemin);
    const [cree] = (stockage.enregistreProspects([prospectSirene()]), stockage.prospects());
    stockage.majProspect(cree.id, { statut: "rdv", notes: "Rappeler lundi" });

    // Deuxième run : les données Sirene sont rafraîchies, le suivi ne bouge pas.
    const resultat = stockage.enregistreProspects([prospectSirene({ effectif_estime: 9, score: 71 })]);
    expect(resultat).toEqual({ nouveaux: 0, total: 1 });

    const apres = stockage.prospects()[0];
    expect(apres.id).toBe(cree.id);
    expect(apres.effectif_estime).toBe(9);
    expect(apres.score).toBe(71);
    expect(apres.statut).toBe("rdv");
    expect(apres.notes).toBe("Rappeler lundi");
    expect(apres.cree_le).toBe(cree.cree_le);
  });

  it("dédoublonne un audit d'URL sur le domaine et sur le site déjà connu", () => {
    const stockage = new Stockage(chemin);
    stockage.enregistreProspects([prospectSirene({ site_web: "https://www.garage-dupont.fr/" })]);

    // Même domaine que le site déjà détecté : on enrichit la fiche Sirene, sans doublon.
    const rapproche = stockage.prospectDepuisDomaine("garage-dupont.fr", "Garage Dupont", "https://garage-dupont.fr/");
    expect(stockage.prospects()).toHaveLength(1);
    expect(rapproche.siren).toBe("912345678");
    expect(rapproche.domaine).toBe("garage-dupont.fr");
    // La raison sociale Sirene est plus fiable que la saisie : elle est conservée.
    expect(rapproche.nom).toBe("BOULANGERIE LEMOINE");

    // Réauditer la même adresse retombe sur la même fiche.
    const deuxieme = stockage.prospectDepuisDomaine("garage-dupont.fr", "", "https://garage-dupont.fr/contact");
    expect(deuxieme.id).toBe(rapproche.id);
    expect(stockage.prospects()).toHaveLength(1);

    // Un domaine inconnu crée bien une fiche, au socle budgétaire neutre.
    const manuel = stockage.prospectDepuisDomaine("menuiserie-blanc.fr", "Menuiserie Blanc", "https://menuiserie-blanc.fr/");
    expect(stockage.prospects()).toHaveLength(2);
    expect(manuel.source).toBe("manuel");
    expect(manuel.budget_score).toBe(50);
    expect(manuel.nom).toBe("Menuiserie Blanc");
  });

  it("range la capture d'écran hors du JSON et sait la recomposer", () => {
    const stockage = new Stockage(chemin);
    const prospect = stockage.prospectDepuisDomaine("garage-dupont.fr", "Garage Dupont", "https://garage-dupont.fr/");
    const base64 = Buffer.from("faux-jpeg").toString("base64");

    const ligne = stockage.enregistreAudit(prospect.id, auditFictif({
      captureDataUri: `data:image/jpeg;base64,${base64}`,
    }));

    // Le JSON reste léger : la capture est un fichier à côté.
    expect(readFileSync(chemin, "utf8")).not.toContain(base64);
    expect(ligne.capture).toBe(`${ligne.id}.jpg`);
    expect(stockage.cheminCapture(ligne.id)).toContain("captures");
    expect(stockage.auditAvecCapture(ligne.id)?.captureDataUri).toBe(`data:image/jpeg;base64,${base64}`);
  });

  it("supprime une fiche avec ses audits, ses captures et ses documents", () => {
    const stockage = new Stockage(chemin);
    const prospect = stockage.prospectDepuisDomaine("garage-dupont.fr", "Garage Dupont", "https://garage-dupont.fr/");
    const audit = stockage.enregistreAudit(prospect.id, auditFictif({
      captureDataUri: `data:image/jpeg;base64,${Buffer.from("x").toString("base64")}`,
    }));
    const capture = stockage.cheminCapture(audit.id)!;
    stockage.enregistreDocuments({
      prospect_id: prospect.id, audit_id: audit.id, synthese: "s",
      email: { objet: "o", corps: "c" }, email_html: "<div></div>",
      email_intro: { objet: "i", corps: "c" }, email_intro_html: "<div></div>",
      sms: "s", script_appel: "a",
      rapport_html: "<article></article>",
      devis: {
        lignes_projet: [], lignes_recurrentes: [], sous_total_ht: 0, remise: 0, taux_remise: 0,
        total_ht: 0, taux_tva: 20, tva: 0, total_ttc: 0, mensuel_ht: 0, valide_jusqu_au: "2026-09-01",
      },
      genere_par_ia: false,
    });

    expect(stockage.supprimeProspect(prospect.id)).toBe(true);
    expect(stockage.prospects()).toEqual([]);
    expect(stockage.dernierAudit(prospect.id)).toBeUndefined();
    expect(stockage.documents(prospect.id)).toBeUndefined();
    expect(existsSync(capture)).toBe(false);
    // Supprimer deux fois n'échoue pas.
    expect(stockage.supprimeProspect(prospect.id)).toBe(false);
  });

  it("garde le dernier audit d'un prospect", () => {
    const stockage = new Stockage(chemin);
    const prospect = stockage.prospectDepuisDomaine("garage-dupont.fr", "Garage Dupont", "https://garage-dupont.fr/");
    stockage.enregistreAudit(prospect.id, auditFictif({ dureeMs: 1 }));
    const second = stockage.enregistreAudit(prospect.id, auditFictif({ dureeMs: 2 }));
    expect(stockage.dernierAudit(prospect.id)?.id).toBe(second.id);
  });

  it("complète une base écrite par une version antérieure sans écraser les prix personnalisés", () => {
    // Fiche sans les champs de coordonnées, catalogue réduit et tarif modifié.
    const ancienne = {
      version: 1,
      prospects: [{
        ...prospectSirene(), id: "abc", domaine: null, source: "recherche-entreprises",
        statut: "contacte", notes: null, dernier_audit_id: null, score_audit: null,
        score_seo: null, score_design: null, score_securite: null, score_technique: null,
        audit_le: null, cree_le: "2026-07-01T10:00:00.000Z",
      }],
      audits: [], documents: [],
      prestations: [{ code: "site_vitrine", libelle: "Création d'un site vitrine", prix: 1900, unite: "forfait", categorie: "creation", actif: true, ordre: 10 }],
      emetteur: { raison_sociale: "Atelier Web" },
    };
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(chemin, JSON.stringify(ancienne), "utf8");

    const stockage = new Stockage(chemin);
    const prospect = stockage.prospects()[0] as ProspectStocke;
    expect(prospect.emails).toEqual([]);
    expect(prospect.google_maps_url).toBeNull();
    expect(prospect.reseaux).toEqual({ facebook: null, instagram: null, linkedin: null });
    expect(prospect.statut).toBe("contacte");

    const catalogue = stockage.prestations();
    expect(catalogue.find((p) => p.code === "site_vitrine")?.prix).toBe(1900);
    expect(catalogue.map((p) => p.code)).toContain("conformite_rgpd");
    // L'identité partiellement renseignée est complétée par les valeurs par défaut.
    expect(stockage.emetteur().raison_sociale).toBe("Atelier Web");
    expect(stockage.emetteur().taux_tva).toBe(20);
  });

  it("refuse de démarrer sur un fichier illisible plutôt que d'écraser des données", () => {
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(chemin, "{ ceci n'est pas du json", "utf8");
    expect(() => new Stockage(chemin)).toThrow(/illisible/);
  });
});

describe("sauvegarde", () => {
  it("conserve la version précédente à chaque écriture", () => {
    const stockage = new Stockage(chemin);
    stockage.enregistreProspects([prospectSirene({ siren: "111111111", nom: "Première" })]);
    expect(existsSync(`${chemin}.bak`)).toBe(false); // rien à sauvegarder au premier écrit

    stockage.enregistreProspects([prospectSirene({ siren: "222222222", nom: "Deuxième" })]);
    const sauvegarde = JSON.parse(readFileSync(`${chemin}.bak`, "utf8"));
    expect(sauvegarde.prospects.map((p: { nom: string }) => p.nom)).toEqual(["Première"]);
    expect(JSON.parse(readFileSync(chemin, "utf8")).prospects).toHaveLength(2);
  });

  it("indique où trouver la sauvegarde si le fichier devient illisible", () => {
    const stockage = new Stockage(chemin);
    stockage.enregistreProspects([prospectSirene()]);
    stockage.majProspect(stockage.prospects()[0].id, { statut: "rdv" });
    writeFileSync(chemin, "{ tronqué", "utf8");
    expect(() => new Stockage(chemin)).toThrow(/\.bak/);
  });
});

describe("import OpenStreetMap", () => {
  const commerce = (osmId: string, surcharge: Partial<Prospect> = {}) => ({
    osmId,
    prospect: {
      ...prospectSirene({ siren: "", nom: "Boulangerie du Marché", code_postal: "33000" }),
      ...surcharge,
    },
  });

  it("crée les commerces puis les reconnaît à la recherche suivante", () => {
    const stockage = new Stockage(chemin);
    expect(stockage.enregistreCommerces([commerce("node/1")])).toEqual({ nouveaux: 1, total: 1 });
    expect(stockage.prospects()[0].source).toBe("openstreetmap");
    expect(stockage.prospects()[0].osm_id).toBe("node/1");

    // Deuxième passage : aucun doublon.
    expect(stockage.enregistreCommerces([commerce("node/1")])).toEqual({ nouveaux: 0, total: 1 });
    expect(stockage.prospects()).toHaveLength(1);
  });

  it("rattache un commerce à une fiche Sirene existante au lieu de la dupliquer", () => {
    const stockage = new Stockage(chemin);
    stockage.enregistreProspects([prospectSirene({ nom: "Boulangerie du Marché", code_postal: "33000" })]);

    stockage.enregistreCommerces([commerce("node/7", { telephone: "05 56 78 12 34", adresse: "12 rue des Remparts" })]);

    expect(stockage.prospects()).toHaveLength(1);
    const fiche = stockage.prospects()[0];
    // La fiche garde ses données Sirene et gagne les coordonnées de terrain.
    expect(fiche.siren).toBe("912345678");
    expect(fiche.source).toBe("recherche-entreprises");
    expect(fiche.osm_id).toBe("node/7");
    expect(fiche.telephone).toBe("05 56 78 12 34");
  });
});
