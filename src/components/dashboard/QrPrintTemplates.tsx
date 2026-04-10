import { useState, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Printer, Download, ChevronDown } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Variant = "minimal" | "impact" | "luxe";
type Format = "a4-portrait" | "a4-landscape" | "a3-portrait" | "a3-landscape" | "counter";

interface QrPrintTemplatesProps {
  businessName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  publicUrl: string;
  promoText?: string;
}

const FORMAT_LABELS: Record<Format, string> = {
  "a4-portrait": "A4 Portrait",
  "a4-landscape": "A4 Paysage",
  "a3-portrait": "A3 Portrait",
  "a3-landscape": "A3 Paysage",
  counter: "Comptoir / Chevalet",
};

const VARIANT_LABELS: Record<Variant, { label: string; desc: string }> = {
  minimal: { label: "✨ Premium Minimaliste", desc: "Épuré, élégant, essentiel" },
  impact: { label: "🎯 Impact Vitrine", desc: "Commercial, accrocheur, conversion" },
  luxe: { label: "💎 Luxe Épuré", desc: "Très haut de gamme, sobre" },
};

/* ── Contrast helper ── */
function getContrastColor(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#000000" : "#ffffff";
}

function lighten(hex: string, pct: number): string {
  const c = hex.replace("#", "");
  const r = Math.min(255, parseInt(c.substring(0, 2), 16) + Math.round(255 * pct));
  const g = Math.min(255, parseInt(c.substring(2, 4), 16) + Math.round(255 * pct));
  const b = Math.min(255, parseInt(c.substring(4, 6), 16) + Math.round(255 * pct));
  return `rgb(${r},${g},${b})`;
}

/* ── Format dimensions (mm → we use CSS mm units in print) ── */
const FORMAT_DIMS: Record<Format, { w: string; h: string; qrSize: number; isLandscape: boolean }> = {
  "a4-portrait": { w: "210mm", h: "297mm", qrSize: 460, isLandscape: false },
  "a4-landscape": { w: "297mm", h: "210mm", qrSize: 380, isLandscape: true },
  "a3-portrait": { w: "297mm", h: "420mm", qrSize: 680, isLandscape: false },
  "a3-landscape": { w: "420mm", h: "297mm", qrSize: 540, isLandscape: true },
  counter: { w: "150mm", h: "200mm", qrSize: 320, isLandscape: false },
};

/* ── Render a single template ── */
function TemplateContent({ variant, format, businessName, logoUrl, primaryColor, secondaryColor, publicUrl, promoText }: QrPrintTemplatesProps & { variant: Variant; format: Format }) {
  const dims = FORMAT_DIMS[format];
  const fg = getContrastColor(primaryColor);
  const fgSub = fg === "#ffffff" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)";
  const qrSize = dims.qrSize;

  if (variant === "minimal") {
    return (
      <div style={{ width: dims.w, height: dims.h, background: "#ffffff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "8mm", boxSizing: "border-box", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
        {/* Header */}
        <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", padding: "6mm 4mm", borderRadius: "6mm", background: primaryColor }}>
          {logoUrl && <img src={logoUrl} alt="" style={{ width: "48px", height: "48px", borderRadius: "12px", objectFit: "cover" }} />}
          <span style={{ fontSize: "24px", fontWeight: 700, color: fg, letterSpacing: "-0.5px" }}>{businessName}</span>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", padding: "4mm 0" }}>
          <p style={{ fontSize: "22px", fontWeight: 700, color: "#1a1a1a", margin: 0, lineHeight: 1.3 }}>
            Rejoignez notre programme fidélité
          </p>
          <p style={{ fontSize: "14px", color: "#666", marginTop: "6px" }}>
            Simple, rapide, gratuit
          </p>
        </div>

        {/* QR */}
        <div style={{ padding: "6mm", background: "#ffffff", border: `3px solid ${primaryColor}20`, borderRadius: "6mm" }}>
          <QRCodeSVG value={publicUrl} size={qrSize} level="H" includeMargin fgColor="#000000" />
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", opacity: 0.5, fontSize: "11px", color: "#333" }}>
          <p style={{ margin: 0 }}>Compatible Apple Wallet & Google Wallet</p>
        </div>
      </div>
    );
  }

  if (variant === "impact") {
    return (
      <div style={{ width: dims.w, height: dims.h, background: `linear-gradient(180deg, ${primaryColor} 0%, ${secondaryColor || primaryColor} 100%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "10mm", boxSizing: "border-box", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
        {/* Header */}
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          {logoUrl && <img src={logoUrl} alt="" style={{ width: "64px", height: "64px", borderRadius: "16px", objectFit: "cover", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }} />}
          <span style={{ fontSize: "28px", fontWeight: 800, color: fg, letterSpacing: "-0.5px" }}>{businessName}</span>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: dims.isLandscape ? "26px" : "30px", fontWeight: 800, color: fg, margin: 0, lineHeight: 1.2 }}>
            🎁 Scannez pour rejoindre<br />notre programme fidélité
          </p>
          <p style={{ fontSize: "16px", color: fgSub, marginTop: "8px" }}>
            {promoText || "Cumulez vos récompenses dès maintenant"}
          </p>
        </div>

        {/* QR — white card */}
        <div style={{ padding: "8mm", background: "#ffffff", borderRadius: "8mm", boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }}>
          <QRCodeSVG value={publicUrl} size={qrSize} level="H" includeMargin fgColor={primaryColor} />
        </div>

        {/* Sub-text */}
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: fgSub, margin: 0 }}>
            Ajoutez votre carte fidélité en quelques secondes
          </p>
          <p style={{ fontSize: "12px", color: fgSub, marginTop: "4px" }}>
            Offres, récompenses et avantages exclusifs
          </p>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: "11px", color: fgSub }}>
          <p style={{ margin: 0 }}>Compatible Apple Wallet & Google Wallet</p>
        </div>
      </div>
    );
  }

  // variant === "luxe"
  return (
    <div style={{ width: dims.w, height: dims.h, background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "12mm", boxSizing: "border-box", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
        {logoUrl && <img src={logoUrl} alt="" style={{ width: "56px", height: "56px", borderRadius: "14px", objectFit: "cover" }} />}
        <span style={{ fontSize: "22px", fontWeight: 300, color: "#ffffff", letterSpacing: "4px", textTransform: "uppercase" }}>{businessName}</span>
        <div style={{ width: "60px", height: "1px", background: `linear-gradient(90deg, transparent, ${primaryColor}, transparent)` }} />
      </div>

      {/* CTA */}
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "18px", fontWeight: 300, color: "#cccccc", margin: 0, letterSpacing: "2px", textTransform: "uppercase" }}>
          Programme Fidélité
        </p>
      </div>

      {/* QR */}
      <div style={{ padding: "6mm", background: "#ffffff", borderRadius: "4mm" }}>
        <QRCodeSVG value={publicUrl} size={qrSize} level="H" includeMargin fgColor="#0a0a0a" />
      </div>

      {/* Sub-text */}
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "14px", color: "#999", margin: 0, fontWeight: 300, letterSpacing: "1px" }}>
          Scannez pour rejoindre
        </p>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: "10px", color: "#555", letterSpacing: "1px" }}>
        <p style={{ margin: 0 }}>Apple Wallet & Google Wallet</p>
      </div>
    </div>
  );
}

/* ── Main exported component ── */
export function QrPrintTemplates(props: QrPrintTemplatesProps) {
  const [variant, setVariant] = useState<Variant>("impact");
  const [format, setFormat] = useState<Format>("a4-portrait");
  const previewRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    const el = previewRef.current;
    if (!el) return;

    // Serialize SVGs to inline data for print compatibility
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("svg").forEach((svg) => {
      const svgData = new XMLSerializer().serializeToString(svg);
      const img = document.createElement("img");
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
      img.style.width = svg.getAttribute("width") ? svg.getAttribute("width") + "px" : "100%";
      img.style.height = svg.getAttribute("height") ? svg.getAttribute("height") + "px" : "auto";
      svg.replaceWith(img);
    });

    const dims = FORMAT_DIMS[format];
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Impression QR</title><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${dims.w}; height: ${dims.h}; }
      @media print { @page { size: ${dims.w} ${dims.h}; margin: 0; } }
      img { display: inline-block; }
    </style></head><body>${clone.innerHTML}</body></html>`);
    printWindow.document.close();

    // Wait for images (QR as data-uri) to load then print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 600);
  }, [format]);

  // Scale for preview: show scaled-down version
  const dims = FORMAT_DIMS[format];
  const previewScale = format === "counter" ? 0.45 : format.includes("a3") ? 0.25 : 0.32;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Template</label>
          <Select value={variant} onValueChange={(v) => setVariant(v as Variant)}>
            <SelectTrigger className="rounded-xl h-10 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(VARIANT_LABELS) as Variant[]).map(v => (
                <SelectItem key={v} value={v} className="text-xs">
                  <span className="font-medium">{VARIANT_LABELS[v].label}</span>
                  <span className="text-muted-foreground ml-2">— {VARIANT_LABELS[v].desc}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Format</label>
          <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
            <SelectTrigger className="rounded-xl h-10 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FORMAT_LABELS) as Format[]).map(f => (
                <SelectItem key={f} value={f} className="text-xs">{FORMAT_LABELS[f]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-2xl bg-muted/50 border border-border/30 p-4 overflow-hidden flex justify-center">
        <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top center" }}>
          <div ref={previewRef}>
            <TemplateContent variant={variant} format={format} {...props} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-center">
        <Button onClick={handlePrint} className="rounded-xl gap-2 bg-gradient-primary text-primary-foreground">
          <Printer className="w-4 h-4" /> Imprimer l'affiche
        </Button>
      </div>
    </div>
  );
}
