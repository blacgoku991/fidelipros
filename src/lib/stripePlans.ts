export const STRIPE_PLANS = {
  starter: {
    product_id: "prod_UEuRDMQSWVTnoL",
    price_id: "price_1TGQcwFQlLT8Im0J1OI53niu",
    name: "Starter",
    price: 29,
    features: [
      "Scanner QR",
      "Gestion clients",
      "Cartes de fidélité",
      "Récompenses",
      "Jusqu'à 200 clients",
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
      "Analytics avancés",
      "Notifications push",
      "Apple Wallet",
      "Scoring client",
      "Campagnes marketing",
      "Clients illimités",
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
      "Dashboard multi-sites",
      "Comparaison entre points de vente",
      "Managers par établissement",
      "Carte fidélité unifiée",
      "+29€/établissement supplémentaire",
    ],
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PLANS;
