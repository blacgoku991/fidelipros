import { describe, expect, it } from "vitest";

import {
  chercheEtablissements, decoupeAdresse, normaliseEtablissement, prospectDepuisEtablissement,
} from "./places.ts";

const PLOMBIER = {
  id: "ChIJplombier",
  displayName: { text: "Plomberie Durand" },
  formattedAddress: "12 Rue de Paris, 92600 Asnières-sur-Seine, France",
  nationalPhoneNumber: "01 47 90 11 22",
  websiteUri: "https://plomberie-durand.fr",
  googleMapsUri: "https://maps.google.com/?cid=123",
  primaryTypeDisplayName: { text: "Plombier" },
  location: { latitude: 48.9, longitude: 2.28 },
};

function reponse(corps: unknown, ok = true, statut = 200) {
  return {
    ok, status: statut,
    json: async () => corps,
  } as unknown as Response;
}

describe("decoupeAdresse", () => {
  it("extrait le code postal et la ville d'une adresse française", () => {
    expect(decoupeAdresse("12 Rue de Paris, 92600 Asnières-sur-Seine, France"))
      .toEqual({ codePostal: "92600", ville: "Asnières-sur-Seine" });
  });

  it("ne devine rien quand l'adresse n'est pas exploitable", () => {
    expect(decoupeAdresse("Somewhere, USA")).toEqual({ codePostal: null, ville: null });
    expect(decoupeAdresse(null)).toEqual({ codePostal: null, ville: null });
  });
});

describe("normaliseEtablissement", () => {
  it("retient le nom, les coordonnées et le lien de fiche", () => {
    const etablissement = normaliseEtablissement(PLOMBIER)!;
    expect(etablissement.nom).toBe("Plomberie Durand");
    expect(etablissement.telephone).toBe("01 47 90 11 22");
    expect(etablissement.siteWeb).toBe("https://plomberie-durand.fr");
    expect(etablissement.ficheGoogle).toBe("https://maps.google.com/?cid=123");
    expect(etablissement.codePostal).toBe("92600");
  });

  it("écarte un établissement définitivement fermé : ce n'est pas un prospect", () => {
    expect(normaliseEtablissement({ ...PLOMBIER, businessStatus: "CLOSED_PERMANENTLY" })).toBeNull();
  });

  it("écarte une fiche sans nom ou sans identifiant plutôt que d'inventer", () => {
    expect(normaliseEtablissement({ ...PLOMBIER, displayName: undefined })).toBeNull();
    expect(normaliseEtablissement({ ...PLOMBIER, id: undefined })).toBeNull();
  });
});

describe("chercheEtablissements", () => {
  it("suit la pagination et dédoublonne les fiches vues deux fois", async () => {
    const appels: Array<Record<string, unknown>> = [];
    const fetchSimule = (async (_url: string, init: RequestInit) => {
      const corps = JSON.parse(String(init.body)) as Record<string, unknown>;
      appels.push(corps);
      // La deuxième page renvoie une fiche neuve et répète la première.
      return corps.pageToken
        ? reponse({ places: [PLOMBIER, { ...PLOMBIER, id: "ChIJdeux", displayName: { text: "Plomberie Martin" } }] })
        : reponse({ places: [PLOMBIER], nextPageToken: "jeton-2" });
    }) as unknown as typeof fetch;

    const trouves = await chercheEtablissements("plombier Asnières", { cle: "k", fetchImpl: fetchSimule });

    expect(trouves.map((e) => e.nom)).toEqual(["Plomberie Durand", "Plomberie Martin"]);
    expect(appels[0].textQuery).toBe("plombier Asnières");
    expect(appels[1].pageToken).toBe("jeton-2");
  });

  it("ne garde que les établissements sans site quand on le demande", async () => {
    const fetchSimule = (async () => reponse({
      places: [PLOMBIER, { ...PLOMBIER, id: "ChIJsans", displayName: { text: "Sans Site" }, websiteUri: undefined }],
    })) as unknown as typeof fetch;

    const trouves = await chercheEtablissements("plombier", {
      cle: "k", fetchImpl: fetchSimule, sansSiteSeulement: true,
    });
    expect(trouves.map((e) => e.nom)).toEqual(["Sans Site"]);
  });

  it("transmet le message d'erreur de Google, qui dit quoi corriger", async () => {
    const fetchSimule = (async () => reponse(
      { error: { message: "This API project is not authorized to use this API." } }, false, 403,
    )) as unknown as typeof fetch;

    await expect(chercheEtablissements("plombier", { cle: "k", fetchImpl: fetchSimule }))
      .rejects.toThrow(/not authorized/);
  });

  it("refuse de partir sans clé plutôt que d'appeler pour rien", async () => {
    await expect(chercheEtablissements("plombier", { cle: "" })).rejects.toThrow(/GOOGLE_MAPS_API_KEY/);
  });
});

describe("prospectDepuisEtablissement", () => {
  it("reprend le téléphone et le site, mais laisse l'audit trancher sur l'état du site", () => {
    const prospect = prospectDepuisEtablissement(normaliseEtablissement(PLOMBIER)!);
    expect(prospect.telephone).toBe("01 47 90 11 22");
    expect(prospect.site_web).toBe("https://plomberie-durand.fr");
    expect(prospect.departement).toBe("92");
    // L'absence de site sur la fiche est un indice, pas une preuve.
    expect(prospect.site_statut).toBe("non_verifie");
  });
});
