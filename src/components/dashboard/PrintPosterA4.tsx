import { QRCodeSVG } from "qrcode.react";

export type QrPrintVariant = "minimal" | "impact" | "luxe";

interface PrintPosterA4Props {
  variant: QrPrintVariant;
  businessName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  publicUrl: string;
  promoText?: string;
}

const A4_WIDTH = "210mm";
const A4_HEIGHT = "297mm";

function getContrastColor(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#000000" : "#ffffff";
}

const basePosterStyle: React.CSSProperties = {
  width: A4_WIDTH,
  height: A4_HEIGHT,
  boxSizing: "border-box",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  justifyContent: "space-between",
  padding: "16mm 14mm 14mm",
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
  breakInside: "avoid",
  pageBreakInside: "avoid",
};

const centerColumnStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
};

export function PrintPosterA4({
  variant,
  businessName,
  logoUrl,
  primaryColor,
  secondaryColor,
  publicUrl,
  promoText,
}: PrintPosterA4Props) {
  const fg = getContrastColor(primaryColor);
  const fgSub = fg === "#ffffff" ? "rgba(255,255,255,0.76)" : "rgba(0,0,0,0.62)";

  if (variant === "minimal") {
    return (
      <div style={{ ...basePosterStyle, background: "#ffffff" }}>
        <div style={{ ...centerColumnStyle, gap: "10mm" }}>
          <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", padding: "6mm 5mm", borderRadius: "6mm", background: primaryColor }}>
            {logoUrl && <img src={logoUrl} alt={businessName} style={{ width: "16mm", height: "16mm", borderRadius: "4mm", objectFit: "cover", flexShrink: 0 }} />}
            <span style={{ color: fg, fontSize: "24px", fontWeight: 700, letterSpacing: "-0.4px", lineHeight: 1.1, wordBreak: "break-word" }}>{businessName}</span>
          </div>

          <div style={{ ...centerColumnStyle, gap: "3mm" }}>
            <p style={{ margin: 0, color: "#111111", fontSize: "30px", fontWeight: 800, lineHeight: 1.15 }}>Rejoignez notre programme fidélité</p>
            <p style={{ margin: 0, color: "#5f5f5f", fontSize: "16px", lineHeight: 1.35 }}>{promoText || "Simple, rapide, gratuit"}</p>
          </div>
        </div>

        <div style={{ ...centerColumnStyle, flex: 1, justifyContent: "center", gap: "7mm" }}>
          <div style={{ background: "#ffffff", border: `2.5mm solid ${primaryColor}22`, borderRadius: "8mm", padding: "8mm", boxSizing: "border-box" }}>
            <QRCodeSVG value={publicUrl} size={380} level="H" includeMargin fgColor="#000000" />
          </div>
          <p style={{ margin: 0, color: "#404040", fontSize: "15px", fontWeight: 600 }}>Scannez pour ajouter votre carte fidélité</p>
        </div>

        <div style={{ ...centerColumnStyle, gap: "2mm" }}>
          <p style={{ margin: 0, color: "#6b6b6b", fontSize: "11px" }}>Compatible Apple Wallet & Google Wallet</p>
          <p style={{ margin: 0, color: "#8a8a8a", fontSize: "10px", maxWidth: "150mm", wordBreak: "break-all" }}>{publicUrl}</p>
        </div>
      </div>
    );
  }

  if (variant === "luxe") {
    return (
      <div style={{ ...basePosterStyle, background: "#0a0a0a" }}>
        <div style={{ ...centerColumnStyle, gap: "8mm" }}>
          {logoUrl && <img src={logoUrl} alt={businessName} style={{ width: "18mm", height: "18mm", borderRadius: "4mm", objectFit: "cover", flexShrink: 0 }} />}
          <div style={{ ...centerColumnStyle, gap: "3mm" }}>
            <p style={{ margin: 0, color: "#ffffff", fontSize: "22px", fontWeight: 300, letterSpacing: "3px", textTransform: "uppercase", lineHeight: 1.15, wordBreak: "break-word" }}>{businessName}</p>
            <div style={{ width: "40mm", height: "1px", background: `linear-gradient(90deg, transparent, ${primaryColor}, transparent)` }} />
          </div>
        </div>

        <div style={{ ...centerColumnStyle, flex: 1, justifyContent: "center", gap: "7mm" }}>
          <div style={{ ...centerColumnStyle, gap: "2.5mm" }}>
            <p style={{ margin: 0, color: "#cfcfcf", fontSize: "17px", fontWeight: 300, letterSpacing: "2px", textTransform: "uppercase" }}>Programme fidélité</p>
            <p style={{ margin: 0, color: "#999999", fontSize: "13px" }}>{promoText || "Scannez pour rejoindre"}</p>
          </div>

          <div style={{ background: "#ffffff", borderRadius: "6mm", padding: "8mm", boxSizing: "border-box" }}>
            <QRCodeSVG value={publicUrl} size={370} level="H" includeMargin fgColor="#0a0a0a" />
          </div>
        </div>

        <div style={{ ...centerColumnStyle, gap: "2mm" }}>
          <p style={{ margin: 0, color: "#7e7e7e", fontSize: "11px", letterSpacing: "1px" }}>Apple Wallet & Google Wallet</p>
          <p style={{ margin: 0, color: "#585858", fontSize: "10px", maxWidth: "150mm", wordBreak: "break-all" }}>{publicUrl}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...basePosterStyle, background: `linear-gradient(180deg, ${primaryColor} 0%, ${secondaryColor || primaryColor} 100%)` }}>
      <div style={{ ...centerColumnStyle, gap: "7mm" }}>
        {logoUrl && <img src={logoUrl} alt={businessName} style={{ width: "18mm", height: "18mm", borderRadius: "5mm", objectFit: "cover", boxShadow: "0 4px 20px rgba(0,0,0,0.22)", flexShrink: 0 }} />}
        <div style={{ ...centerColumnStyle, gap: "3mm" }}>
          <p style={{ margin: 0, color: fg, fontSize: "28px", fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1.1, wordBreak: "break-word" }}>{businessName}</p>
          <p style={{ margin: 0, color: fg, fontSize: "34px", fontWeight: 800, lineHeight: 1.1 }}>🎁 Scannez pour rejoindre</p>
          <p style={{ margin: 0, color: fg, fontSize: "34px", fontWeight: 800, lineHeight: 1.1 }}>notre programme fidélité</p>
          <p style={{ margin: 0, color: fgSub, fontSize: "16px", lineHeight: 1.35 }}>{promoText || "Cumulez vos récompenses dès maintenant"}</p>
        </div>
      </div>

      <div style={{ ...centerColumnStyle, flex: 1, justifyContent: "center", gap: "7mm" }}>
        <div style={{ background: "#ffffff", borderRadius: "8mm", padding: "8mm", boxShadow: "0 8px 32px rgba(0,0,0,0.22)", boxSizing: "border-box" }}>
          <QRCodeSVG value={publicUrl} size={380} level="H" includeMargin fgColor={primaryColor} />
        </div>
        <div style={{ ...centerColumnStyle, gap: "2mm" }}>
          <p style={{ margin: 0, color: fg, fontSize: "15px", fontWeight: 700 }}>Ajoutez votre carte fidélité en quelques secondes</p>
          <p style={{ margin: 0, color: fgSub, fontSize: "12px" }}>Offres, récompenses et avantages exclusifs</p>
        </div>
      </div>

      <div style={{ ...centerColumnStyle, gap: "2mm" }}>
        <p style={{ margin: 0, color: fgSub, fontSize: "11px" }}>Compatible Apple Wallet & Google Wallet</p>
        <p style={{ margin: 0, color: fgSub, fontSize: "10px", maxWidth: "150mm", wordBreak: "break-all" }}>{publicUrl}</p>
      </div>
    </div>
  );
}
