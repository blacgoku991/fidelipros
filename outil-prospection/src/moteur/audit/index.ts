// Point d'entrée du moteur d'audit : collecte puis application des règles.
// Utilisé par l'edge function `audit-prospect`, le script CLI et les tests.

import { collecte, normaliseUrl, type OptionsCollecte } from "./collecte.ts";
import { contactsVides } from "./contacts.ts";
import { technologie } from "./html.ts";
import { evalueDesign } from "./design.ts";
import { evalueSecurite } from "./securite.ts";
import { evalueSeo } from "./seo.ts";
import { evalueTechnique } from "./technique.ts";
import { calculeScores, piliersNonMesures, piliersPartiels, trieFindings } from "./score.ts";
import type { AuditSiteComplet, ContexteAudit, Finding, Profondeur } from "./types.ts";

export {
  cheminAutorise, cheminsInterdits, collecte, estBlocageParPareFeu, mesureImages, normaliseUrl,
  resoutDomaine, verifieDuplicationWww, verifieLiens,
} from "./collecte.ts";
export { evalueDesign } from "./design.ts";
export { evalueSecurite } from "./securite.ts";
export { evalueSeo } from "./seo.ts";
export { evalueTechnique } from "./technique.ts";
export {
  argumentsCles, calculeScores, compteParSeverite, piliersNonMesures, piliersPartiels, PONDERATION_PILIERS,
  resumeSeverites, scorePilier, trieFindings,
} from "./score.ts";
export {
  constate, LIBELLES_EFFORT, LIBELLES_PILIERS, LIBELLES_SEVERITE, REGLES, reglesDuPilier,
} from "./regles.ts";
export { echappeHtml, technologie } from "./html.ts";
export { anneesDepuis, collecteArchive, dateDepuisHorodatage, type ArchiveSite } from "./archive.ts";
export { litCertificat, PROTOCOLES_SURS, type CertificatTls } from "./certificat.ts";
export {
  agregeContacts, contactsVides, decodeEmailsProteges, deobfusqueEmails, emailsDepuisHtml,
  formateTelephone, lienGoogleMaps, rechercheGoogleMaps, reseauxSociaux, telephonesDepuisHtml,
  type Contacts,
} from "./contacts.ts";
export { domaine, nomDepuisDomaine } from "./http.ts";
export { FICHIERS_SONDES } from "./collecte.ts";
export type * from "./types.ts";

/** Applique les quatre familles de règles à un contexte déjà collecté. */
export function appliqueRegles(ctx: ContexteAudit): Finding[] {
  return trieFindings([
    ...evalueSeo(ctx),
    ...evalueDesign(ctx),
    ...evalueSecurite(ctx),
    ...evalueTechnique(ctx),
  ]);
}

export interface OptionsAuditSite extends OptionsCollecte {
  profondeur?: Profondeur;
}

/**
 * Audit complet d'une URL : SEO, design, sécurité, technique.
 * En profondeur « rapide », ni Lighthouse ni sondage de fichiers ne sont lancés.
 */
export async function auditeSite(
  urlSaisie: string,
  options: OptionsAuditSite = {},
): Promise<AuditSiteComplet> {
  const debut = Date.now();
  const url = normaliseUrl(urlSaisie, options.autoriseHotesPrives);
  const profondeur: Profondeur = options.profondeur ?? "complet";

  if (!url) {
    return {
      url: urlSaisie,
      urlFinale: null,
      profondeur,
      accessibilite: "bloque",
      concluant: false,
      scores: calculeScores([]),
      findings: [],
      lighthouse: null,
      fichiersExposes: [],
      captureDataUri: null,
      technologie: null,
      archive: null,
      certificat: null,
      contacts: contactsVides(),
      emailContact: null,
      telephone: null,
      erreurs: [`Adresse invalide : ${urlSaisie}`],
      dureeMs: Date.now() - debut,
    };
  }

  const complet = profondeur === "complet";
  const ctx = await collecte(url, {
    ...options,
    avecLighthouse: options.avecLighthouse ?? complet,
    avecSonde: options.avecSonde ?? complet,
  });

  const findings = appliqueRegles(ctx);

  return {
    url,
    urlFinale: ctx.accueil?.urlFinale ?? null,
    profondeur,
    accessibilite: ctx.accessibilite,
    // Un audit sans observation du site ne conclut rien : ni note à présenter, ni devis.
    concluant: ctx.accessibilite !== "bloque",
    scores: (() => {
      // Le global ne doit compter que les volets réellement mesurés : un volet non mesuré
      // (source manquante, aucun défaut) vaudrait sinon 100 et gonflerait la note.
      const partiels = piliersPartiels(ctx);
      const nonMesures = piliersNonMesures(findings, partiels);
      return { ...calculeScores(findings, nonMesures), partiels };
    })(),
    findings,
    lighthouse: ctx.lighthouse,
    fichiersExposes: ctx.fichiersExposes ?? [],
    captureDataUri: ctx.lighthouse?.captureDataUri ?? null,
    technologie: ctx.accueil ? technologie(ctx.accueil.html, ctx.accueil.entetes) : null,
    archive: ctx.archive,
    certificat: ctx.certificat,
    contacts: ctx.contacts,
    emailContact: ctx.contacts.email,
    telephone: ctx.contacts.telephone,
    erreurs: ctx.erreurs,
    dureeMs: Date.now() - debut,
  };
}
