// Reformulation des textes commerciaux par le gateway IA déjà utilisé par l'application
// (voir supabase/functions/geocode-address/index.ts).
//
// Contrainte de conception : l'IA ne reçoit que les défauts réellement constatés et a
// l'interdiction d'en inventer. En cas de clé absente, d'erreur ou de réponse invalide,
// l'appelant conserve les textes déterministes de redaction.ts.

import type { Finding } from "../audit/types.ts";
import { euros } from "./devis.ts";
import type { ContexteProposition } from "./types.ts";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODELE = "google/gemini-2.5-flash";

export interface TextesIa {
  synthese: string;
  objet: string;
  corps: string;
}

export interface OptionsIa {
  cle?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const SYSTEME = [
  "Tu es un commercial d'agence web française qui écrit à un dirigeant de TPE/PME.",
  "Tu ne mentionnes QUE les défauts fournis dans les données : n'invente jamais un problème, un chiffre, une statistique ou une référence client.",
  "Ton direct, concret, sans jargon technique et sans flatterie. Vouvoiement. Pas d'emoji.",
  "Le corps de l'email fait 150 mots maximum, se termine par une question proposant un créneau,",
  "et conserve à la fin la mention légale sur l'origine des données et la possibilité de refuser d'être recontacté.",
].join(" ");

function donneesPourIa(ctx: ContexteProposition) {
  const defaut = (f: Finding) => ({ titre: f.titre, constat: f.constat, consequence: f.impact });
  return {
    entreprise: {
      nom: ctx.prospect.enseigne || ctx.prospect.nom,
      ville: ctx.prospect.ville,
      activite: ctx.prospect.activite_code,
      dirigeant: ctx.prospect.dirigeant,
      site: ctx.prospect.site_web,
      a_un_site: ctx.prospect.site_statut !== "aucun_site" && Boolean(ctx.audit),
    },
    note_globale: ctx.audit?.scores.global ?? null,
    notes_par_volet: ctx.audit
      ? {
        referencement: ctx.audit.scores.seo,
        design_mobile: ctx.audit.scores.design,
        securite: ctx.audit.scores.securite,
        technique: ctx.audit.scores.technique,
      }
      : null,
    defauts_a_mettre_en_avant: ctx.arguments.map(defaut),
    nombre_total_de_defauts: ctx.audit?.findings.length ?? 0,
    devis: {
      total_ht: euros(ctx.devis.total_ht),
      mensuel_ht: ctx.devis.mensuel_ht ? euros(ctx.devis.mensuel_ht) : null,
      prestations: ctx.devis.lignes_projet.map((l) => l.libelle),
    },
    emetteur: {
      nom: ctx.emetteur.raison_sociale,
      email: ctx.emetteur.email,
      telephone: ctx.emetteur.telephone,
    },
  };
}

const OUTIL = {
  type: "function",
  function: {
    name: "proposer_textes",
    description: "Retourne la synthèse d'audit et l'email de prise de contact.",
    parameters: {
      type: "object",
      properties: {
        synthese: {
          type: "string",
          description: "3 phrases maximum résumant l'état du site et l'enjeu commercial.",
        },
        objet: { type: "string", description: "Objet de l'email, 60 caractères maximum." },
        corps: { type: "string", description: "Corps de l'email, 150 mots maximum, mention légale finale incluse." },
      },
      required: ["synthese", "objet", "corps"],
      additionalProperties: false,
    },
  },
};

/**
 * Demande une reformulation au gateway IA. Retourne null (et ne lève jamais) si la clé
 * est absente, si l'appel échoue ou si la réponse n'est pas exploitable.
 */
export async function reformule(
  ctx: ContexteProposition,
  options: OptionsIa = {},
): Promise<TextesIa | null> {
  if (!options.cle) return null;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), options.timeoutMs ?? 20_000);

  try {
    const res = await fetchImpl(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${options.cle}` },
      signal: controleur.signal,
      body: JSON.stringify({
        model: MODELE,
        messages: [
          { role: "system", content: SYSTEME },
          {
            role: "user",
            content:
              "Rédige la synthèse et l'email à partir de ces données d'audit :\n" +
              JSON.stringify(donneesPourIa(ctx), null, 2),
          },
        ],
        tools: [OUTIL],
        tool_choice: { type: "function", function: { name: "proposer_textes" } },
      }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices?: Array<{
        message?: { tool_calls?: Array<{ function?: { arguments?: string } }> };
      }>;
    };
    const brut = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!brut) return null;

    const textes = JSON.parse(brut) as Partial<TextesIa>;
    if (!textes.synthese?.trim() || !textes.objet?.trim() || !textes.corps?.trim()) return null;

    return {
      synthese: textes.synthese.trim(),
      objet: textes.objet.trim().slice(0, 120),
      corps: textes.corps.trim(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}
