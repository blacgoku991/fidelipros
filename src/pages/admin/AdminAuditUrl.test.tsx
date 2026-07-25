import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminAuditUrl from "./AdminAuditUrl";
import type { ResultatAudit } from "@/lib/prospection";

// L'écran est testé sans Supabase : seules les fonctions d'accès sont simulées.
const auditeUrl = vi.fn();
const genereProposition = vi.fn();
const chargeProspectsManuels = vi.fn(async () => []);

vi.mock("@/lib/prospection", async () => {
  const reel = await vi.importActual<typeof import("@/lib/prospection")>("@/lib/prospection");
  return {
    ...reel,
    auditeUrl: (...args: unknown[]) => auditeUrl(...args),
    genereProposition: (...args: unknown[]) => genereProposition(...args),
    chargeProspectsManuels: () => chargeProspectsManuels(),
  };
});

// AdminLayout tire la session, la barre latérale et le garde d'accès : hors sujet ici.
vi.mock("@/components/admin/AdminLayout", () => ({
  AdminLayout: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div><h1>{title}</h1>{children}</div>
  ),
}));

const toast = vi.hoisted(() => ({
  success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

function resultatConcluant(): ResultatAudit {
  return {
    audit_id: "audit-1",
    prospect_id: "prospect-1",
    concluant: true,
    accessibilite: "ok",
    duree_ms: 12_000,
    audit: {
      url: "https://smartfixx.fr/",
      urlFinale: "https://smartfixx.fr/",
      concluant: true,
      accessibilite: "ok",
      scores: { global: 42, seo: 38, design: 30, securite: 55, technique: 60, urgence: "elevee" },
      erreurs: [],
      findings: [
        {
          regle: "seo_title_absent",
          pilier: "seo",
          severite: "critique",
          poids: 20,
          titre: "Aucun titre de page (balise title)",
          impact: "Google affiche l'adresse du site au lieu du nom de l'entreprise.",
          effort: "faible",
          prestations: ["seo_technique"],
          constat: "Aucune balise <title> sur la page d'accueil",
        },
        {
          regle: "design_viewport_absent",
          pilier: "design",
          severite: "critique",
          poids: 35,
          titre: "Site non adapté au mobile",
          impact: "Plus de 6 visiteurs sur 10 arrivent depuis un téléphone.",
          effort: "moyen",
          prestations: ["responsive_mobile"],
          constat: "Aucune balise meta viewport",
        },
      ],
    },
  };
}

function resultatBloque(): ResultatAudit {
  return {
    audit_id: "audit-2",
    prospect_id: "prospect-2",
    concluant: false,
    accessibilite: "bloque",
    message: "Accès refusé par une protection anti-robot (HTTP 403)",
    duree_ms: 3000,
    audit: null,
  };
}

describe("AdminAuditUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chargeProspectsManuels.mockResolvedValue([]);
  });

  const afficher = () => render(<MemoryRouter><AdminAuditUrl /></MemoryRouter>);

  const saisir = (libelle: RegExp, valeur: string) =>
    fireEvent.change(screen.getByLabelText(libelle), { target: { value: valeur } });
  const cliquer = (nom: RegExp) => fireEvent.click(screen.getByRole("button", { name: nom }));

  it("refuse une saisie qui n'est pas une adresse, sans appeler l'audit", async () => {
    afficher();

    saisir(/Adresse du site/i, "pas-une-adresse");
    cliquer(/Auditer le site/i);

    expect(auditeUrl).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("affiche les étapes pendant l'analyse puis les quatre notes et les défauts", async () => {
    let resoudre: (valeur: ResultatAudit) => void = () => undefined;
    auditeUrl.mockReturnValue(new Promise<ResultatAudit>((r) => { resoudre = r; }));
    afficher();

    saisir(/Adresse du site/i, "smartfixx.fr");
    cliquer(/Auditer le site/i);

    expect(auditeUrl).toHaveBeenCalledWith("smartfixx.fr", undefined);
    expect(screen.getByText(/Analyse en cours/i)).toBeInTheDocument();
    expect(screen.getByText(/usurpation d'email/i)).toBeInTheDocument();

    resoudre(resultatConcluant());

    await waitFor(() => expect(screen.getByText("42")).toBeInTheDocument());
    expect(screen.getByText("Note globale")).toBeInTheDocument();
    // « Sécurité » apparaît deux fois : la tuile de note et l'onglet du volet.
    expect(screen.getAllByText("Sécurité").length).toBeGreaterThanOrEqual(2);
    // Le volet Référencement est affiché par défaut, avec le constat mesuré et l'impact.
    expect(screen.getByText("Aucun titre de page (balise title)")).toBeInTheDocument();
    expect(screen.getByText(/Aucune balise <title>/)).toBeInTheDocument();
    expect(screen.getByText(/Google affiche l'adresse du site/)).toBeInTheDocument();
    // Les autres volets annoncent leur nombre de défauts.
    expect(screen.getByRole("tab", { name: /Design & mobile/i })).toHaveTextContent("1");
    expect(screen.getByText("2 point(s) relevé(s)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ouvrir la fiche/i })).toHaveAttribute(
      "href",
      "/admin/prospection/prospect-1",
    );
  });

  it("transmet le nom d'entreprise saisi", async () => {
    auditeUrl.mockResolvedValue(resultatConcluant());
    afficher();

    saisir(/Adresse du site/i, "smartfixx.fr");
    saisir(/Nom de l'entreprise/i, "SmartFixx");
    cliquer(/Auditer le site/i);

    await waitFor(() => expect(auditeUrl).toHaveBeenCalledWith("smartfixx.fr", "SmartFixx"));
  });

  it("affiche le bandeau et interdit la proposition quand l'audit n'est pas concluant", async () => {
    auditeUrl.mockResolvedValue(resultatBloque());
    afficher();

    saisir(/Adresse du site/i, "smartfixx.fr");
    cliquer(/Auditer le site/i);

    // Le libellé apparaît sur le badge d'état et en titre du bandeau.
    await waitFor(() => expect(screen.getAllByText("Audit non concluant").length).toBe(2));
    expect(screen.getByText(/protection anti-robot/i)).toBeInTheDocument();
    // Aucune note affichée : elles ne mesureraient rien.
    expect(screen.queryByText("Note globale")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Générer la proposition/i })).toBeDisabled();
  });

  it("génère la proposition pour le prospect créé", async () => {
    auditeUrl.mockResolvedValue(resultatConcluant());
    genereProposition.mockResolvedValue({
      devis: { total_ht: 3500, lignes_projet: [{ code: "refonte_site" }] },
    });
    afficher();

    saisir(/Adresse du site/i, "smartfixx.fr");
    cliquer(/Auditer le site/i);
    await waitFor(() => expect(screen.getByText("42")).toBeInTheDocument());

    cliquer(/Générer la proposition/i);

    await waitFor(() => expect(genereProposition).toHaveBeenCalledWith("prospect-1"));
    expect(await screen.findByRole("link", { name: /Rapport imprimable/i })).toBeInTheDocument();
  });

  it("liste les derniers sites audités à la main", async () => {
    chargeProspectsManuels.mockResolvedValue([
      { id: "p1", nom: "SmartFixx", site_web: "https://smartfixx.fr", score_audit: 42, audit_le: "2026-07-25" },
    ] as never);
    afficher();

    expect(await screen.findByText("SmartFixx")).toBeInTheDocument();
    expect(screen.getByText(/smartfixx.fr/)).toBeInTheDocument();
  });
});
