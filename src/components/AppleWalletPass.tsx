import { QRCodeSVG } from "qrcode.react";

/**
 * Apple Wallet PassKit-faithful loyalty card preview.
 *
 * Layout hierarchy follows the PassKit spec:
 *   ┌──────────────────────────────┐
 *   │  HEADER  (logo + logoText)   │  ← headerFields (right-aligned values)
 *   │  STRIP IMAGE (optional)      │
 *   │  PRIMARY FIELDS              │  ← member name
 *   │  SECONDARY FIELDS            │  ← points / balance
 *   │  AUXILIARY FIELDS            │  ← tier / status
 *   │  BARCODE / QR                │
 *   │  FOOTER                      │
 *   └──────────────────────────────┘
 */

export interface AppleWalletPassProps {
  // Pass colors (hex)
  backgroundColor?: string;
  foregroundColor?: string;
  labelColor?: string;

  // Header
  logoUrl?: string;
  logoText?: string; // company name next to logo

  // Strip image (banner between header and fields)
  stripImageUrl?: string;

  // headerFields (top-right, e.g. points counter)
  headerFields?: PassField[];

  // primaryFields (large, prominent)
  primaryFields?: PassField[];

  // secondaryFields
  secondaryFields?: PassField[];

  // auxiliaryFields
  auxiliaryFields?: PassField[];

  // backFields (not rendered visually, just data)

  // Barcode
  barcodeValue?: string;
  barcodeFormat?: "QR" | "PDF417" | "CODE128";

  // Footer text (e.g. card code)
  footerText?: string;

  // Promo / change message
  promoText?: string;

  // Size
  width?: number;
}

export interface PassField {
  key: string;
  label: string;
  value: string;
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
  barcodeFormat = "QR",
  footerText,
  promoText,
  width = 320,
}: AppleWalletPassProps) {
  // Auto-detect text colors from background brightness if not provided
  const bgBrightness = hexBrightness(backgroundColor);
  const fgColor = foregroundColor || (bgBrightness > 160 ? "#1a1a1a" : "#ffffff");
  const lblColor = labelColor || (bgBrightness > 160 ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.55)");

  const scale = width / 320;

  return (
    <div
      className="relative overflow-hidden select-none"
      style={{
        width: `${width}px`,
        borderRadius: `${14 * scale}px`,
        background: backgroundColor,
        boxShadow: `0 ${10 * scale}px ${40 * scale}px -${8 * scale}px rgba(0,0,0,0.35), 0 ${2 * scale}px ${8 * scale}px rgba(0,0,0,0.15)`,
        fontFamily: "-apple-system, 'SF Pro Text', 'Helvetica Neue', sans-serif",
      }}
    >
      {/* ── HEADER ROW: logo + logoText + headerFields ── */}
      <div
        className="flex items-center justify-between"
        style={{ padding: `${12 * scale}px ${14 * scale}px ${6 * scale}px` }}
      >
        <div className="flex items-center gap-2 min-w-0" style={{ gap: `${8 * scale}px` }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={logoText}
              style={{
                width: `${29 * scale}px`,
                height: `${29 * scale}px`,
                borderRadius: `${6 * scale}px`,
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: `${29 * scale}px`,
                height: `${29 * scale}px`,
                borderRadius: `${6 * scale}px`,
                background: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: fgColor,
                fontWeight: 700,
                fontSize: `${11 * scale}px`,
              }}
            >
              {(logoText || "?")[0].toUpperCase()}
            </div>
          )}
          <span
            style={{
              color: fgColor,
              fontWeight: 700,
              fontSize: `${14 * scale}px`,
              letterSpacing: "-0.01em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {logoText}
          </span>
        </div>

        {/* Header fields (right side) */}
        {headerFields.length > 0 && (
          <div className="flex gap-3 shrink-0" style={{ gap: `${10 * scale}px` }}>
            {headerFields.map((f) => (
              <div key={f.key} style={{ textAlign: "right" }}>
                <p
                  style={{
                    color: lblColor,
                    fontSize: `${7 * scale}px`,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    lineHeight: 1.2,
                  }}
                >
                  {f.label}
                </p>
                <p
                  style={{
                    color: fgColor,
                    fontSize: `${18 * scale}px`,
                    fontWeight: 700,
                    lineHeight: 1.1,
                  }}
                >
                  {f.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── STRIP IMAGE ── */}
      {stripImageUrl && (
        <div
          style={{
            margin: `0 ${10 * scale}px`,
            borderRadius: `${8 * scale}px`,
            overflow: "hidden",
            aspectRatio: "3.2 / 1",
          }}
        >
          <img
            src={stripImageUrl}
            alt="Banner"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      {/* ── PRIMARY FIELDS ── */}
      {primaryFields.length > 0 && (
        <div
          className="flex justify-between"
          style={{ padding: `${10 * scale}px ${14 * scale}px ${2 * scale}px` }}
        >
          {primaryFields.map((f, i) => (
            <div key={f.key} style={{ textAlign: i === 0 ? "left" : "right", flex: i === 0 ? 1 : undefined }}>
              <p
                style={{
                  color: lblColor,
                  fontSize: `${7 * scale}px`,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: `${1 * scale}px`,
                }}
              >
                {f.label}
              </p>
              <p
                style={{
                  color: fgColor,
                  fontSize: `${15 * scale}px`,
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {f.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── SECONDARY FIELDS ── */}
      {secondaryFields.length > 0 && (
        <div
          className="flex justify-between"
          style={{ padding: `${6 * scale}px ${14 * scale}px ${2 * scale}px` }}
        >
          {secondaryFields.map((f, i) => (
            <div key={f.key} style={{ textAlign: i === 0 ? "left" : "right", flex: i === 0 ? 1 : undefined }}>
              <p
                style={{
                  color: lblColor,
                  fontSize: `${7 * scale}px`,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: `${1 * scale}px`,
                }}
              >
                {f.label}
              </p>
              <p
                style={{
                  color: fgColor,
                  fontSize: `${13 * scale}px`,
                  fontWeight: 600,
                }}
              >
                {f.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── AUXILIARY FIELDS ── */}
      {auxiliaryFields.length > 0 && (
        <div
          className="flex justify-between"
          style={{ padding: `${4 * scale}px ${14 * scale}px ${6 * scale}px` }}
        >
          {auxiliaryFields.map((f, i) => (
            <div key={f.key} style={{ textAlign: i === 0 ? "left" : "right", flex: i === 0 ? 1 : undefined }}>
              <p
                style={{
                  color: lblColor,
                  fontSize: `${7 * scale}px`,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: `${1 * scale}px`,
                }}
              >
                {f.label}
              </p>
              <p
                style={{
                  color: fgColor,
                  fontSize: `${12 * scale}px`,
                  fontWeight: 600,
                }}
              >
                {f.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── PROMO TEXT ── */}
      {promoText && (
        <div
          style={{
            margin: `${2 * scale}px ${12 * scale}px ${4 * scale}px`,
            padding: `${6 * scale}px ${10 * scale}px`,
            borderRadius: `${6 * scale}px`,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.08)",
            textAlign: "center",
          }}
        >
          <p style={{ color: fgColor, fontSize: `${10 * scale}px`, fontWeight: 600 }}>
            {promoText}
          </p>
        </div>
      )}

      {/* ── BARCODE / QR ── */}
      {barcodeValue && (
        <div
          className="flex flex-col items-center"
          style={{ padding: `${10 * scale}px 0 ${8 * scale}px` }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: `${8 * scale}px`,
              padding: `${6 * scale}px`,
              boxShadow: `0 ${1 * scale}px ${4 * scale}px rgba(0,0,0,0.1)`,
            }}
          >
            <QRCodeSVG
              value={barcodeValue}
              size={Math.round(90 * scale)}
              bgColor="#ffffff"
              fgColor="#1a1a1a"
              level="M"
            />
          </div>
          {footerText && (
            <p
              style={{
                color: lblColor,
                fontSize: `${9 * scale}px`,
                fontFamily: "monospace",
                letterSpacing: "0.05em",
                marginTop: `${5 * scale}px`,
              }}
            >
              {footerText}
            </p>
          )}
        </div>
      )}

      {/* If no barcode, add bottom padding */}
      {!barcodeValue && <div style={{ height: `${12 * scale}px` }} />}

      {/* ── Subtle top highlight (Apple-style) ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function hexBrightness(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 128;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}
