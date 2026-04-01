import { QRCodeSVG } from "qrcode.react";

/**
 * Apple Wallet Store Card — pixel-perfect PassKit replica.
 * FIXED HEIGHT: all card types use the same dimensions.
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
}: AppleWalletPassProps) {
  const bgBrightness = hexBrightness(backgroundColor);
  const fg = foregroundColor || (bgBrightness > 160 ? "#1a1a1a" : "#ffffff");
  const lbl = labelColor || (bgBrightness > 160 ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.55)");
  const s = width / 320;

  // FIXED card height — same for all loyalty types
  const CARD_HEIGHT = Math.round(440 * s);

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
                <FieldLabel s={s} color={lbl}>{f.label}</FieldLabel>
                <FieldValue s={s} color={fg} size={18}>{f.value}</FieldValue>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── STRIP IMAGE ── */}
      {stripImageUrl && (
        <div style={{ width: "100%", height: `${Math.round(100 * s)}px`, overflow: "hidden", flexShrink: 0 }}>
          <img
            src={stripImageUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      )}

      {/* ── FIELDS AREA — flex-grow to fill remaining space ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 0 }}>
        <div>
          {primaryFields.length > 0 && (
            <FieldRow fields={primaryFields} s={s} fg={fg} lbl={lbl} valueFontSize={16} padTop={10} padBottom={2} />
          )}
          {secondaryFields.length > 0 && (
            <FieldRow fields={secondaryFields} s={s} fg={fg} lbl={lbl} valueFontSize={13} padTop={6} padBottom={2} />
          )}
          {auxiliaryFields.length > 0 && (
            <FieldRow fields={auxiliaryFields} s={s} fg={fg} lbl={lbl} valueFontSize={12} padTop={4} padBottom={4} />
          )}
          {children}
        </div>

        {/* ── BARCODE — always anchored at bottom ── */}
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
                  fontSize: `${8 * s}px`,
                  fontFamily: "'SF Mono', 'Menlo', monospace",
                  letterSpacing: "0.05em",
                  marginTop: `${3 * s}px`,
                }}
              >
                {footerText}
              </p>
            )}
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

/* ── Shared sub-components ── */

function FieldLabel({ children, s, color }: { children: React.ReactNode; s: number; color: string }) {
  return (
    <p
      style={{
        color,
        fontSize: `${8 * s}px`,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        lineHeight: 1.2,
        marginBottom: `${1 * s}px`,
      }}
    >
      {children}
    </p>
  );
}

function FieldValue({ children, s, color, size }: { children: React.ReactNode; s: number; color: string; size: number }) {
  return (
    <p
      style={{
        color,
        fontSize: `${size * s}px`,
        fontWeight: 700,
        lineHeight: 1.15,
      }}
    >
      {children}
    </p>
  );
}

function FieldRow({
  fields, s, fg, lbl, valueFontSize, padTop, padBottom,
}: {
  fields: PassField[]; s: number; fg: string; lbl: string;
  valueFontSize: number; padTop: number; padBottom: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: `${padTop * s}px ${16 * s}px ${padBottom * s}px`,
      }}
    >
      {fields.map((f, i) => (
        <div key={f.key} style={{ textAlign: i === 0 ? "left" : "right", flex: i === 0 ? 1 : undefined }}>
          <FieldLabel s={s} color={lbl}>{f.label}</FieldLabel>
          <FieldValue s={s} color={fg} size={valueFontSize}>{f.value}</FieldValue>
        </div>
      ))}
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
