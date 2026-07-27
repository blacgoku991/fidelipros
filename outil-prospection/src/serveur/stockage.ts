// Stockage local : un seul fichier JSON, écrit de façon atomique.
// Remplace les quatre tables Supabase de la version SaaS. Aucune dépendance, aucun serveur
// de base de données : le fichier vit à côté du code et s'inspecte avec un éditeur de texte.

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";

import type { Contacts } from "../moteur/audit/contacts.ts";
import { domaine as domaineDe } from "../moteur/audit/http.ts";
import type { AuditSiteComplet } from "../moteur/audit/types.ts";
import type { Devis, Emetteur, Prestation } from "../moteur/proposition/types.ts";
import { EMETTEUR_PAR_DEFAUT } from "../moteur/proposition/devis.ts";
import type { Prospect } from "../moteur/types.ts";

export type StatutCommercial =
  | "nouveau" | "a_contacter" | "contacte" | "rdv" | "gagne" | "perdu" | "ignore";

export interface ProspectStocke extends Prospect {
  id: string;
  /** Domaine pour les prospects ajoutés à la main (dédoublonnage). */
  domaine: string | null;
  source: "recherche-entreprises" | "manuel";
  statut: StatutCommercial;
  notes: string | null;
  /** Coordonnées relevées sur le site, la meilleure d'abord. */
  emails: string[];
  telephones: string[];
  /** Fiche Google réellement publiée par le site (jamais devinée). */
  google_maps_url: string | null;
  reseaux: Contacts["reseaux"];
  dernier_audit_id: string | null;
  score_audit: number | null;
  score_seo: number | null;
  score_design: number | null;
  score_securite: number | null;
  score_technique: number | null;
  audit_le: string | null;
  cree_le: string;
}

export interface AuditStocke {
  id: string;
  prospect_id: string;
  cree_le: string;
  /**
   * Nom du fichier de capture dans `donnees/captures/`. La capture mobile pèse une centaine
   * de kilo-octets : la garder hors du JSON évite de réécrire une base obèse à chaque
   * modification, tout en permettant de la réinjecter en data URI dans le rapport.
   */
  capture: string | null;
  /** Audit tel que produit par le moteur, `captureDataUri` mis à part. */
  audit: AuditSiteComplet;
}

export interface DocumentsStockes {
  prospect_id: string;
  audit_id: string | null;
  synthese: string;
  email: { objet: string; corps: string };
  email_html: string;
  sms: string;
  script_appel: string;
  rapport_html: string;
  devis: Devis;
  genere_par_ia: boolean;
  cree_le: string;
}

interface BaseDonnees {
  version: 1;
  prospects: ProspectStocke[];
  audits: AuditStocke[];
  documents: DocumentsStockes[];
  prestations: Prestation[];
  emetteur: Emetteur;
}

/** Catalogue initial : mêmes libellés et prix que la version SaaS. */
const PRESTATIONS_INITIALES: Prestation[] = [
  { code: "site_vitrine", libelle: "Création d'un site vitrine (5 pages)", description: "Site responsive sur mesure : accueil, présentation, services, galerie, contact.", prix: 1200, unite: "forfait", categorie: "creation", actif: true, ordre: 10 },
  { code: "refonte_site", libelle: "Refonte complète du site existant", description: "Nouvelle maquette responsive, reprise des contenus, redirections SEO.", prix: 2500, unite: "forfait", categorie: "refonte", actif: true, ordre: 20 },
  { code: "responsive_mobile", libelle: "Adaptation mobile et tablette", description: "Reprise de la mise en page pour un affichage correct sur téléphone.", prix: 690, unite: "forfait", categorie: "design", actif: true, ordre: 30 },
  { code: "accessibilite", libelle: "Mise en accessibilité", description: "Contrastes, tailles de texte, zones cliquables.", prix: 390, unite: "forfait", categorie: "design", actif: true, ordre: 40 },
  { code: "optimisation_perf", libelle: "Optimisation de la vitesse", description: "Compression des images, mise en cache, réduction du poids des pages.", prix: 490, unite: "forfait", categorie: "design", actif: true, ordre: 50 },
  { code: "seo_technique", libelle: "SEO technique", description: "Balises, structure des titres, sitemap, données structurées, indexation.", prix: 590, unite: "forfait", categorie: "seo", actif: true, ordre: 60 },
  { code: "redaction_contenu", libelle: "Rédaction de contenu (5 pages)", description: "Textes optimisés pour la recherche locale.", prix: 550, unite: "forfait", categorie: "seo", actif: true, ordre: 70 },
  { code: "seo_local", libelle: "Référencement local", description: "Fiche Google Business, cohérence des coordonnées, collecte d'avis.", prix: 450, unite: "mois", categorie: "seo", actif: true, ordre: 80 },
  { code: "mise_https", libelle: "Passage en HTTPS", description: "Certificat SSL, redirections, correction du contenu non sécurisé.", prix: 190, unite: "forfait", categorie: "securite", actif: true, ordre: 90 },
  { code: "securisation_entetes", libelle: "Sécurisation du site", description: "En-têtes de sécurité, cookies conformes, masquage des versions.", prix: 390, unite: "forfait", categorie: "securite", actif: true, ordre: 100 },
  { code: "correctif_dns_email", libelle: "Protection de vos emails", description: "Configuration SPF, DKIM et DMARC contre l'usurpation.", prix: 290, unite: "forfait", categorie: "securite", actif: true, ordre: 110 },
  { code: "conformite_rgpd", libelle: "Mise en conformité RGPD", description: "Bandeau de consentement, blocage des traceurs avant accord, politique de confidentialité.", prix: 390, unite: "forfait", categorie: "securite", actif: true, ordre: 115 },
  { code: "mise_a_jour_cms", libelle: "Mise à jour et nettoyage du CMS", description: "Montée de version, suppression des fichiers exposés, sauvegardes.", prix: 450, unite: "forfait", categorie: "securite", actif: true, ordre: 120 },
  { code: "maintenance", libelle: "Maintenance et surveillance", description: "Mises à jour, sauvegardes, surveillance de disponibilité.", prix: 79, unite: "mois", categorie: "maintenance", actif: true, ordre: 130 },
  { code: "hebergement", libelle: "Hébergement et nom de domaine", description: "Hébergement en France, certificat SSL, email professionnel.", prix: 15, unite: "mois", categorie: "maintenance", actif: true, ordre: 140 },
];

/**
 * Complète le catalogue enregistré avec les prestations ajoutées depuis, sans toucher aux
 * prix ni aux libellés déjà personnalisés : une mise à jour de l'outil ne doit ni écraser vos
 * tarifs, ni laisser une règle d'audit sans ligne de devis correspondante.
 */
function fusionnePrestations(enregistrees: Prestation[] | undefined): Prestation[] {
  if (!enregistrees?.length) return PRESTATIONS_INITIALES;
  const codes = new Set(enregistrees.map((p) => p.code));
  return [...enregistrees, ...PRESTATIONS_INITIALES.filter((p) => !codes.has(p.code))];
}

function baseVide(): BaseDonnees {
  return {
    version: 1,
    prospects: [],
    audits: [],
    documents: [],
    prestations: PRESTATIONS_INITIALES,
    emetteur: { ...EMETTEUR_PAR_DEFAUT },
  };
}

/**
 * Base de données du dossier de travail. Chargée en mémoire au démarrage, réécrite en entier
 * à chaque modification — largement suffisant pour quelques milliers de prospects, et
 * inspectable à la main.
 */
export class Stockage {
  private base: BaseDonnees;
  private readonly chemin: string;

  constructor(chemin = join(process.cwd(), "donnees", "prospection.json")) {
    // Champ déclaré puis affecté : les propriétés de paramètres de constructeur ne sont pas
    // effaçables, et Node exécute ces fichiers TypeScript en retirant simplement les types.
    this.chemin = chemin;
    this.base = this.lit();
  }

  private lit(): BaseDonnees {
    if (!existsSync(this.chemin)) return baseVide();
    try {
      const brut = JSON.parse(readFileSync(this.chemin, "utf8")) as Partial<BaseDonnees>;
      // Tolérant : un fichier écrit par une version antérieure reste exploitable.
      const base = {
        ...baseVide(),
        ...brut,
        prestations: fusionnePrestations(brut.prestations),
        emetteur: { ...EMETTEUR_PAR_DEFAUT, ...(brut.emetteur ?? {}) },
      } as BaseDonnees;
      // Fiches écrites par une version antérieure : compléter sans casser.
      base.prospects = base.prospects.map((prospect) => ({
        ...prospect,
        emails: prospect.emails ?? [],
        telephones: prospect.telephones ?? [],
        google_maps_url: prospect.google_maps_url ?? null,
        reseaux: prospect.reseaux ?? { facebook: null, instagram: null, linkedin: null },
      }));
      return base;
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : String(erreur);
      throw new Error(`Fichier de données illisible (${this.chemin}) : ${message}`);
    }
  }

  /** Écriture atomique : fichier temporaire puis renommage, pour ne jamais laisser un JSON tronqué. */
  private ecrit(): void {
    mkdirSync(dirname(this.chemin), { recursive: true });
    const temporaire = `${this.chemin}.tmp`;
    writeFileSync(temporaire, JSON.stringify(this.base, null, 2), "utf8");
    renameSync(temporaire, this.chemin);
  }

  get emplacement(): string {
    return this.chemin;
  }

  // ── Prospects ─────────────────────────────────────────────────────────────

  prospects(): ProspectStocke[] {
    return [...this.base.prospects].sort((a, b) => b.score - a.score);
  }

  prospect(id: string): ProspectStocke | undefined {
    return this.base.prospects.find((p) => p.id === id);
  }

  /** Ajoute ou met à jour des prospects issus d'une recherche, sans écraser le suivi commercial. */
  enregistreProspects(trouves: Prospect[]): { nouveaux: number; total: number } {
    let nouveaux = 0;
    for (const trouve of trouves) {
      const existant = this.base.prospects.find((p) => p.siren && p.siren === trouve.siren);
      if (existant) {
        Object.assign(existant, trouve, {
          id: existant.id,
          statut: existant.statut,
          notes: existant.notes,
          source: existant.source,
          domaine: existant.domaine,
          cree_le: existant.cree_le,
        });
      } else {
        this.base.prospects.push(this.neuf(trouve, "recherche-entreprises", null));
        nouveaux++;
      }
    }
    this.ecrit();
    return { nouveaux, total: trouves.length };
  }

  /**
   * Prospect créé depuis l'écran « Auditer une URL », dédoublonné sur le domaine.
   * Le rapprochement se fait aussi sur le site déjà détecté d'un prospect issu de Sirene :
   * auditer l'adresse d'une entreprise déjà en base enrichit sa fiche au lieu d'en créer une
   * deuxième, et l'on conserve alors ses données Sirene (effectif, CA, dirigeant).
   */
  prospectDepuisDomaine(domaine: string, nom: string, url: string): ProspectStocke {
    const existant = this.base.prospects.find((p) =>
      p.domaine === domaine || (p.site_web ? domaineDe(p.site_web) === domaine : false));
    if (existant) {
      // Un prospect Sirene garde sa raison sociale : elle est plus fiable que la saisie.
      if (nom && !existant.siren && nom !== existant.nom) existant.nom = nom;
      existant.domaine ??= domaine;
      existant.site_web = url;
      this.ecrit();
      return existant;
    }
    const cree = this.neuf(
      {
        siren: null as unknown as string,
        siret_siege: null, nom, enseigne: null, activite_code: null, activite_section: null,
        nature_juridique: null, categorie_entreprise: null, date_creation: null,
        tranche_effectif: null, effectif_estime: null, chiffre_affaires: null,
        annee_finances: null, adresse: null, code_postal: null, ville: null, departement: null,
        latitude: null, longitude: null, dirigeant: null, site_web: url,
        site_statut: "non_verifie", site_score: null, site_signaux: [], site_verifie_le: null,
        email_contact: null, telephone: null,
        // Sans données Sirene, la capacité budgétaire est inconnue : socle neutre.
        budget_score: 50, score: 50, priorite: "tiede",
      },
      "manuel",
      domaine,
    );
    this.base.prospects.push(cree);
    this.ecrit();
    return cree;
  }

  private neuf(
    prospect: Prospect,
    source: ProspectStocke["source"],
    domaine: string | null,
  ): ProspectStocke {
    return {
      ...prospect,
      id: randomUUID(),
      domaine,
      source,
      statut: "nouveau",
      notes: null,
      emails: [],
      telephones: [],
      google_maps_url: null,
      reseaux: { facebook: null, instagram: null, linkedin: null },
      dernier_audit_id: null,
      score_audit: null,
      score_seo: null,
      score_design: null,
      score_securite: null,
      score_technique: null,
      audit_le: null,
      cree_le: new Date().toISOString(),
    };
  }

  majProspect(id: string, patch: Partial<ProspectStocke>): ProspectStocke | undefined {
    const prospect = this.prospect(id);
    if (!prospect) return undefined;
    Object.assign(prospect, patch, { id: prospect.id });
    this.ecrit();
    return prospect;
  }

  supprimeProspect(id: string): boolean {
    const avant = this.base.prospects.length;
    this.base.prospects = this.base.prospects.filter((p) => p.id !== id);
    for (const audit of this.base.audits.filter((a) => a.prospect_id === id)) {
      if (audit.capture) rmSync(join(this.dossierCaptures, audit.capture), { force: true });
    }
    this.base.audits = this.base.audits.filter((a) => a.prospect_id !== id);
    this.base.documents = this.base.documents.filter((d) => d.prospect_id !== id);
    if (this.base.prospects.length === avant) return false;
    this.ecrit();
    return true;
  }

  // ── Audits ────────────────────────────────────────────────────────────────

  enregistreAudit(prospectId: string, audit: AuditSiteComplet): AuditStocke {
    const id = randomUUID();
    const ligne: AuditStocke = {
      id,
      prospect_id: prospectId,
      cree_le: new Date().toISOString(),
      capture: this.ecritCapture(id, audit.captureDataUri),
      audit: { ...audit, captureDataUri: null },
    };
    this.base.audits.push(ligne);
    this.ecrit();
    return ligne;
  }

  /** Écrit la capture Lighthouse à côté de la base et retourne son nom de fichier. */
  private ecritCapture(auditId: string, dataUri: string | null): string | null {
    const correspondance = dataUri?.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
    if (!correspondance) return null;
    const [, type, base64] = correspondance;
    const fichier = `${auditId}.${type === "jpeg" ? "jpg" : type}`;
    mkdirSync(this.dossierCaptures, { recursive: true });
    writeFileSync(join(this.dossierCaptures, fichier), Buffer.from(base64, "base64"));
    return fichier;
  }

  private get dossierCaptures(): string {
    return join(dirname(this.chemin), "captures");
  }

  /** Chemin disque de la capture d'un audit, si elle existe encore. */
  cheminCapture(auditId: string): string | null {
    const ligne = this.audit(auditId);
    if (!ligne?.capture) return null;
    const chemin = join(this.dossierCaptures, ligne.capture);
    return existsSync(chemin) ? chemin : null;
  }

  /** Recompose l'audit avec sa capture en data URI, pour un rapport autonome. */
  auditAvecCapture(auditId: string): AuditSiteComplet | undefined {
    const ligne = this.audit(auditId);
    if (!ligne) return undefined;
    const chemin = this.cheminCapture(auditId);
    if (!chemin) return ligne.audit;
    const type = chemin.endsWith(".png") ? "png" : chemin.endsWith(".webp") ? "webp" : "jpeg";
    return {
      ...ligne.audit,
      captureDataUri: `data:image/${type};base64,${readFileSync(chemin).toString("base64")}`,
    };
  }

  dernierAudit(prospectId: string): AuditStocke | undefined {
    // À date égale (deux audits dans la même milliseconde), le dernier inscrit gagne.
    return this.base.audits
      .filter((a) => a.prospect_id === prospectId)
      .reduce<AuditStocke | undefined>(
        (meilleur, ligne) => (!meilleur || ligne.cree_le >= meilleur.cree_le ? ligne : meilleur),
        undefined,
      );
  }

  audit(id: string): AuditStocke | undefined {
    return this.base.audits.find((a) => a.id === id);
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  enregistreDocuments(documents: Omit<DocumentsStockes, "cree_le">): DocumentsStockes {
    const ligne: DocumentsStockes = { ...documents, cree_le: new Date().toISOString() };
    this.base.documents = this.base.documents.filter((d) => d.prospect_id !== documents.prospect_id);
    this.base.documents.push(ligne);
    this.ecrit();
    return ligne;
  }

  documents(prospectId: string): DocumentsStockes | undefined {
    return this.base.documents.find((d) => d.prospect_id === prospectId);
  }

  // ── Catalogue et identité ─────────────────────────────────────────────────

  prestations(): Prestation[] {
    return [...this.base.prestations].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  }

  majPrestations(prestations: Prestation[]): Prestation[] {
    this.base.prestations = prestations;
    this.ecrit();
    return this.prestations();
  }

  emetteur(): Emetteur {
    return this.base.emetteur;
  }

  majEmetteur(patch: Partial<Emetteur>): Emetteur {
    this.base.emetteur = { ...this.base.emetteur, ...patch };
    this.ecrit();
    return this.base.emetteur;
  }
}
