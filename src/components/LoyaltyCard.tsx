import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

interface LoyaltyCardProps {
  businessName: string;
  customerName: string;
  points: number;
  maxPoints: number;
  level: "bronze" | "silver" | "gold";
  cardId: string;
  logoUrl?: string;
  accentColor?: string;
  secondaryColor?: string;
  rewardDescription?: string;
  rewardsEarned?: number;
  promoText?: string;
  showQr?: boolean;
  showPoints?: boolean;
  showCustomerName?: boolean;
  showExpiration?: boolean;
  showRewardsPreview?: boolean;
  cardStyle?: string;
  cardBgType?: string;
  cardBgImageUrl?: string;
  loyaltyType?: string;
}

const levelLabels: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

export function LoyaltyCard({
  businessName,
  customerName,
  points,
  maxPoints,
  level,
  cardId,
  logoUrl,
  accentColor,
  secondaryColor,
  rewardDescription,
  rewardsEarned = 0,
  promoText,
  showQr = true,
  showPoints = true,
  showCustomerName = true,
  showExpiration = false,
  showRewardsPreview = true,
  cardStyle = "classic",
  cardBgType = "gradient",
  cardBgImageUrl,
  loyaltyType = "points",
}: LoyaltyCardProps) {
  const primaryColor = accentColor || "#6B46C1";
  const secondary = secondaryColor || darken(primaryColor, 30);
  const hasStripImage = cardBgType === "image" && !!cardBgImageUrl;
  const isStamps = loyaltyType === "stamps";

  const bgBrightness = hexBrightness(primaryColor);
  const textOnBg = bgBrightness > 160 ? "#1a1a1a" : "#ffffff";
  const textMuted = bgBrightness > 160 ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.6)";

  const cardBg = `linear-gradient(135deg, ${primaryColor}, ${secondary})`;
  const unitLabel = isStamps ? "TAMPONS" : loyaltyType === "cashback" ? "CAGNOTTE" : "POINTS";

  return (
    <motion.div
      className="relative w-full max-w-[380px] rounded-2xl overflow-hidden cursor-pointer select-none"
      style={{
        background: cardBg,
        boxShadow: "0 16px 48px -8px rgba(0,0,0,0.35), 0 4px 16px -4px rgba(0,0,0,0.2)",
        transformStyle: "preserve-3d",
      }}
      whileHover={{ scale: 1.02, rotateY: 2, rotateX: -1 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
    >
      {/* ── HEADER: Logo + Business Name + Points ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {logoUrl ? (
            <div className="w-9 h-9 rounded-lg overflow-hidden border border-white/20 shrink-0 bg-white/10">
              <img src={logoUrl} alt={businessName} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div
              className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center border border-white/20"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <span style={{ color: textOnBg }} className="font-bold text-sm">
                {(businessName || "?")[0].toUpperCase()}
              </span>
            </div>
          )}
          <span className="font-bold text-sm tracking-tight truncate" style={{ color: textOnBg }}>
            {businessName}
          </span>
        </div>
        {showPoints && (
          <div className="text-right shrink-0">
            <p className="text-[8px] uppercase tracking-widest font-semibold" style={{ color: textMuted }}>
              {unitLabel}
            </p>
            <p className="text-xl font-bold leading-none" style={{ color: textOnBg }}>
              {loyaltyType === "cashback" ? `${points}€` : points}
            </p>
          </div>
        )}
      </div>

      {/* ── STRIP IMAGE with stamp overlays ── */}
      <div className="relative mx-0 overflow-hidden" style={{ aspectRatio: "3 / 1" }}>
        {hasStripImage ? (
          <img src={cardBgImageUrl} alt="Card banner" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${lighten(primaryColor, 15)}, ${darken(primaryColor, 25)})`,
              opacity: 0.6,
            }}
          />
        )}

        {/* Stamp circles overlay */}
        {isStamps && (
          <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-2 p-3">
            {Array.from({ length: maxPoints }).map((_, i) => {
              const filled = i < points;
              return (
                <div
                  key={i}
                  className="flex items-center justify-center"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: filled ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.2)",
                    border: "1.5px solid rgba(255,255,255,0.5)",
                    boxShadow: filled ? "0 2px 6px rgba(0,0,0,0.2)" : "none",
                    fontSize: 14,
                    backdropFilter: "blur(4px)",
                  }}
                >
                  {filled ? "✓" : ""}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MEMBER + REWARD — Loyaltify-style ── */}
      <div className="px-4 pt-3 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[8px] uppercase tracking-widest font-semibold" style={{ color: textMuted }}>
            MEMBRE
          </p>
          {showCustomerName && (
            <p className="text-base font-bold truncate" style={{ color: textOnBg }}>
              {customerName || "Client"}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[8px] uppercase tracking-widest font-semibold" style={{ color: textMuted }}>
            RÉCOMPENSE
          </p>
          <p className="text-base font-bold" style={{ color: textOnBg }}>
            {rewardsEarned}
          </p>
        </div>
      </div>

      {/* ── QR CODE + CARD CODE ── */}
      {showQr && cardId && (
        <div className="flex flex-col items-center py-4 gap-2">
          <div className="rounded-xl p-2" style={{ background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
            <QRCodeSVG value={cardId} size={100} bgColor="#ffffff" fgColor="#1a1a1a" level="M" />
          </div>
          <span className="text-xs font-mono tracking-wider" style={{ color: textMuted }}>
            {cardId.length > 12 ? cardId.slice(0, 12) : cardId}
          </span>
        </div>
      )}

      {(!showQr || !cardId) && <div className="pb-4" />}

      {/* Subtle top highlight */}
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)" }}
      />
    </motion.div>
  );
}

function darken(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = Math.max(0, parseInt(clean.slice(0, 2), 16) - amount);
  const g = Math.max(0, parseInt(clean.slice(2, 4), 16) - amount);
  const b = Math.max(0, parseInt(clean.slice(4, 6), 16) - amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function lighten(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = Math.min(255, parseInt(clean.slice(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(clean.slice(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(clean.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function hexBrightness(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 128;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}
