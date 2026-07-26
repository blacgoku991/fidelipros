import { renderToStaticMarkup } from "react-dom/server";
import App from "./App";
import { renderMode } from "./lib/renderMode";
import { ROUTES } from "./data/routes";
import { site } from "./data/site";

/**
 * Point d'entrée du pré-rendu. `renderToStaticMarkup` plutôt que
 * `renderToString` : le client repart d'un `createRoot` complet, on n'a donc pas
 * besoin des marqueurs d'hydratation dans le HTML livré aux robots.
 *
 * `routes` et `siteUrl` sont réexportés pour que scripts/prerender.mjs n'ait
 * qu'une seule source de vérité à lire.
 */
export function render(pathname: string) {
  renderMode.prerender = true;
  return renderToStaticMarkup(<App prerender pathname={pathname} />);
}

export const routes = ROUTES;
export const siteUrl = site.url;
