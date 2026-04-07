import { QRCodeSVG } from "qrcode.react";

/**
 * Apple Wallet Store Card — Loyaltify-style design.
 * Clean layout: Header → Strip (with stamp overlays) → Member/Reward → QR → Code
 */

export interface PassField {
  key: string;
  label: string;
  value: string;
}

export interface AppleWalletPassProps {
  backgroundColor?: string;
  foregroundColor?: string;
  labelColor?: string;
  logoUrl?: string;
  logoText?: string;
  stripImageUrl?: string;
  headerFields?: PassField[];
  primaryFields?: PassField[];
  secondaryFields?: PassField[];
  auxiliaryFields?: PassField[];
  barcodeValue?: string;
  footerText?: string;
  width?: number;
  children?: React.ReactNode;
  // Stamp-specific
  loyaltyType?: "points" | "stamps" | "cashback" | "subscription";
  currentStamps?: number;
  maxStamps?: number;
}

export function AppleWalletPass({
  backgroundColor = "#6B46C1",
  foregroundColor,
  labelColor,
  logoUrl,
  logoText = "Mon Commerce",
  stripImageUrl,
  headerFields = [],
  primaryFields = [],
  secondaryFields = [],
  auxiliaryFields = [],
  barcodeValue,
  footerText,
  width = 320,
  children,
  loyaltyType = "points",
  currentStamps = 0,
  maxStamps = 10,
}: AppleWalletPassProps) {
  const bgBrightness = hexBrightness(backgroundColor);
  const fg = foregroundColor || (bgBrightness > 160 ? "#1a1a1a" : "#ffffff");
  const lbl = labelColor || (bgBrightness > 160 ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.55)");
  const s = width / 320;

  const CARD_HEIGHT = Math.round(480 * s);
  const STRIP_HEIGHT = Math.round(130 * s);
  const isStamps = loyaltyType === "stamps";

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${CARD_HEIGHT}px`,
        borderRadius: `${14 * s}px`,
        background: backgroundColor,
        overflow: "hidden",
        position: "relative",
        boxShadow: `0 ${8 * s}px ${32 * s}px -${6 * s}px rgba(0,0,0,0.35)`,
        fontFamily: "-apple-system, 'SF Pro Text', 'Helvetica Neue', sans-serif",
        userSelect: "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── HEADER ROW ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${12 * s}px ${16 * s}px ${8 * s}px`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: `${8 * s}px`, minWidth: 0 }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={logoText}
              style={{
                width: `${29 * s}px`,
                height: `${29 * s}px`,
                borderRadius: `${6 * s}px`,
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: `${29 * s}px`,
                height: `${29 * s}px`,
                borderRadius: `${6 * s}px`,
                background: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: fg,
                fontWeight: 700,
                fontSize: `${12 * s}px`,
                flexShrink: 0,
              }}
            >
              {(logoText || "?")[0].toUpperCase()}
            </div>
          )}
          <span
            style={{
              color: fg,
              fontWeight: 700,
              fontSize: `${14 * s}px`,
              letterSpacing: "-0.01em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {logoText}
          </span>
        </div>

        {headerFields.length > 0 && (
          <div style={{ display: "flex", gap: `${12 * s}px`, flexShrink: 0 }}>
            {headerFields.map((f) => (
              <div key={f.key} style={{ textAlign: "right" }}>
                <p style={{ color: lbl, fontSize: `${7 * s}px`, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.2, marginBottom: `${1 * s}px` }}>{f.label}</p>
                <p style={{ color: fg, fontSize: `${20 * s}px`, fontWeight: 700, lineHeight: 1.1 }}>{f.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── STRIP IMAGE with stamp overlays ── */}
      <div style={{ width: "100%", height: `${STRIP_HEIGHT}px`, overflow: "hidden", flexShrink: 0, position: "relative" }}>
        {stripImageUrl ? (
          <img
            src={stripImageUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${adjustBrightness(backgroundColor, 20)}, ${adjustBrightness(backgroundColor, -20)})` }} />
        )}

        {/* Stamp overlay grid for stamps type */}
        {isStamps && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexWrap: "wrap",
              alignContent: "center",
              justifyContent: "center",
              gap: `${6 * s}px`,
              padding: `${8 * s}px ${12 * s}px`,
            }}
          >
            {Array.from({ length: maxStamps }).map((_, i) => {
              const filled = i < currentStamps;
              return (
                <div
                  key={i}
                  style={{
                    width: `${24 * s}px`,
                    height: `${24 * s}px`,
                    borderRadius: "50%",
                    background: filled ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.25)",
                    border: `${1.5 * s}px solid rgba(255,255,255,0.6)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: `${12 * s}px`,
                    backdropFilter: "blur(4px)",
                    boxShadow: filled ? `0 ${2 * s}px ${6 * s}px rgba(0,0,0,0.2)` : "none",
                  }}
                >
                  {filled ? "✓" : ""}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MEMBER + REWARD/TIER — simplified Loyaltify-style ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 0 }}>
        <div>
          {secondaryFields.length > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: `${10 * s}px ${16 * s}px ${6 * s}px`,
              }}
            >
              {secondaryFields.map((f, i) => (
                <div key={f.key} style={{ textAlign: i === 0 ? "left" : "right", flex: i === 0 ? 1 : undefined }}>
                  <p style={{ color: lbl, fontSize: `${7 * s}px`, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.2, marginBottom: `${2 * s}px` }}>{f.label}</p>
                  <p style={{ color: fg, fontSize: `${14 * s}px`, fontWeight: 700, lineHeight: 1.15 }}>{f.value}</p>
                </div>
              ))}
            </div>
          )}
          {children}
        </div>

        {/* ── BARCODE ── */}
        {barcodeValue && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: `${6 * s}px 0 ${10 * s}px`,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: `${8 * s}px`,
                padding: `${5 * s}px`,
              }}
            >
              <QRCodeSVG
                value={barcodeValue}
                size={Math.round(72 * s)}
                bgColor="#ffffff"
                fgColor="#1a1a1a"
                level="M"
              />
            </div>
            {footerText && (
              <p
                style={{
                  color: lbl,
                  fontSize: `${9 * s}px`,
                  fontFamily: "'SF Mono', 'Menlo', monospace",
                  letterSpacing: "0.05em",
                  marginTop: `${4 * s}px`,
                }}
              >
                {footerText}
              </p>
            )}
            <p
              style={{
                color: lbl,
                fontSize: `${7 * s}px`,
                letterSpacing: "0.04em",
                marginTop: `${3 * s}px`,
                opacity: 0.7,
              }}
            >
              Proposé par{" "}
              <span style={{ fontWeight: 600 }}>fidélipro.com</span>
            </p>
          </div>
        )}

        {!barcodeValue && <div style={{ height: `${14 * s}px` }} />}
      </div>

      {/* Apple-style top highlight */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function hexBrightness(hex: string): number {
  const c = hex.replace("#", "");
  if (c.length !== 6) return 128;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function adjustBrightness(hex: string, amount: number): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return hex;
  const r = Math.min(255, Math.max(0, parseInt(c.slice(0, 2), 16) + amount));
  const g = Math.min(255, Math.max(0, parseInt(c.slice(2, 4), 16) + amount));
  const b = Math.min(255, Math.max(0, parseInt(c.slice(4, 6), 16) + amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
