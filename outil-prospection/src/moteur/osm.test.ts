import { describe, expect, it } from "vitest";

import {
  CATEGORIES_OSM, chercheCommerces, construitRequeteOsm, mapCommerce, prospectDepuisCommerce,
} from "./osm.ts";

/** Réponse Overpass simulée. */
function overpass(elements: unknown[], statut = 200) {
  const corps = JSON.stringify({ elements });
  return (async () => ({
    ok: statut < 400,
    status: statut,
    url: "https://overpass-api.de/api/interpreter",
    headers: { get: () => "application/json" },
    text: async () => corps,
    json: async () => JSON.parse(corps),
    body: null,
  })) as unknown as typeof fetch;
}

const BOULANGERIE = {
  type: "node", id: 1234, lat: 44.84, lon: -0.58,
  tags: {
    name: "Boulangerie du Marché", shop: "bakery",
    "addr:housenumber": "12", "addr:street": "rue des Remparts",
    "addr:postcode": "33000", "addr:city": "Bordeaux",
    phone: "+33 5 56 12 34 56",
  },
};

const GARAGE_AVEC_SITE = {
  type: "way", id: 99, center: { lat: 44.85, lon: -0.57 },
  tags: { name: "Garage Martin", shop: "car_repair", website: "https://garage-martin.fr" },
};

describe("recherche OpenStreetMap", () => {
  it("construit une requête bornée à une commune et aux catégories demandées", () => {
    const requete = construitRequeteOsm({ ville: "Bordeaux", categories: ["restauration"], limite: 50 });
    expect(requete).toContain('["name"="Bordeaux"]');
    expect(requete).toContain('["admin_level"~"8|9"]');
    expect(requete).toContain("restaurant");
    expect(requete).toContain("out center tags 50");
    // Seuls les lieux nommés nous intéressent : un commerce sans nom n'est pas un prospect.
    expect(requete).toContain('["name"](area.zone)');
  });

  it("refuse une recherche sans zone : Overpass n'est pas un moteur mondial", () => {
    expect(() => construitRequeteOsm({ categories: ["commerce"] }))
      .toThrow(/commune, un code postal ou un département/);
  });

  it("neutralise les guillemets d'un nom de commune", () => {
    const requete = construitRequeteOsm({ ville: 'Bordeaux"]["hack"="1', categories: ["commerce"] });
    expect(requete).not.toContain('"]["hack"');
  });

  it("accepte une recherche par code postal", () => {
    expect(construitRequeteOsm({ codePostal: "33000", categories: ["beaute"] }))
      .toContain('["postal_code"="33000"]');
  });

  it("couvre un département entier : niveau administratif 6, repéré par son numéro", () => {
    const requete = construitRequeteOsm({ departement: "92", categories: ["btp"], limite: 3000 });
    expect(requete).toContain('["admin_level"="6"]');
    expect(requete).toContain('["ref"="92"]');
    // Une zone aussi large demande plus de temps qu'une commune.
    expect(requete).toContain("[timeout:180]");
    expect(requete).toContain("out center tags 3000;");
  });

  it("transforme un élément Overpass en commerce exploitable", () => {
    expect(mapCommerce(BOULANGERIE)).toEqual({
      osmId: "node/1234",
      nom: "Boulangerie du Marché",
      categorie: "bakery",
      adresse: "12 rue des Remparts",
      codePostal: "33000",
      ville: "Bordeaux",
      telephone: "+33 5 56 12 34 56",
      email: null,
      siteWeb: null,
      latitude: 44.84,
      longitude: -0.58,
    });
    // Un élément sans nom n'est pas exploitable.
    expect(mapCommerce({ type: "node", id: 5, tags: { shop: "bakery" } })).toBeNull();
  });

  it("filtre sur l'absence de site web quand c'est demandé", async () => {
    const impl = overpass([BOULANGERIE, GARAGE_AVEC_SITE]);
    const tous = await chercheCommerces({ ville: "Bordeaux", categories: ["commerce"] }, { fetchImpl: impl });
    expect(tous.map((c) => c.nom)).toEqual(["Boulangerie du Marché", "Garage Martin"]);

    const sansSite = await chercheCommerces(
      { ville: "Bordeaux", categories: ["commerce"], sansSiteSeulement: true },
      { fetchImpl: impl },
    );
    expect(sansSite.map((c) => c.nom)).toEqual(["Boulangerie du Marché"]);
  });

  it("dédoublonne sur l'identifiant OpenStreetMap", async () => {
    const impl = overpass([BOULANGERIE, BOULANGERIE]);
    const commerces = await chercheCommerces({ ville: "Bordeaux" }, { fetchImpl: impl });
    expect(commerces).toHaveLength(1);
  });

  it("explique la saturation du service gratuit plutôt qu'un code d'erreur", async () => {
    await expect(chercheCommerces({ ville: "Bordeaux" }, { fetchImpl: overpass([], 429) }))
      .rejects.toThrow(/saturé/);
  });

  it("convertit un commerce en prospect sans rien affirmer sur son site", () => {
    const prospect = prospectDepuisCommerce(mapCommerce(BOULANGERIE)!);
    expect(prospect.nom).toBe("Boulangerie du Marché");
    expect(prospect.telephone).toBe("+33 5 56 12 34 56");
    expect(prospect.departement).toBe("33");
    // OpenStreetMap ne mentionne pas de site : c'est un indice, pas une preuve.
    expect(prospect.site_web).toBeNull();
    expect(prospect.site_statut).toBe("non_verifie");
    expect(prospect.budget_score).toBe(50);
  });

  it("propose des catégories qui couvrent les métiers visés", () => {
    expect(CATEGORIES_OSM.map((c) => c.id)).toContain("btp");
    expect(CATEGORIES_OSM.every((c) => c.filtres.length > 0)).toBe(true);
  });
});
