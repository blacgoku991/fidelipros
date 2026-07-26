import { FAQ_ITEMS } from "@/data/faq";
import { SERVICES, site } from "@/data/site";
import { LANDINGS } from "@/data/landings";
import type { RouteDef } from "@/data/routes";
import { cityBySlug, hubBySlug } from "@/data/cities";

/**
 * Données structurées schema.org, rendues dans le HTML pré-généré au build (voir
 * scripts/prerender.mjs) : les robots les lisent sans exécuter de JavaScript.
 *
 * Un seul `@graph` permet aux entités de se référencer par `@id`, ce que Google
 * préfère à des blocs isolés. L'entité principale est un `LocalBusiness` avec
 * adresse et coordonnées : c'est ce qui rattache le site à Asnières-sur-Seine
 * pour les recherches géolocalisées.
 */
export function Seo({ route }: { route: RouteDef }) {
  const base = site.url.replace(/\/$/, "");
  const orgId = `${base}/#organization`;
  const siteId = `${base}/#website`;
  const pageUrl = `${base}${route.path === "/" ? "/" : route.path}`;
  const hasAddress = Boolean(site.city);

  const places = site.areaServed.map((name) => ({ "@type": "Place", name }));

  const graph: Record<string, unknown>[] = [
    {
      "@type": ["Organization", "LocalBusiness", "ProfessionalService"],
      "@id": orgId,
      name: site.name,
      legalName: site.legalName,
      url: `${base}/`,
      description: `${site.name} est une agence web installée à ${site.city} (${site.postalCode}) : création de site internet sur-mesure, refonte complète et automatisation des logiciels métiers pour les TPE et PME des Hauts-de-Seine et d'Île-de-France.`,
      slogan: "On conçoit, on refond, on automatise.",
      email: site.email,
      ...(site.phone ? { telephone: site.phone } : {}),
      foundingDate: site.foundingYear,
      logo: { "@type": "ImageObject", url: `${base}/favicon.svg` },
      image: `${base}/og-image.png`,
      priceRange: "€€",
      currenciesAccepted: "EUR",
      openingHours: site.openingHours,
      ...(hasAddress
        ? {
            address: {
              "@type": "PostalAddress",
              ...(site.legal.address ? { streetAddress: site.legal.address } : {}),
              addressLocality: site.city,
              addressRegion: site.region,
              postalCode: site.postalCode,
              addressCountry: site.country,
            },
            geo: {
              "@type": "GeoCoordinates",
              latitude: site.geo.latitude,
              longitude: site.geo.longitude,
            },
          }
        : {}),
      areaServed: places,
      knowsAbout: [
        "Création de site internet",
        "Refonte de site web",
        "Automatisation des processus métier",
        "Interconnexion de logiciels",
        "Développement d'applications web",
        "Référencement naturel technique",
        "Référencement local",
        "Intégration d'API",
        "Robotisation des tâches (RPA)",
      ],
      sameAs: site.social.map((item) => item.href),
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: `Prestations ${site.name}`,
        itemListElement: SERVICES.map((service) => ({
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: service.name,
            description: service.description,
            provider: { "@id": orgId },
            areaServed: places,
          },
        })),
      },
    },
    {
      "@type": "WebSite",
      "@id": siteId,
      url: `${base}/`,
      name: site.name,
      description: site.tagline,
      inLanguage: "fr-FR",
      publisher: { "@id": orgId },
    },
    {
      "@type": "WebPage",
      "@id": `${pageUrl}#webpage`,
      url: pageUrl,
      name: route.title,
      description: route.description,
      isPartOf: { "@id": siteId },
      about: { "@id": orgId },
      inLanguage: "fr-FR",
      primaryImageOfPage: `${base}/og-image.png`,
    },
  ];

  // La FAQ n'existe que sur l'accueil : la déclarer ailleurs serait incohérent.
  if (route.kind === "home") {
    graph.push({
      "@type": "FAQPage",
      "@id": `${base}/#faq`,
      isPartOf: { "@id": siteId },
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    });
  }

  /* Pages commune : on déclare un Service explicitement rattaché à la ville. Sans
     ce rattachement, Google n'a aucune raison de relier la page à la localité
     autrement que par le texte. */
  const city =
    route.kind === "city"
      ? cityBySlug(route.path.replace("/creation-site-internet-", ""))
      : undefined;

  if (city) {
    graph.push({
      "@type": "Service",
      "@id": `${pageUrl}#service`,
      name: `Création de site internet à ${city.name}`,
      description: route.description,
      serviceType: "Création de site internet",
      provider: { "@id": orgId },
      areaServed: {
        "@type": "City",
        name: city.name,
        postalCode: city.postalCode,
        containedInPlace: { "@type": "AdministrativeArea", name: city.department },
      },
    });

    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${pageUrl}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${base}/` },
        { "@type": "ListItem", position: 2, name: city.department, item: `${base}${city.hub}` },
        { "@type": "ListItem", position: 3, name: city.name, item: pageUrl },
      ],
    });

    graph.push({
      "@type": "FAQPage",
      "@id": `${pageUrl}#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: city.faq.q,
          acceptedAnswer: { "@type": "Answer", text: city.faq.a },
        },
      ],
    });
  }

  const hub = route.kind === "hub" ? hubBySlug(route.path) : undefined;
  if (hub) {
    graph.push({
      "@type": "Service",
      "@id": `${pageUrl}#service`,
      name: `Agence web dans ${hub.name}`,
      description: route.description,
      serviceType: "Création de site internet",
      provider: { "@id": orgId },
      areaServed: { "@type": "AdministrativeArea", name: hub.name },
    });

    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${pageUrl}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${base}/` },
        { "@type": "ListItem", position: 2, name: hub.name, item: pageUrl },
      ],
    });
  }

  // Fil d'Ariane aligné sur celui affiché en haut des pages d'atterrissage.
  const landing = LANDINGS[route.path];
  if (landing) {
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${pageUrl}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${base}/` },
        {
          "@type": "ListItem",
          position: 2,
          name: `${landing.h1} ${landing.h1Accent}`.trim(),
          item: pageUrl,
        },
      ],
    });

    graph.push({
      "@type": "Service",
      "@id": `${pageUrl}#service`,
      name: route.title.split("|")[0].trim(),
      description: route.description,
      provider: { "@id": orgId },
      areaServed: places,
      serviceType: landing.eyebrow,
    });
  }

  return (
    <script
      type="application/ld+json"
      // Contenu construit uniquement à partir de constantes du dépôt, aucune
      // donnée utilisateur : pas de vecteur d'injection ici.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
      }}
    />
  );
}
