// Identité visuelle de l'émetteur : le monogramme et le logotype portés par l'interface,
// les emails et les documents remis au prospect.
//
// Deux rendus, parce que les contraintes ne sont pas les mêmes :
//   - navigateur (interface, rapport imprimable) → SVG en ligne, net à toutes les tailles ;
//   - client mail (Gmail, Outlook) → HTML et CSS uniquement. Gmail supprime les <svg> et
//     bloque les images en `data:`, donc le logo y est **dessiné en texte et en bordures** :
//     c'est le seul habillage qui s'affiche partout sans image distante.

/** Couleurs de la marque, reprises du site smartfixx.fr. */
export const MARQUE = {
  violet: "#a855f7",
  cyan: "#22d3ee",
  encre: "#0b1020",
  /** Fond du monogramme : presque noir, comme sur le site. */
  fondBadge: "#0d0b18",
} as const;

/**
 * Découpe un nom d'entreprise en deux moitiés pour le logotype bicolore
 * (« SmartFixx » → « Smart » + « Fixx »).
 *
 * La coupure se fait sur la majuscule interne quand il y en a une, sinon au milieu du mot.
 * Un nom en un seul bloc sans majuscule interne n'est pas coupé : mieux vaut un logotype
 * uni qu'une césure absurde.
 */
export function couperNom(nom: string): { debut: string; fin: string } {
  const propre = nom.trim();
  const interne = /^(.+?[a-zà-ÿ])([A-ZÀ-Þ].*)$/.exec(propre);
  if (interne) return { debut: interne[1], fin: interne[2] };

  const espace = propre.lastIndexOf(" ");
  if (espace > 0) return { debut: propre.slice(0, espace + 1), fin: propre.slice(espace + 1) };

  return { debut: propre, fin: "" };
}

/** Initiale affichée dans le monogramme, quand aucun symbole propre n'est fourni. */
export function initiale(nom: string): string {
  const lettre = nom.trim().charAt(0).toUpperCase();
  return /[A-ZÀ-Þ0-9]/.test(lettre) ? lettre : "•";
}

/**
 * Monogramme en SVG : carré arrondi sombre, liseré dégradé, et la croix de SmartFixx
 * (remplacée par l'initiale quand l'émetteur porte un autre nom).
 *
 * `id` distingue les dégradés quand plusieurs logos coexistent dans la même page.
 */
export function logoSvg(nom: string, taille = 32, id = "sfx"): string {
  const croix = /^smartfixx$/i.test(nom.trim());
  const r = taille / 32;
  const centre = taille / 2;

  const motif = croix
    ? `<path d="M${11 * r} ${11 * r}L${21 * r} ${21 * r}M${21 * r} ${11 * r}L${11 * r} ${21 * r}"
        stroke="url(#trait-${id})" stroke-width="${2.6 * r}" stroke-linecap="round"/>`
    : `<text x="${centre}" y="${centre}" text-anchor="middle" dominant-baseline="central"
        font-family="-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"
        font-size="${15 * r}" font-weight="700" fill="url(#trait-${id})">${echappe(initiale(nom))}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 ${taille} ${taille}" role="img" aria-label="${echappe(nom)}">
  <defs>
    <linearGradient id="trait-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${MARQUE.violet}"/><stop offset="1" stop-color="${MARQUE.cyan}"/>
    </linearGradient>
    <linearGradient id="bord-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${MARQUE.violet}" stop-opacity=".9"/>
      <stop offset="1" stop-color="${MARQUE.cyan}" stop-opacity=".7"/>
    </linearGradient>
  </defs>
  <rect x="${0.75 * r}" y="${0.75 * r}" width="${taille - 1.5 * r}" height="${taille - 1.5 * r}"
    rx="${9 * r}" fill="${MARQUE.fondBadge}" stroke="url(#bord-${id})" stroke-width="${1.5 * r}"/>
  ${motif}
</svg>`;
}

/**
 * Logotype complet (monogramme + nom bicolore) pour un contexte navigateur.
 * Utilisé en en-tête de l'interface et du rapport remis au prospect.
 *
 * `fond` bascule la couleur de la première moitié du nom : sur le papier blanc du rapport,
 * du texte blanc serait invisible. Le cyan de la seconde moitié tient sur les deux fonds.
 */
export function logotypeHtml(nom: string, fond: "sombre" | "clair" = "sombre", id = "sfx"): string {
  const { debut, fin } = couperNom(nom);
  const couleurDebut = fond === "clair" ? MARQUE.encre : "#f3f5fa";
  const couleurFin = fond === "clair" ? MARQUE.violet : MARQUE.cyan;
  return `<span style="display:inline-flex;align-items:center;gap:10px">
  ${logoSvg(nom, 34, id)}
  <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;line-height:1">
    <span style="color:${couleurDebut}">${echappe(debut)}</span><span style="color:${couleurFin}">${echappe(fin)}</span>
  </span>
</span>`;
}

/**
 * Logotype pour un email : aucune image, aucun SVG — un badge en cellule de tableau et le
 * nom en deux couleurs. C'est ce qui s'affiche à l'identique dans Gmail, Outlook et Apple Mail.
 */
export function logotypeEmailHtml(nom: string, police: string): string {
  const { debut, fin } = couperNom(nom);
  const symbole = /^smartfixx$/i.test(nom.trim()) ? "✕" : echappe(initiale(nom));

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
  <td width="34" style="width:34px;height:34px;background:${MARQUE.fondBadge};border:1px solid ${MARQUE.violet};border-radius:10px;text-align:center;vertical-align:middle;font-family:${police};font-size:16px;font-weight:700;color:${MARQUE.cyan};line-height:34px">${symbole}</td>
  <td style="padding-left:10px;font-family:${police};font-size:20px;font-weight:800;letter-spacing:-0.02em;white-space:nowrap">
    <span style="color:#ffffff">${echappe(debut)}</span><span style="color:${MARQUE.cyan}">${echappe(fin)}</span>
  </td>
</tr></table>`;
}

function echappe(texte: string): string {
  return texte
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
