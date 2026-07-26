/**
 * Drapeau partagé indiquant qu'on est dans la passe de pré-rendu au build.
 *
 * Certains composants profondément imbriqués doivent livrer leur contenu
 * complet aux robots (réponses de FAQ dépliées, compteurs sur leur valeur
 * finale) sans qu'on ait à faire descendre une prop à travers toute la page.
 * `entry-server.tsx` le passe à `true` juste avant le rendu.
 */
export const renderMode = { prerender: false };
