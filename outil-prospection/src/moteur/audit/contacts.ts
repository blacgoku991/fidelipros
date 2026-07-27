// Récupération des moyens de contact publiés par l'entreprise : emails, téléphones, fiche
// Google, réseaux sociaux.
//
// Tout est lu sur des pages publiques (accueil, page contact, mentions légales) — aucune
// base achetée, aucun devinage : un email qui n'est pas écrit sur le site n'est pas inventé.
// Chaque trouvaille garde la page où elle a été lue, pour pouvoir la justifier.

import { liens } from "./html.ts";
import type { ReponseHttp } from "./types.ts";

export interface Contacts {
  /** Emails trouvés, du plus exploitable au moins pertinent. */
  emails: string[];
  email: string | null;
  telephones: string[];
  telephone: string | null;
  /** Lien vers la fiche Google (Maps / g.page) réellement présent sur le site. */
  googleMaps: string | null;
  reseaux: { facebook: string | null; instagram: string | null; linkedin: string | null };
  /** Pages où ces coordonnées ont été lues. */
  sources: string[];
}

export function contactsVides(): Contacts {
  return {
    emails: [], email: null, telephones: [], telephone: null, googleMaps: null,
    reseaux: { facebook: null, instagram: null, linkedin: null },
    sources: [],
  };
}

/** Adresses techniques ou d'outillage : jamais un interlocuteur. */
const EMAILS_A_IGNORER =
  /(^|@)(no-?reply|nepasrepondre|ne-pas-repondre|postmaster|abuse|webmaster@wordpress)|sentry|wixpress|sentry\.io|example\.(com|org)|@sentry|\.(png|jpe?g|webp|gif|svg|css|js)$|^u[0-9a-f]{4}|@(2x|3x)\./i;

/** Préfixes d'adresses de contact génériques : ce sont celles qu'on peut écrire en B2B. */
const PREFIXES_GENERIQUES = [
  "contact", "info", "infos", "bonjour", "hello", "accueil", "commercial", "direction",
  "secretariat", "devis", "rdv", "reservation", "boutique", "atelier", "agence",
];

/**
 * Longueurs bornées volontairement : un motif à quantificateurs libres
 * (`(?:\.[a-z0-9-]+)*\.`) part en explosion combinatoire sur une page contenant une longue
 * suite de caractères qui ressemble à une adresse — l'audit se bloquerait plusieurs secondes.
 */
const RE_EMAIL = /[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9-]{1,63}(?:\.[a-zA-Z0-9-]{1,63}){0,4}\.[a-zA-Z]{2,24}/g;

/**
 * Filet de sécurité très au-dessus de ce que la collecte télécharge (500 ko) : les motifs
 * ci-dessus sont à quantificateurs bornés, donc linéaires — inutile de tronquer une page
 * réelle, ce qui ferait perdre un téléphone écrit dans un pied de page volumineux.
 */
const TAILLE_MAX_ANALYSE = 2_000_000;

function borne(texte: string): string {
  return texte.length > TAILLE_MAX_ANALYSE ? texte.slice(0, TAILLE_MAX_ANALYSE) : texte;
}

/**
 * Décode les adresses masquées par Cloudflare (`data-cfemail`) : le premier octet est la clé,
 * les suivants sont l'adresse en XOR. C'est le rendu que le navigateur affiche de toute façon.
 */
export function decodeEmailsProteges(html: string): string[] {
  const trouves: string[] = [];
  for (const correspondance of html.matchAll(/data-cfemail="([0-9a-f]{6,})"/gi)) {
    const octets = correspondance[1].match(/../g);
    if (!octets || octets.length < 4) continue;
    const cle = parseInt(octets[0], 16);
    const decode = octets.slice(1)
      .map((octet) => String.fromCharCode(parseInt(octet, 16) ^ cle))
      .join("");
    if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(decode)) trouves.push(decode.toLowerCase());
  }
  return trouves;
}

/**
 * Remet en forme les adresses écrites pour tromper les robots
 * (`contact (at) garage-martin [point] fr`), telles qu'un humain les lirait.
 */
export function deobfusqueEmails(texte: string): string[] {
  const normalise = borne(texte)
    .replace(/\s*(?:\(|\[|&#40;|&lt;)?\s*(?:at|arobase|arrobase|@rob@se)\s*(?:\)|\]|&#41;|&gt;)?\s*/gi, "@")
    .replace(/\s*(?:\(|\[)?\s*(?:dot|point)\s*(?:\)|\])?\s*/gi, ".")
    .replace(/\s+@\s+/g, "@");
  return [...normalise.matchAll(RE_EMAIL)].map((m) => m[0].toLowerCase());
}

export function emailsDepuisHtml(htmlBrut: string): string[] {
  const html = borne(htmlBrut);
  const mailto = [...html.matchAll(/mailto:([^"'?>\s]{1,120})/gi)]
    .map((m) => decoupeUri(m[1]).toLowerCase());
  const brut = [...html.matchAll(RE_EMAIL)].map((m) => m[0].toLowerCase());
  // Le texte sans balises évite de récupérer un « @media » ou un identifiant de script.
  const masques = deobfusqueEmails(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " "));

  return [...new Set([...mailto, ...decodeEmailsProteges(html), ...brut, ...masques])]
    .map((email) => email.replace(/[.,;:)\]]+$/, ""))
    .filter((email) => email.length <= 80 && !EMAILS_A_IGNORER.test(email));
}

const RE_TELEPHONE = /(?:\+33|0033|0)\s?[1-9](?:[\s. -]?\d{2}){4}/g;

export function telephonesDepuisHtml(html: string): string[] {
  const dansLiens = [...html.matchAll(/tel:([+0-9\s.()-]{9,20})/gi)].map((m) => m[1]);
  const dansTexte = [...html.replace(/<[^>]+>/g, " ").matchAll(RE_TELEPHONE)].map((m) => m[0]);
  const propres = [...dansLiens, ...dansTexte]
    .map((brut) => brut.replace(/[^\d+]/g, ""))
    .map((chiffres) => (chiffres.startsWith("+33") ? `0${chiffres.slice(3)}` : chiffres.startsWith("0033") ? `0${chiffres.slice(4)}` : chiffres))
    .filter((chiffres) => /^0[1-9]\d{8}$/.test(chiffres))
    // Les numéros surtaxés ou de standard automatisé ne servent pas à démarcher.
    .filter((chiffres) => !/^08[19]/.test(chiffres));
  return [...new Set(propres)].map(formateTelephone);
}

/** 0556000000 → 05 56 00 00 00 (lisible et cliquable). */
export function formateTelephone(chiffres: string): string {
  return chiffres.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

/**
 * Une adresse est-elle écrite en clair dans la page (texte visible ou lien mailto) ?
 * Les adresses masquées (Cloudflare, « at »/« point ») ne comptent pas : c'est justement la
 * protection qu'on cherche à constater comme absente.
 */
export function emailEnClair(htmlBrut: string): boolean {
  const html = borne(htmlBrut);
  // Sans « @ », rien à chercher : évite de parcourir toute la page pour rien.
  if (!html.includes("@")) return false;
  if (/mailto:[a-zA-Z0-9._%+-]{1,64}@/i.test(html)) return true;
  const texte = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");
  RE_EMAIL.lastIndex = 0;
  return RE_EMAIL.test(texte);
}

/**
 * Lien vers la fiche d'établissement Google si le site en publie un : lien Maps, lien court
 * `g.page`, ou carte intégrée en iframe. Sans clé d'API, c'est la seule preuve qu'une fiche
 * existe — le reste ne serait qu'une supposition.
 */
export function lienGoogleMaps(htmlBrut: string): string | null {
  const html = borne(htmlBrut);
  const motifs = [
    /https?:\/\/(?:www\.)?google\.[a-z.]{2,6}\/maps\/[^\s"'<>\\]+/i,
    /https?:\/\/maps\.google\.[a-z.]{2,6}\/[^\s"'<>\\]+/i,
    /https?:\/\/maps\.app\.goo\.gl\/[^\s"'<>\\]+/i,
    /https?:\/\/goo\.gl\/maps\/[^\s"'<>\\]+/i,
    /https?:\/\/g\.page\/[^\s"'<>\\]+/i,
    /https?:\/\/(?:www\.)?google\.[a-z.]{2,6}\/maps\/embed\?pb=[^\s"'<>\\]+/i,
  ];
  for (const motif of motifs) {
    const trouve = html.match(motif);
    if (trouve) return decodeEntites(trouve[0]).replace(/[),.;]+$/, "");
  }
  return null;
}

const RESEAUX: Array<[keyof Contacts["reseaux"], RegExp]> = [
  ["facebook", /https?:\/\/(?:www\.|m\.|fr-fr\.)?facebook\.com\/[^\s"'<>\\?]{2,}/i],
  ["instagram", /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>\\?]{2,}/i],
  ["linkedin", /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in)\/[^\s"'<>\\?]{2,}/i],
];

export function reseauxSociaux(html: string): Contacts["reseaux"] {
  const resultat: Contacts["reseaux"] = { facebook: null, instagram: null, linkedin: null };
  for (const [reseau, motif] of RESEAUX) {
    const trouve = html.match(motif);
    if (trouve) resultat[reseau] = decodeEntites(trouve[0]).replace(/[),.;]+$/, "");
  }
  return resultat;
}

/** decodeURIComponent lève sur une séquence % invalide : une page tierce n'a pas à casser l'audit. */
function decoupeUri(valeur: string): string {
  try {
    return decodeURIComponent(valeur);
  } catch {
    return valeur;
  }
}

function decodeEntites(url: string): string {
  return url.replace(/&amp;/g, "&").replace(/&#0?38;/g, "&");
}

/** Pages qui portent presque toujours les coordonnées, repérées dans les liens de l'accueil. */
const MOTS_CONTACT = /contact|nous-?ecrire|nous-?joindre|mentions|legal|impressum|coordonnees|a-?propos/i;

export function lienspagesContact(html: string, base: string, max = 2): string[] {
  const candidats: string[] = [];
  let origine: string;
  try {
    origine = new URL(base).origin;
  } catch {
    return [];
  }
  for (const lien of liens(html)) {
    if (/^(mailto:|tel:|javascript:|#)/i.test(lien.href)) continue;
    let absolue: URL;
    try {
      absolue = new URL(lien.href, base);
    } catch {
      continue;
    }
    if (absolue.origin !== origine) continue;
    if (!MOTS_CONTACT.test(absolue.pathname) && !MOTS_CONTACT.test(lien.texte)) continue;
    absolue.hash = "";
    const adresse = absolue.toString();
    if (adresse !== base && !candidats.includes(adresse)) candidats.push(adresse);
    if (candidats.length >= max) break;
  }
  return candidats;
}

/** Chemins tentés seulement si l'accueil ne propose aucun lien de contact. */
export const CHEMINS_CONTACT = ["/contact", "/contact/", "/nous-contacter", "/mentions-legales"];

/**
 * Agrège les coordonnées de toutes les pages lues.
 * Une adresse sur le domaine du site passe devant une adresse Gmail, et une adresse générique
 * (`contact@…`) devant l'adresse personnelle d'un salarié : c'est celle qu'on peut écrire.
 */
export function agregeContacts(pages: Array<ReponseHttp | null>, domaineSite?: string | null): Contacts {
  const contacts = contactsVides();
  const scores = new Map<string, number>();

  for (const page of pages) {
    if (!page?.html) continue;
    let utile = false;

    for (const email of emailsDepuisHtml(page.html)) {
      const domaine = email.split("@")[1] ?? "";
      const prefixe = email.split("@")[0] ?? "";
      let score = 0;
      if (domaineSite && (domaine === domaineSite || domaine === domaineSite.replace(/^www\./, ""))) score += 40;
      if (PREFIXES_GENERIQUES.some((p) => prefixe === p || prefixe.startsWith(`${p}.`) || prefixe.startsWith(`${p}-`))) score += 25;
      if (/gmail|orange\.fr|wanadoo|free\.fr|hotmail|outlook|yahoo|laposte/.test(domaine)) score -= 10;
      scores.set(email, Math.max(scores.get(email) ?? -Infinity, score));
      utile = true;
    }

    for (const telephone of telephonesDepuisHtml(page.html)) {
      if (!contacts.telephones.includes(telephone)) contacts.telephones.push(telephone);
      utile = true;
    }

    contacts.googleMaps ??= lienGoogleMaps(page.html);
    const reseaux = reseauxSociaux(page.html);
    for (const cle of ["facebook", "instagram", "linkedin"] as const) {
      contacts.reseaux[cle] ??= reseaux[cle];
    }

    if (utile && !contacts.sources.includes(page.urlFinale)) contacts.sources.push(page.urlFinale);
  }

  contacts.emails = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([email]) => email);
  contacts.email = contacts.emails[0] ?? null;
  contacts.telephone = contacts.telephones[0] ?? null;
  return contacts;
}

/**
 * Lien de recherche de la fiche Google d'une entreprise, à défaut d'un lien publié.
 * C'est une recherche, pas une fiche : l'interface le dit explicitement.
 */
export function rechercheGoogleMaps(nom: string, ville?: string | null, codePostal?: string | null): string {
  const requete = [nom, codePostal, ville].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(requete)}`;
}
