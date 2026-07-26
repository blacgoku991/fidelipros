/**
 * Plan du site : source unique pour le routeur, le pré-rendu, le sitemap et le
 * maillage interne. Ajouter une entrée ici suffit à créer une vraie page HTML
 * statique servie à son URL propre.
 *
 * ⚠️ Pages locales : Google déclasse les « pages satellites » — des pages
 * identiques où seul le nom de la ville change. Chaque page ci-dessous a donc
 * un contenu écrit spécifiquement. N'ajoutez une nouvelle commune que si vous y
 * avez réellement des clients ou une présence, et écrivez-lui un vrai texte.
 */

export type PageKind = "home" | "landing" | "legal" | "city" | "hub" | "zones";

export type RouteDef = {
  path: string;
  kind: PageKind;
  /** Balise <title> — le mot-clé doit être en tête. */
  title: string;
  description: string;
  /** Priorité dans le sitemap. */
  priority: number;
};

import { CITIES, HUBS } from "./cities";

const STATIC_ROUTES: RouteDef[] = [
  {
    path: "/",
    kind: "home",
    title: "Agence web à Asnières-sur-Seine (92) — Création de site & automatisation",
    description:
      "SmartFixx, agence web à Asnières-sur-Seine (92600) : création de site internet sur-mesure, refonte complète et automatisation de vos logiciels métiers. Devis ferme, première maquette en 48 h.",
    priority: 1.0,
  },
  {
    path: "/creation-site-internet-asnieres-sur-seine",
    kind: "landing",
    title: "Agence web à Asnières-sur-Seine (92600) — Création de site internet",
    description:
      "Agence web à Asnières-sur-Seine : création de site internet sur-mesure pour commerces, artisans et PME du 92. Rendez-vous sur place, site livré en 2 à 3 semaines, à partir de 1 490 € HT.",
    priority: 0.9,
  },
  {
    path: "/creation-site-internet-ile-de-france",
    kind: "landing",
    title: "Création de site internet en Île-de-France | Agence web SmartFixx",
    description:
      "Création de site internet et refonte en Île-de-France : Hauts-de-Seine, Paris et proche banlieue. Design sur-mesure, SEO local, automatisation métier. Devis ferme sous 3 jours.",
    priority: 0.9,
  },
  {
    path: "/refonte-site-internet",
    kind: "landing",
    title: "Refonte de site internet sans perdre son référencement | SmartFixx",
    description:
      "Refonte de site web menée sans perte de référencement : audit technique et SEO, plan de redirections 301 complet, migration des données, reprise de la Search Console.",
    priority: 0.8,
  },
  {
    path: "/automatisation-informatique",
    kind: "landing",
    title: "Automatisation informatique & interconnexion de logiciels | SmartFixx",
    description:
      "Automatisation des tâches répétitives et interconnexion de vos logiciels métiers, ERP, CRM et tableurs. Fin de la double saisie, rapports générés seuls, alertes automatiques.",
    priority: 0.8,
  },
  {
    path: "/mentions-legales",
    kind: "legal",
    title: "Mentions légales | SmartFixx",
    description:
      "Mentions légales de SmartFixx : éditeur du site, identification de l'entreprise, hébergement, propriété intellectuelle et médiation de la consommation.",
    priority: 0.2,
  },
  {
    path: "/politique-de-confidentialite",
    kind: "legal",
    title: "Politique de confidentialité | SmartFixx",
    description:
      "Comment SmartFixx traite vos données personnelles : finalités, base légale, durées de conservation, absence de cookies de suivi et exercice de vos droits RGPD.",
    priority: 0.2,
  },
];

/* Une route par commune : c'est ce qui permet d'être trouvé sur « création site
   internet + <ville> », requête sur laquelle une page unique ne peut rien. */
const CITY_ROUTES: RouteDef[] = CITIES.map((city) => ({
  path: `/creation-site-internet-${city.slug}`,
  kind: "city",
  title: `Création de site internet à ${city.name} (${city.postalCode}) | SmartFixx`,
  description: `Agence web à ${city.name} (${city.postalCode}) : création de site internet sur-mesure, refonte et automatisation. Bureaux à Asnières-sur-Seine, ${city.reach}. À partir de 1 490 € HT.`,
  priority: 0.8,
}));

/* Hubs départementaux : ils regroupent les communes et captent les requêtes
   « agence web + département », moins précises mais plus volumineuses. */
const HUB_ROUTES: RouteDef[] = HUBS.map((hub) => ({
  path: hub.slug,
  kind: "hub",
  title: hub.title,
  description: hub.description,
  priority: 0.7,
}));

const ZONES_ROUTE: RouteDef = {
  path: "/zones-desservies",
  kind: "zones",
  title: "Zones desservies en Île-de-France | Agence web SmartFixx",
  description:
    "Les communes d'Île-de-France où SmartFixx intervient : Hauts-de-Seine, Paris, Seine-Saint-Denis et Val-d'Oise. Une page par commune, avec son tissu économique local.",
  priority: 0.6,
};

export const ROUTES: RouteDef[] = [...STATIC_ROUTES, ZONES_ROUTE, ...HUB_ROUTES, ...CITY_ROUTES];

export const routeFor = (pathname: string): RouteDef => {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return ROUTES.find((route) => route.path === clean) ?? ROUTES[0];
};
