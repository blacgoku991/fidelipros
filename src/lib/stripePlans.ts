export const STRIPE_PLANS = {
  starter: {
    product_id: "prod_UEuRDMQSWVTnoL",
    price_id: "price_1TGQcwFQlLT8Im0J1OI53niu",
    name: "Starter",
    price: 29,
    features: [
      "Scanner QR code",
      "Cartes de fidélité digitales",
      "Apple Wallet & Google Wallet",
      "Jusqu'à 50 clients",
      "Gestion récompenses",
      "Personnalisation carte",
      "Vitrine publique",
      "Mode hors-ligne (PWA)",
      "Export CSV",
      "Support par email",
    ],
  },
  pro: {
    product_id: "prod_UEuSxVTVVLAifJ",
    price_id: "price_1TGQdDFQlLT8Im0J7YQ9OWuG",
    name: "Pro",
    price: 59,
    popular: true,
    features: [
      "Tout Starter +",
      "Clients illimités",
      "Notifications push ciblées",
      "Campagnes marketing",
      "Automations (relance, anniversaire)",
      "Analytics avancés",
      "Scoring client (Bronze/Silver/Gold)",
      "Gamification (streaks, niveaux)",
      "Notifications de proximité (géofencing)",
      "Avis clients & Google Reviews",
      "Webhooks API",
      "Widget d'inscription",
      "Support prioritaire",
    ],
  },
  franchise: {
    product_id: "prod_FRANCHISE_PLACEHOLDER",
    price_id: "price_FRANCHISE_PLACEHOLDER",
    name: "Franchise",
    price: 149,
    features: [
      "Tout Pro +",
      "Jusqu'à 5 établissements inclus",
      "Dashboard master multi-sites",
      "Comparaison entre points de vente",
      "Managers dédiés par établissement",
      "Carte fidélité unifiée",
      "+29€/établissement supplémentaire",
      "Support dédié",
    ],
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PLANS;

/** Plan limits — enforced in frontend + should be mirrored in RLS/backend */
export const PLAN_LIMITS: Record<string, {
  max_clients: number;
  campaigns: boolean;
  automations: boolean;
  analytics_advanced: boolean;
  scoring: boolean;
  gamification: boolean;
  geofencing: boolean;
  reviews: boolean;
  webhooks: boolean;
  multi_locations: boolean;
}> = {
  starter: {
    max_clients: 50,
    campaigns: false,
    automations: false,
    analytics_advanced: false,
    scoring: false,
    gamification: false,
    geofencing: false,
    reviews: false,
    webhooks: false,
    multi_locations: false,
  },
  pro: {
    max_clients: Infinity,
    campaigns: true,
    automations: true,
    analytics_advanced: true,
    scoring: true,
    gamification: true,
    geofencing: true,
    reviews: true,
    webhooks: true,
    multi_locations: false,
  },
  franchise: {
    max_clients: Infinity,
    campaigns: true,
    automations: true,
    analytics_advanced: true,
    scoring: true,
    gamification: true,
    geofencing: true,
    reviews: true,
    webhooks: true,
    multi_locations: true,
  },
};

export function getPlanLimits(plan: string | null | undefined) {
  return PLAN_LIMITS[plan || "starter"] || PLAN_LIMITS.starter;
}
