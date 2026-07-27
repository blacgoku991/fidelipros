// Règles de sécurité : en-têtes HTTP, cookies, contenu mixte, versions logicielles,
// protection email (SPF/DMARC) et fichiers publics exposés.
//
// L'audit reste strictement passif : lecture de pages publiques et d'enregistrements DNS,
// aucune tentative d'exploitation, aucun contournement d'authentification.

import { PROTOCOLES_SURS } from "./certificat.ts";
import { emailEnClair } from "./contacts.ts";
import { failleDe, libelleFaille } from "./composants.ts";
import { logicielsObsoletes } from "./logiciels.ts";
import {
  aBandeauConsentement, composantsDetectes, formulaires, generateur, ressourcesNonSecurisees,
  scripts, scriptsAvecAttributs, texteVisible, traceurs,
} from "./html.ts";
import { constate } from "./regles.ts";
import type { ContexteAudit, Finding } from "./types.ts";

/** Cookies dont le dépôt sans consentement est explicitement sanctionné. */
const COOKIES_TRACEURS = [
  /^_ga/, /^_gid$/, /^_gcl_au$/, /^_fbp$/, /^_fbc$/, /^IDE$/, /^NID$/, /^_hjSession/, /^_uetsid/,
  /^_clck$/, /^_clsk$/, /^_ttp$/, /^__utm/,
];

/** Hôte d'une URL de script, pour nommer la source sans afficher une adresse illisible. */
function hoteLisible(src: string): string {
  try {
    return new URL(src, "https://exemple.invalid").hostname;
  } catch {
    return src.slice(0, 40);
  }
}

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
    const { spf, dmarc, mx, dnssec } = ctx.dns;
    if (spf.verifie && !spf.valeur) {
      findings.push(constate("sec_spf_absent", "Aucun enregistrement SPF sur le domaine"));
    } else if (spf.valeur && /[?+]all\b/i.test(spf.valeur)) {
      // Une règle qui se termine par « +all » ou « ?all » n'interdit rien : elle donne le
      // change tout en laissant n'importe qui usurper le domaine.
      findings.push(constate("sec_spf_permissif", `SPF se terminant par « ${/([?+~-]all)/i.exec(spf.valeur)?.[1]} » : ${spf.valeur.slice(0, 70)}`));
    }
    if (dmarc.verifie) {
      if (!dmarc.valeur) {
        findings.push(constate("sec_dmarc_absent", "Aucun enregistrement DMARC (_dmarc)"));
      } else if (/p=none/i.test(dmarc.valeur)) {
        findings.push(constate("sec_dmarc_permissif", `Politique déclarée : « ${dmarc.valeur.slice(0, 80)} »`));
      } else if (!/rua=/i.test(dmarc.valeur)) {
        findings.push(constate("sec_dmarc_sans_rapport", "DMARC actif mais sans adresse de rapport (rua)"));
      }
    }
    if (mx.verifie && !mx.valeur.length) {
      findings.push(constate("sec_mx_absent", "Aucun serveur de messagerie (MX) sur le domaine"));
    }
    // DNSSEC : constat seulement si des MX existent (un domaine de messagerie mérite la signature).
    if (dnssec.verifie && !dnssec.valeur && mx.valeur.length > 0) {
      findings.push(constate("sec_dnssec_absent", "Le domaine n'est pas signé par DNSSEC"));
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
  const hsts = entetes["strict-transport-security"] ?? "";
  if (enHttps && !hsts) {
    findings.push(constate("sec_hsts_absent", "En-tête Strict-Transport-Security absent"));
  } else if (enHttps) {
    // Un en-tête présent mais valable quelques heures ne protège quasiment personne.
    const duree = Number(/max-age=(\d+)/i.exec(hsts)?.[1] ?? "0");
    if (duree > 0 && duree < 15_552_000) {
      findings.push(constate(
        "sec_hsts_faible",
        `max-age de ${Math.round(duree / 86_400)} jour(s), recommandé : 180 jours minimum`,
      ));
    }
  }

  const csp = entetes["content-security-policy"] ?? "";
  if (!csp) {
    findings.push(constate("sec_csp_absente", "En-tête Content-Security-Policy absent"));
  } else {
    // Présence ≠ protection : ces directives annulent l'essentiel de l'effet attendu.
    const faiblesses = [
      /script-src[^;]*'unsafe-inline'/i.test(csp) ? "'unsafe-inline' sur les scripts" : null,
      /'unsafe-eval'/i.test(csp) ? "'unsafe-eval'" : null,
      /(?:default|script)-src[^;]*\*(?!\.)/i.test(csp) ? "sources autorisées en *" : null,
    ].filter(Boolean);
    if (faiblesses.length) {
      findings.push(constate("sec_csp_permissive", `Politique présente mais permissive : ${faiblesses.join(", ")}`));
    }
  }

  // Partage de ressources ouvert : dangereux seulement combiné aux identifiants de session.
  if (entetes["access-control-allow-origin"] === "*" &&
      /true/i.test(entetes["access-control-allow-credentials"] ?? "")) {
    findings.push(constate(
      "sec_cors_permissif",
      "Access-Control-Allow-Origin: * combiné à Allow-Credentials: true",
    ));
  }
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

  // Logiciel serveur en fin de support : plus aucun correctif de sécurité.
  for (const logiciel of logicielsObsoletes(entetes)) {
    findings.push(constate(
      "sec_logiciel_serveur_eol",
      `${logiciel.logiciel} ${logiciel.version} — fin de support : ${logiciel.finDeSupport}. Vérifier : ${logiciel.reference}`,
    ));
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

  // ── Chaîne d'approvisionnement : scripts externes et composants ───────────
  const scriptsExternes = scriptsAvecAttributs(html, accueil?.urlFinale)
    .filter((script) => script.externe && !/googletagmanager|google-analytics|gstatic|recaptcha/i.test(script.src));
  const sansIntegrite = scriptsExternes.filter((script) => !script.integrity);
  if (sansIntegrite.length) {
    findings.push(constate(
      "sec_sri_absente",
      `${sansIntegrite.length} script(s) externe(s) sans attribut integrity : ${
        sansIntegrite.slice(0, 2).map((script) => hoteLisible(script.src)).join(", ")}`,
    ));
  }

  const composants = composantsDetectes(html);
  const composantsFailles = composants.flatMap((composant) => {
    const faille = failleDe(composant.nom, composant.version);
    return faille ? [{ composant, faille }] : [];
  });

  for (const { composant, faille } of composantsFailles.slice(0, 5)) {
    findings.push(constate(
      "sec_composant_vulnerable",
      libelleFaille(composant.nom, composant.version, faille),
    ));
  }
  const versionsVisibles = composants.filter((composant) => composant.source !== "fichier");
  if (versionsVisibles.length >= 3 && !composantsFailles.length) {
    findings.push(constate(
      "sec_composants_exposes",
      `${versionsVisibles.length} extension(s) affichent leur version : ${
        versionsVisibles.slice(0, 4).map((c) => `${c.nom} ${c.version}`).join(", ")}`,
    ));
  }

  // security.txt (RFC 9116) : un site qui n'en a pas prive un chercheur de tout moyen de
  // signaler une faille de manière responsable.
  if (ctx.securityTxt === false) {
    findings.push(constate("sec_securitytxt_absent", "Aucun fichier /.well-known/security.txt"));
  }

  // Points d'entrée WordPress : constat, avec les identifiants réellement publiés.
  if (ctx.wordpress?.comptes.length) {
    findings.push(constate(
      "sec_enumeration_comptes",
      `/wp-json/wp/v2/users publie ${ctx.wordpress.comptes.length} identifiant(s) : ${
        ctx.wordpress.comptes.slice(0, 3).join(", ")}`,
    ));
  }
  if (ctx.wordpress?.xmlrpc) {
    findings.push(constate("sec_xmlrpc_ouvert", "/xmlrpc.php répond : l'interface est active"));
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
  // Preuve directe : les cookies publicitaires sont déjà posés dans la réponse d'accueil.
  const cookiesTraceurs = (accueil?.cookies ?? [])
    .map((cookie) => cookie.split("=")[0]?.trim() ?? "")
    .filter((nom) => COOKIES_TRACEURS.some((motif) => motif.test(nom)));
  if (cookiesTraceurs.length) {
    findings.push(constate(
      "sec_traceurs_avant_consentement",
      `Déposés dès l'ouverture, sans aucun clic : ${[...new Set(cookiesTraceurs)].slice(0, 4).join(", ")}`,
    ));
  }

  const traceursCharges = traceurs(html);
  if (traceursCharges.length && !aBandeauConsentement(html)) {
    findings.push(constate(
      "sec_traceurs_sans_consentement",
      `${traceursCharges.join(", ")} chargé(s) sans bandeau de consentement détecté`,
    ));
  }

  return findings;
}
