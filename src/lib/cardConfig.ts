/**
 * Unified Card Configuration — Single Source of Truth
 * 
 * This module centralizes all card configuration into one normalized structure.
 * Every preview, public page, and pass generator MUST use this config.
 */

import type { PassField } from "@/components/AppleWalletPass";

// ─── Unified Config Type ─────────────────────────────────────────────────

export type LoyaltyType = "points" | "stamps" | "cashback" | "subscription";

export interface UnifiedCardConfig {
  // Identity
  businessId: string;
  businessName: string;
  logoUrl: string | null;
  stripImageUrl: string | null;

  // Loyalty settings
  loyaltyType: LoyaltyType;
  maxPoints: number;
  pointsPerVisit: number;
  pointsPerEuro: number;
  rewardDescription: string;

  // Colors
  backgroundColor: string;
  foregroundColor: string | null;
  labelColor: string | null;

  // Visible fields
  showCustomerName: boolean;
  showQrCode: boolean;
  showPoints: boolean;
  showExpiration: boolean;
  showRewardsPreview: boolean;

  // Card design
  cardStyle: string;
  cardBgType: string;
}

// ─── Customer Data for rendering ─────────────────────────────────────────

export interface CardCustomerData {
  fullName: string;
  currentPoints: number;
  maxPoints: number;
  level: string;
  totalVisits: number;
  currentStreak: number;
  rewardsEarned: number;
  cardCode: string;
}

// ─── Build config from business DB record ────────────────────────────────

export function buildCardConfig(business: any): UnifiedCardConfig {
  return {
    businessId: business.id,
    businessName: business.name || "Mon Commerce",
    logoUrl: business.logo_url || null,
    stripImageUrl: business.card_bg_image_url || null,
    loyaltyType: normalizeLoyaltyType(business.loyalty_type),
    maxPoints: business.max_points_per_card || 10,
    pointsPerVisit: business.points_per_visit || 1,
    pointsPerEuro: business.points_per_euro || 0,
    rewardDescription: business.reward_description || "Récompense offerte !",
    backgroundColor: business.primary_color || "#6B46C1",
    foregroundColor: business.foreground_color || null,
    labelColor: business.label_color || null,
    showCustomerName: business.show_customer_name ?? true,
    showQrCode: business.show_qr_code ?? true,
    showPoints: business.show_points ?? true,
    showExpiration: business.show_expiration ?? false,
    showRewardsPreview: business.show_rewards_preview ?? true,
    cardStyle: business.card_style || "classic",
    cardBgType: business.card_bg_type || "gradient",
  };
}

function normalizeLoyaltyType(raw: string | null | undefined): LoyaltyType {
  if (raw === "stamps" || raw === "cashback" || raw === "subscription") return raw;
  return "points";
}

// ─── Loyalty-type-aware labels ───────────────────────────────────────────

export function getLoyaltyLabels(type: LoyaltyType) {
  switch (type) {
    case "stamps":
      return {
        pointsLabel: "TAMPONS",
        progressLabel: "PROGRESSION",
        unitSingular: "tampon",
        unitPlural: "tampons",
        perAction: "tampon par visite",
        headerLabel: "Tampons",
      };
    case "cashback":
      return {
        pointsLabel: "CAGNOTTE",
        progressLabel: "SOLDE",
        unitSingular: "€",
        unitPlural: "€",
        perAction: "% de cashback",
        headerLabel: "Cagnotte",
      };
    case "subscription":
      return {
        pointsLabel: "PLAN",
        progressLabel: "STATUT",
        unitSingular: "",
        unitPlural: "",
        perAction: "",
        headerLabel: "Plan",
      };
    default:
      return {
        pointsLabel: "POINTS",
        progressLabel: "OBJECTIF",
        unitSingular: "point",
        unitPlural: "points",
        perAction: "point par visite",
        headerLabel: "Points",
      };
  }
}

// ─── Apple Wallet PassKit field mapping — Loyaltify-style simplified ─────

export function buildApplePassFields(
  config: UnifiedCardConfig,
  customer: CardCustomerData,
): {
  headerFields: PassField[];
  primaryFields: PassField[];
  secondaryFields: PassField[];
  auxiliaryFields: PassField[];
} {
  const labels = getLoyaltyLabels(config.loyaltyType);

  // ── Header: top-right — count
  const headerFields: PassField[] = [];
  if (config.showPoints) {
    headerFields.push({
      key: "points",
      label: labels.headerLabel,
      value: config.loyaltyType === "cashback"
        ? `${customer.currentPoints},00 €`
        : config.loyaltyType === "subscription"
          ? "Premium ✓"
          : String(customer.currentPoints),
    });
  }

  // ── Primary: not used in Loyaltify-style (kept empty)
  const primaryFields: PassField[] = [];

  // ── Secondary: MEMBER name + REWARD count (clean 2-field layout)
  const secondaryFields: PassField[] = [];
  if (config.showCustomerName) {
    secondaryFields.push({
      key: "member",
      label: "MEMBRE",
      value: customer.fullName || "Client",
    });
  }
  secondaryFields.push({
    key: "reward",
    label: "RÉCOMPENSE",
    value: String(customer.rewardsEarned),
  });

  // ── Auxiliary: empty for clean design
  const auxiliaryFields: PassField[] = [];

  return { headerFields, primaryFields, secondaryFields, auxiliaryFields };
}

// ─── Build demo/preview customer data ────────────────────────────────────

export function buildDemoCustomer(config: UnifiedCardConfig, overrides?: Partial<CardCustomerData>): CardCustomerData {
  return {
    fullName: "Marie Dupont",
    currentPoints: 7,
    maxPoints: config.maxPoints,
    level: "gold",
    totalVisits: 7,
    currentStreak: 3,
    rewardsEarned: 1,
    cardCode: "preview-demo",
    ...overrides,
  };
}

// ─── Build customer data from real DB records ────────────────────────────

export function buildCustomerData(card: any, customer: any): CardCustomerData {
  return {
    fullName: customer?.full_name || "Client",
    currentPoints: card.current_points || 0,
    maxPoints: card.max_points || 10,
    level: customer?.level || "bronze",
    totalVisits: customer?.total_visits || 0,
    currentStreak: customer?.current_streak || 0,
    rewardsEarned: card.rewards_earned || 0,
    cardCode: card.card_code || card.id,
  };
}

// ─── Progress helpers ────────────────────────────────────────────────────

export function getProgressInfo(config: UnifiedCardConfig, customer: CardCustomerData) {
  const labels = getLoyaltyLabels(config.loyaltyType);
  const remaining = Math.max(0, customer.maxPoints - customer.currentPoints);
  const progress = Math.min((customer.currentPoints / customer.maxPoints) * 100, 100);
  const isComplete = remaining === 0;

  return {
    remaining,
    progress,
    isComplete,
    remainingText: remaining > 0
      ? `Plus que ${remaining} ${remaining > 1 ? labels.unitPlural : labels.unitSingular} !`
      : "Récompense disponible ! 🎉",
  };
}

// ─── Apple PassKit JSON mapping (for edge function) — Loyaltify-style ────

export function buildApplePassJson(
  config: UnifiedCardConfig,
  customer: CardCustomerData,
) {
  const labels = getLoyaltyLabels(config.loyaltyType);

  return {
    headerFields: [
      {
        key: "points",
        label: labels.pointsLabel,
        value: config.loyaltyType === "cashback"
          ? `${customer.currentPoints},00 €`
          : customer.currentPoints,
        textAlignment: "PKTextAlignmentRight",
        changeMessage: config.loyaltyType === "stamps"
          ? `%@ ${labels.unitPlural} !`
          : config.loyaltyType === "cashback"
            ? "%@ de cagnotte !"
            : "%@ points !",
      },
    ],
    primaryFields: [],
    secondaryFields: [
      {
        key: "member",
        label: "MEMBRE",
        value: customer.fullName || "Client",
      },
      {
        key: "reward",
        label: "RÉCOMPENSE",
        value: `${customer.rewardsEarned}`,
        textAlignment: "PKTextAlignmentRight",
      },
    ],
    auxiliaryFields: [],
  };
}

// ─── Google Wallet object mapping ────────────────────────────────────────

export function buildGoogleLoyaltyFields(config: UnifiedCardConfig, customer: CardCustomerData) {
  const labels = getLoyaltyLabels(config.loyaltyType);

  return {
    loyaltyPoints: {
      balance: config.loyaltyType === "cashback"
        ? { money: { micros: (customer.currentPoints * 1000000).toString(), currencyCode: "EUR" } }
        : { int: customer.currentPoints },
      label: labels.headerLabel,
    },
    programName: `Fidélité ${config.businessName}`,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
