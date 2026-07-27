// Construction du devis à partir des défauts constatés.
//
// Principe : chaque règle d'audit référence les prestations qui la corrigent. Le devis est
// donc la déduplication des prestations appelées par les défauts réellement mesurés — jamais
// une liste standard, ce qui rend la proposition défendable ligne par ligne devant le client.

import type { AuditSiteComplet } from "../audit/types.ts";
import type { Devis, Emetteur, LigneDevis, Prestation } from "./types.ts";

export const EMETTEUR_PAR_DEFAUT: Emetteur = {
  raison_sociale: "SmartFixx",
  siret: "",
  adresse: "",
  email: "contact@smartfixx.fr",
  telephone: "",
  site_web: "https://smartfixx.fr",
  taux_tva: 20,
  validite_jours: 30,
  mentions: "Devis gratuit et sans engagement.",
};

/** Au-delà de ce nombre de forfaits, une remise commerciale est appliquée. */
const SEUIL_REMISE = 3;
const TAUX_REMISE = 0.1;

/** En dessous de cette note globale, on propose une refonte plutôt qu'une liste de correctifs. */
const SEUIL_REFONTE = 45;

/** Prestations qui deviennent inutiles si une refonte complète est proposée. */
const INCLUS_DANS_REFONTE = new Set([
  "responsive_mobile", "accessibilite", "optimisation_perf", "seo_technique",
  "site_vitrine", "securisation_entetes", "mise_https",
]);

export interface OptionsDevis {
  /** L'entreprise n'a aucun site : on vend une création, pas une refonte. */
  sansSite?: boolean;
  emetteur?: Emetteur;
  maintenant?: Date;
  /** Force l'ajout de prestations (codes du catalogue). */
  prestationsSupplementaires?: string[];
}

function arrondi(valeur: number): number {
  return Math.round(valeur * 100) / 100;
}

function ligne(prestation: Prestation, motifs: string[], quantite = 1): LigneDevis {
  return {
    code: prestation.code,
    libelle: prestation.libelle,
    description: prestation.description ?? null,
    quantite,
    prix_unitaire: prestation.prix,
    unite: prestation.unite,
    total: arrondi(prestation.prix * quantite),
    motifs,
  };
}

/** Date de fin de validité du devis. */
function validiteJusquA(emetteur: Emetteur, maintenant: Date): string {
  const validite = new Date(maintenant);
  validite.setDate(validite.getDate() + emetteur.validite_jours);
  return validite.toISOString().slice(0, 10);
}

/** Devis sans aucune ligne, utilisé quand il n'y a rien de vérifié à chiffrer. */
function devisVide(emetteur: Emetteur, maintenant: Date): Devis {
  return {
    lignes_projet: [],
    lignes_recurrentes: [],
    sous_total_ht: 0,
    remise: 0,
    taux_remise: 0,
    total_ht: 0,
    taux_tva: emetteur.taux_tva,
    tva: 0,
    total_ttc: 0,
    mensuel_ht: 0,
    valide_jusqu_au: validiteJusquA(emetteur, maintenant),
  };
}

/**
 * Sélectionne les prestations à facturer et calcule les totaux.
 * `audit` à null (aucun site trouvé) débouche sur une création de site ; un audit non
 * concluant débouche sur un devis vide.
 */
export function construitDevis(
  audit: AuditSiteComplet | null,
  catalogue: Prestation[],
  options: OptionsDevis = {},
): Devis {
  const emetteur = options.emetteur ?? EMETTEUR_PAR_DEFAUT;
  const maintenant = options.maintenant ?? new Date();
  const actifs = new Map(catalogue.filter((p) => p.actif !== false).map((p) => [p.code, p]));

  // Prestation → défauts qui la justifient
  const motifsParPrestation = new Map<string, string[]>();
  const ajoute = (code: string, motif: string) => {
    if (!actifs.has(code)) return;
    const motifs = motifsParPrestation.get(code) ?? [];
    if (motif && !motifs.includes(motif)) motifs.push(motif);
    motifsParPrestation.set(code, motifs);
  };

  // Audit non concluant : nous n'avons pas vu le site. Ce n'est pas « aucun site » — il n'y a
  // aucune information, donc rien à chiffrer tant que l'audit n'a pas été refait.
  if (audit && !audit.concluant) {
    return devisVide(emetteur, maintenant);
  }

  const sansSite = options.sansSite ?? !audit;
  if (sansSite) {
    ajoute("site_vitrine", "Aucun site web trouvé pour l'entreprise");
    ajoute("seo_local", "Aucune présence en ligne à référencer aujourd'hui");
    ajoute("hebergement", "Nom de domaine et hébergement à mettre en place");
    ajoute("maintenance", "Site à maintenir après la mise en ligne");
  } else if (audit) {
    for (const finding of audit.findings) {
      // La première prestation de la règle est la réponse principale ; les suivantes
      // sont des compléments qui ne sont retenus que s'ils sont déjà appelés ailleurs.
      const [principale] = finding.prestations;
      if (principale) ajoute(principale, finding.titre);
    }

    const refonteNecessaire =
      audit.scores.global < SEUIL_REFONTE || motifsParPrestation.has("refonte_site");
    if (refonteNecessaire) {
      const motifs = motifsParPrestation.get("refonte_site") ?? [];
      motifsParPrestation.clear();
      ajoute("refonte_site", "");
      motifsParPrestation.set("refonte_site", motifs.length ? motifs : ["Site à reprendre entièrement"]);
      // La refonte absorbe les correctifs unitaires ; on garde ce qui reste utile à côté.
      for (const finding of audit.findings) {
        for (const code of finding.prestations) {
          if (code === "refonte_site" || INCLUS_DANS_REFONTE.has(code)) continue;
          ajoute(code, finding.titre);
        }
      }
      ajoute("maintenance", "Éviter que le site ne se dégrade à nouveau");
    }
  }

  for (const code of options.prestationsSupplementaires ?? []) {
    ajoute(code, "Ajouté manuellement");
  }

  const lignes = [...motifsParPrestation.entries()]
    .map(([code, motifs]) => ligne(actifs.get(code)!, motifs))
    .sort((a, b) => (actifs.get(a.code)?.ordre ?? 0) - (actifs.get(b.code)?.ordre ?? 0));

  const lignes_projet = lignes.filter((l) => l.unite === "forfait");
  const lignes_recurrentes = lignes.filter((l) => l.unite === "mois");

  const sous_total_ht = arrondi(lignes_projet.reduce((total, l) => total + l.total, 0));
  const taux_remise = lignes_projet.length > SEUIL_REMISE ? TAUX_REMISE : 0;
  const remise = arrondi(sous_total_ht * taux_remise);
  const total_ht = arrondi(sous_total_ht - remise);
  const tva = arrondi(total_ht * (emetteur.taux_tva / 100));

  return {
    lignes_projet,
    lignes_recurrentes,
    sous_total_ht,
    remise,
    taux_remise,
    total_ht,
    taux_tva: emetteur.taux_tva,
    tva,
    total_ttc: arrondi(total_ht + tva),
    mensuel_ht: arrondi(lignes_recurrentes.reduce((total, l) => total + l.total, 0)),
    valide_jusqu_au: validiteJusquA(emetteur, maintenant),
  };
}

/** Montant formaté en euros, pour les documents commerciaux. */
export function euros(montant: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: montant % 1 === 0 ? 0 : 2,
  }).format(montant);
}
