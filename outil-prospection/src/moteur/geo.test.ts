import { describe, expect, it } from "vitest";

import {
  DEPARTEMENTS, REGIONS, departementParCode, departementsDeRegion, libelleDepartement,
} from "./geo.ts";

describe("découpage administratif", () => {
  it("couvre les 101 départements et les 18 régions", () => {
    expect(DEPARTEMENTS).toHaveLength(101);
    expect(REGIONS).toHaveLength(18);
  });

  it("rattache chaque département à une région existante", () => {
    const connues = new Set(REGIONS.map((r) => r.id));
    const orphelins = DEPARTEMENTS.filter((d) => !connues.has(d.region));
    expect(orphelins).toEqual([]);
  });

  it("n'a ni code ni nom en double", () => {
    expect(new Set(DEPARTEMENTS.map((d) => d.code)).size).toBe(DEPARTEMENTS.length);
    expect(new Set(REGIONS.map((r) => r.id)).size).toBe(REGIONS.length);
  });

  it("rend les huit départements d'Île-de-France", () => {
    expect(departementsDeRegion("idf").map((d) => d.code))
      .toEqual(["75", "77", "78", "91", "92", "93", "94", "95"]);
  });

  it("ne rend rien pour une région inconnue plutôt que de deviner", () => {
    expect(departementsDeRegion("n_importe_quoi")).toEqual([]);
  });

  it("retrouve un département par son code, Corse comprise", () => {
    expect(departementParCode("92")?.nom).toBe("Hauts-de-Seine");
    // La Corse s'écrit 2A/2B : la saisie en minuscules doit passer.
    expect(departementParCode("2a")?.nom).toBe("Corse-du-Sud");
    expect(departementParCode("00")).toBeNull();
  });

  it("affiche un libellé lisible dans les listes déroulantes", () => {
    expect(libelleDepartement(departementParCode("75")!)).toBe("75 — Paris");
  });
});
