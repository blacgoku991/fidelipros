// Règles de sécurité : en-têtes HTTP, cookies, contenu mixte, versions logicielles,
// protection email (SPF/DMARC) et fichiers publics exposés.
//
// L'audit reste strictement passif : lecture de pages publiques et d'enregistrements DNS,
// aucune tentative d'exploitation, aucun contournement d'authentification.

import { PROTOCOLES_SURS } from "./certificat.ts";
import { emailEnClair } from "./contacts.ts";
import {
  aBandeauConsentement, formulaires, generateur, ressourcesNonSecurisees, scripts, texteVisible,
  traceurs,
} from "./html.ts";
import { constate } from "./regles.ts";
import type { ContexteAudit, Finding } from "./types.ts";

const MOTS_CONFIDENTIALITE = /(politique de confidentialit|donn[eé]es personnelles|vie priv[eé]e|rgpd|privacy)/i;

/** Versions majeures encore maintenues au moment de l'écriture des règles. */
const VERSIONS_MINIMALES: Array<{ motif: RegExp; nom: string; majeureMin: number }> = [
  { motif: /wordpress\s+(\d+)\.(\d+)/i, nom: "WordPress", majeureMin: 6 },
  { motif: /joomla!?\s*(\d+)\.(\d+)/i, nom: "Joomla", majeureMin: 4 },
  { motif: /drupal\s*(\d+)/i, nom: "Drupal", majeureMin: 9 },
  { motif: /prestashop\s*(\d+)\.(\d+)/i, nom: "PrestaShop", majeureMin: 8 },
];

export function evalueSecurite(ctx: ContexteAudit): Finding[] {
  const findings: Finding[] = [];
  const accueil = ctx.accueil;

  // Constat indépendant du contenu : la poignée de main TLS a échoué pour un motif précis.
  if (ctx.erreurCertificat) {
    findings.push(constate("sec_certificat_invalide", `HTTPS refusé : ${ctx.erreurCertificat}`));
  }

  // Certificat lu directement : la même information que le cadenas du navigateur.
  const certificat = ctx.certificat;
  if (certificat) {
    if (typeof certificat.joursRestants === "number" && certificat.joursRestants <= 21) {
      findings.push(constate(
        "sec_certificat_bientot_expire",
        certificat.joursRestants < 0
          ? `Certificat expiré depuis ${Math.abs(certificat.joursRestants)} jour(s) (${certificat.expireLe})`
          : `Expire dans ${certificat.joursRestants} jour(s), le ${certificat.expireLe}` +
            (certificat.emetteur ? ` — émis par ${certificat.emetteur}` : ""),
      ));
    }
    if (certificat.protocole && !PROTOCOLES_SURS.includes(certificat.protocole)) {
      findings.push(constate("sec_tls_obsolete", `Connexion négociée en ${certificat.protocole}`));
    }
  }

  // ── Protection email : vérifiable même si le site est en panne ─────────────
  // Un enregistrement non vérifié (résolveur injoignable) ne produit aucun constat.
  if (ctx.dns) {
    const { spf, dmarc, mx } = ctx.dns;
    if (spf.verifie && !spf.valeur) {
      findings.push(constate("sec_spf_absent", "Aucun enregistrement SPF sur le domaine"));
    }
    if (dmarc.verifie) {
      if (!dmarc.valeur) {
        findings.push(constate("sec_dmarc_absent", "Aucun enregistrement DMARC (_dmarc)"));
      } else if (/p=none/i.test(dmarc.valeur)) {
        findings.push(constate("sec_dmarc_permissif", `Politique déclarée : « ${dmarc.valeur.slice(0, 80)} »`));
      }
    }
    if (mx.verifie && !mx.valeur.length) {
      findings.push(constate("sec_mx_absent", "Aucun serveur de messagerie (MX) sur le domaine"));
    }
  }

  if (!accueil || accueil.statut >= 400) return findings;

  const html = accueil.html;
  const entetes = accueil.entetes;
  const enHttps = accueil.urlFinale.startsWith("https://");

  // ── Chiffrement du transport ──────────────────────────────────────────────
  if (!enHttps) {
    findings.push(constate("sec_https_absent", `Le site répond en HTTP sur ${accueil.urlFinale}`));
  } else if (ctx.redirigeVersHttps === false) {
    findings.push(constate("sec_redirection_https_absente", "La version http:// du site reste servie sans redirection"));
  }

  if (enHttps) {
    const mixte = ressourcesNonSecurisees(html);
    if (mixte.length) {
      findings.push(
        constate("sec_contenu_mixte", `${mixte.length} ressource(s) chargée(s) en http:// (ex. ${mixte[0].slice(0, 60)})`),
      );
    }
  }

  const formulairesNonChiffres = formulaires(html).filter((f) => /^http:\/\//i.test(f.action));
  if (formulairesNonChiffres.length || (!enHttps && formulaires(html).length)) {
    findings.push(
      constate("sec_formulaire_non_chiffre", "Un formulaire transmet les données saisies sans chiffrement"),
    );
  }

  // ── En-têtes de sécurité ──────────────────────────────────────────────────
  if (enHttps && !entetes["strict-transport-security"]) {
    findings.push(constate("sec_hsts_absent", "En-tête Strict-Transport-Security absent"));
  }
  if (!entetes["content-security-policy"]) {
    findings.push(constate("sec_csp_absente", "En-tête Content-Security-Policy absent"));
  }
  const csp = entetes["content-security-policy"] ?? "";
  if (!entetes["x-frame-options"] && !/frame-ancestors/i.test(csp)) {
    findings.push(constate("sec_xfo_absent", "Ni X-Frame-Options ni directive frame-ancestors"));
  }
  if (!entetes["x-content-type-options"]) {
    findings.push(constate("sec_nosniff_absent", "En-tête X-Content-Type-Options absent"));
  }
  if (!entetes["referrer-policy"]) {
    findings.push(constate("sec_referrer_absent", "En-tête Referrer-Policy absent"));
  }

  // ── Divulgation d'informations ────────────────────────────────────────────
  const bavards = ["server", "x-powered-by"]
    .map((cle) => (entetes[cle] ? `${cle}: ${entetes[cle]}` : null))
    .filter((v): v is string => Boolean(v) && /\d/.test(v!));
  if (bavards.length) {
    findings.push(constate("sec_divulgation_serveur", bavards.join(" · ")));
  }

  const gen = generateur(html) ?? "";
  if (/\d+\.\d+/.test(gen)) {
    findings.push(constate("sec_version_cms_visible", `La page annonce « ${gen} »`));
  }
  for (const { motif, nom, majeureMin } of VERSIONS_MINIMALES) {
    const trouve = gen.match(motif);
    if (trouve && Number(trouve[1]) < majeureMin) {
      findings.push(
        constate("sec_cms_obsolete", `${nom} ${trouve[1]}${trouve[2] ? `.${trouve[2]}` : ""} détecté (version maintenue : ${majeureMin}.x)`),
      );
      break;
    }
  }

  // ── Bibliothèques vulnérables ─────────────────────────────────────────────
  const tousScripts = scripts(html).join(" ").toLowerCase();
  const vulnerables: string[] = [];
  const jquery = tousScripts.match(/jquery[.-]?(\d+)\.(\d+)(?:\.(\d+))?/);
  if (jquery) {
    const majeure = Number(jquery[1]);
    const mineure = Number(jquery[2]);
    if (majeure < 3 || (majeure === 3 && mineure < 5)) {
      vulnerables.push(`jQuery ${jquery[1]}.${jquery[2]} (failles XSS publiées)`);
    }
  }
  const bootstrap = tousScripts.match(/bootstrap[.-]?(\d+)\.(\d+)/);
  if (bootstrap && (Number(bootstrap[1]) < 4 || (Number(bootstrap[1]) === 4 && Number(bootstrap[2]) < 3))) {
    vulnerables.push(`Bootstrap ${bootstrap[1]}.${bootstrap[2]} (failles XSS publiées)`);
  }
  if (vulnerables.length) {
    findings.push(constate("sec_lib_vulnerable", vulnerables.join(" · ")));
  }

  // ── Cookies ───────────────────────────────────────────────────────────────
  const cookiesFragiles = accueil.cookies.filter((cookie) => {
    const bas = cookie.toLowerCase();
    return !bas.includes("httponly") || !bas.includes("samesite") || (enHttps && !bas.includes("secure"));
  });
  if (cookiesFragiles.length) {
    const nom = cookiesFragiles[0].split("=")[0];
    findings.push(
      constate("sec_cookies_non_securises", `${cookiesFragiles.length} cookie(s) sans Secure/HttpOnly/SameSite (ex. ${nom})`),
    );
  }

  // ── Fichiers exposés et listing ───────────────────────────────────────────
  if (ctx.fichiersExposes?.length) {
    const listings = ctx.fichiersExposes.filter((f) => f.chemin.endsWith("/"));
    const fichiers = ctx.fichiersExposes.filter((f) => !f.chemin.endsWith("/"));
    if (fichiers.length) {
      findings.push(
        constate("sec_fichier_expose", fichiers.map((f) => `${f.chemin} — ${f.indice}`).join(" · ")),
      );
    }
    if (listings.length) {
      findings.push(constate("sec_listing_repertoire", listings.map((f) => f.chemin).join(" · ")));
    }
  }

  // ── RGPD et exposition de l'email ─────────────────────────────────────────
  const texte = texteVisible(html);
  if (!MOTS_CONFIDENTIALITE.test(html) && !MOTS_CONFIDENTIALITE.test(texte)) {
    findings.push(constate("sec_confidentialite_absente", "Aucune mention de politique de confidentialité"));
  }
  if (emailEnClair(html)) {
    findings.push(constate("sec_email_en_clair", "Adresse email écrite en clair dans la page"));
  }

  // Traceurs chargés dès l'arrivée alors qu'aucune solution de consentement n'est présente.
  // On ne conclut que sur ce qui est écrit dans la page : les deux faits sont observés.
  const traceursCharges = traceurs(html);
  if (traceursCharges.length && !aBandeauConsentement(html)) {
    findings.push(constate(
      "sec_traceurs_sans_consentement",
      `${traceursCharges.join(", ")} chargé(s) sans bandeau de consentement détecté`,
    ));
  }

  return findings;
}
