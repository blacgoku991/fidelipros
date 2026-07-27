// Point d'entrée de la proposition commerciale : devis + documents de démarchage.

import { argumentsCles } from "../audit/score.ts";
import type { AuditSiteComplet } from "../audit/types.ts";
import type { Prospect } from "../types.ts";
import { construitDevis, EMETTEUR_PAR_DEFAUT, euros, type OptionsDevis } from "./devis.ts";
import { reformule, type OptionsIa } from "./ia.ts";
import {
  emailHtml, emailHtmlAutonome, emailPriseContact, rapportHtml, rapportHtmlAutonome,
  scriptAppel, sms, synthese,
} from "./redaction.ts";
import type { ContexteProposition, DocumentsProposition, Devis, Emetteur, Prestation } from "./types.ts";

export { construitDevis, EMETTEUR_PAR_DEFAUT, euros } from "./devis.ts";
export { reformule } from "./ia.ts";
export {
  emailHtml, emailHtmlAutonome, emailPriseContact, rapportHtml, rapportHtmlAutonome,
  scriptAppel, sms, synthese,
} from "./redaction.ts";
export type * from "./types.ts";

/** Lit l'identité de l'émetteur depuis les clés `devis_*` de `site_settings`. */
export function emetteurDepuisSettings(settings: Record<string, string>): Emetteur {
  const nombre = (cle: string, defaut: number) => {
    const valeur = Number(settings[cle]);
    return Number.isFinite(valeur) && valeur >= 0 ? valeur : defaut;
  };
  return {
    raison_sociale: settings.devis_raison_sociale?.trim() || EMETTEUR_PAR_DEFAUT.raison_sociale,
    siret: settings.devis_siret?.trim() ?? "",
    adresse: settings.devis_adresse?.trim() ?? "",
    email: settings.devis_email?.trim() || EMETTEUR_PAR_DEFAUT.email,
    telephone: settings.devis_telephone?.trim() ?? "",
    taux_tva: nombre("devis_taux_tva", EMETTEUR_PAR_DEFAUT.taux_tva),
    validite_jours: nombre("devis_validite_jours", EMETTEUR_PAR_DEFAUT.validite_jours),
    mentions: settings.devis_mentions?.trim() || EMETTEUR_PAR_DEFAUT.mentions,
  };
}

export interface OptionsProposition extends OptionsDevis {
  emetteur?: Emetteur;
  /** Reformulation IA : sans clé, les textes déterministes sont conservés. */
  ia?: OptionsIa;
  /** Nombre d'arguments mis en avant dans l'email et l'appel. */
  nbArguments?: number;
}

export interface Proposition extends DocumentsProposition {
  devis: Devis;
  contexte: ContexteProposition;
}

/**
 * Construit le devis puis tous les livrables de démarchage.
 * `audit` à null signifie « aucun site trouvé » : la proposition devient une création de site.
 */
export async function construitProposition(
  prospect: ContexteProposition["prospect"] | Prospect,
  audit: AuditSiteComplet | null,
  catalogue: Prestation[],
  options: OptionsProposition = {},
): Promise<Proposition> {
  const emetteur = options.emetteur ?? EMETTEUR_PAR_DEFAUT;
  const sansSite = options.sansSite ?? (!audit || prospect.site_statut === "aucun_site");
  const devis = construitDevis(audit, catalogue, { ...options, emetteur, sansSite });

  const contexte: ContexteProposition = {
    prospect,
    audit,
    devis,
    emetteur,
    arguments: audit ? argumentsCles(audit.findings, options.nbArguments ?? 3) : [],
  };

  // Audit non concluant : on n'appelle pas l'IA — il n'y a rien à raconter, et lui donner
  // un contexte vide l'inviterait à broder.
  const textes = audit && !audit.concluant ? null : await reformule(contexte, options.ia ?? {});
  const syntheseTexte = textes?.synthese ?? synthese(contexte);
  const email = textes
    ? { objet: textes.objet, corps: textes.corps }
    : emailPriseContact(contexte);

  return {
    devis,
    contexte,
    synthese: syntheseTexte,
    email,
    email_html: emailHtml(contexte, email),
    sms: sms(contexte),
    script_appel: scriptAppel(contexte),
    rapport_html: rapportHtml(contexte, syntheseTexte),
    genere_par_ia: Boolean(textes),
  };
}

/** Variante autonome de l'email HTML, pour l'ouvrir dans un navigateur avant de le coller. */
export function propositionEnEmailHtml(proposition: Proposition): string {
  return emailHtmlAutonome(proposition.contexte, proposition.email);
}

/** Variante autonome du rapport, pour l'écrire dans un fichier .html. */
export function propositionEnFichierHtml(proposition: Proposition): string {
  return rapportHtmlAutonome(proposition.contexte, proposition.synthese);
}
