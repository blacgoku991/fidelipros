import { useState, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
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

function getContrastColor(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#000000" : "#ffffff";
}

/* ── Format dimensions ── */
const FORMAT_DIMS: Record<Format, { w: string; h: string; wPx: number; hPx: number; qrSize: number; isLandscape: boolean }> = {
  "a4-portrait":  { w: "210mm", h: "297mm", wPx: 794, hPx: 1123, qrSize: 460, isLandscape: false },
  "a4-landscape": { w: "297mm", h: "210mm", wPx: 1123, hPx: 794, qrSize: 380, isLandscape: true },
  "a3-portrait":  { w: "297mm", h: "420mm", wPx: 1123, hPx: 1587, qrSize: 680, isLandscape: false },
  "a3-landscape": { w: "420mm", h: "297mm", wPx: 1587, hPx: 1123, qrSize: 540, isLandscape: true },
  counter:        { w: "150mm", h: "200mm", wPx: 567, hPx: 756, qrSize: 320, isLandscape: false },
};

/* ── Template content (inline styles only — no Tailwind, for print fidelity) ── */
function TemplateContent({ variant, format, businessName, logoUrl, primaryColor, secondaryColor, publicUrl, promoText }: QrPrintTemplatesProps & { variant: Variant; format: Format }) {
  const dims = FORMAT_DIMS[format];
  const fg = getContrastColor(primaryColor);
  const fgSub = fg === "#ffffff" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)";
  const qrSize = dims.qrSize;

  if (variant === "minimal") {
    return (
      <div style={{ width: dims.w, height: dims.h, background: "#ffffff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "8mm", boxSizing: "border-box", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
        <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", padding: "6mm 4mm", borderRadius: "6mm", background: primaryColor }}>
          {logoUrl && <img src={logoUrl} alt="" style={{ width: "48px", height: "48px", borderRadius: "12px", objectFit: "cover" }} />}
          <span style={{ fontSize: "24px", fontWeight: 700, color: fg, letterSpacing: "-0.5px" }}>{businessName}</span>
        </div>
        <div style={{ textAlign: "center", padding: "4mm 0" }}>
          <p style={{ fontSize: "22px", fontWeight: 700, color: "#1a1a1a", margin: 0, lineHeight: 1.3 }}>Rejoignez notre programme fidélité</p>
          <p style={{ fontSize: "14px", color: "#666", marginTop: "6px" }}>Simple, rapide, gratuit</p>
        </div>
        <div style={{ padding: "6mm", background: "#ffffff", border: `3px solid ${primaryColor}20`, borderRadius: "6mm" }}>
          <QRCodeSVG value={publicUrl} size={qrSize} level="H" includeMargin fgColor="#000000" />
        </div>
        <div style={{ textAlign: "center", opacity: 0.5, fontSize: "11px", color: "#333" }}>
          <p style={{ margin: 0 }}>Compatible Apple Wallet & Google Wallet</p>
        </div>
      </div>
    );
  }

  if (variant === "impact") {
    return (
      <div style={{ width: dims.w, height: dims.h, background: `linear-gradient(180deg, ${primaryColor} 0%, ${secondaryColor || primaryColor} 100%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "10mm", boxSizing: "border-box", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          {logoUrl && <img src={logoUrl} alt="" style={{ width: "64px", height: "64px", borderRadius: "16px", objectFit: "cover", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }} />}
          <span style={{ fontSize: "28px", fontWeight: 800, color: fg, letterSpacing: "-0.5px" }}>{businessName}</span>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: dims.isLandscape ? "26px" : "30px", fontWeight: 800, color: fg, margin: 0, lineHeight: 1.2 }}>🎁 Scannez pour rejoindre<br />notre programme fidélité</p>
          <p style={{ fontSize: "16px", color: fgSub, marginTop: "8px" }}>{promoText || "Cumulez vos récompenses dès maintenant"}</p>
        </div>
        <div style={{ padding: "8mm", background: "#ffffff", borderRadius: "8mm", boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }}>
          <QRCodeSVG value={publicUrl} size={qrSize} level="H" includeMargin fgColor={primaryColor} />
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: fgSub, margin: 0 }}>Ajoutez votre carte fidélité en quelques secondes</p>
          <p style={{ fontSize: "12px", color: fgSub, marginTop: "4px" }}>Offres, récompenses et avantages exclusifs</p>
        </div>
        <div style={{ textAlign: "center", fontSize: "11px", color: fgSub }}>
          <p style={{ margin: 0 }}>Compatible Apple Wallet & Google Wallet</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: dims.w, height: dims.h, background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "12mm", boxSizing: "border-box", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
        {logoUrl && <img src={logoUrl} alt="" style={{ width: "56px", height: "56px", borderRadius: "14px", objectFit: "cover" }} />}
        <span style={{ fontSize: "22px", fontWeight: 300, color: "#ffffff", letterSpacing: "4px", textTransform: "uppercase" }}>{businessName}</span>
        <div style={{ width: "60px", height: "1px", background: `linear-gradient(90deg, transparent, ${primaryColor}, transparent)` }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "18px", fontWeight: 300, color: "#cccccc", margin: 0, letterSpacing: "2px", textTransform: "uppercase" }}>Programme Fidélité</p>
      </div>
      <div style={{ padding: "6mm", background: "#ffffff", borderRadius: "4mm" }}>
        <QRCodeSVG value={publicUrl} size={qrSize} level="H" includeMargin fgColor="#0a0a0a" />
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "14px", color: "#999", margin: 0, fontWeight: 300, letterSpacing: "1px" }}>Scannez pour rejoindre</p>
      </div>
      <div style={{ textAlign: "center", fontSize: "10px", color: "#555", letterSpacing: "1px" }}>
        <p style={{ margin: 0 }}>Apple Wallet & Google Wallet</p>
      </div>
    </div>
  );
}

/* ── Serialize a DOM element's SVGs to <img> data URIs for print reliability ── */
function serializeSvgsToImages(container: HTMLElement) {
  container.querySelectorAll("svg").forEach((svg) => {
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = document.createElement("img");
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
    const w = svg.getAttribute("width");
    const h = svg.getAttribute("height");
    if (w) img.style.width = w + "px";
    if (h) img.style.height = h + "px";
    img.style.display = "block";
    svg.replaceWith(img);
  });
}

/* ── Wait for all images + fonts before printing ── */
async function waitForRender(container: HTMLElement): Promise<void> {
  await document.fonts.ready;
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
  await new Promise((r) => requestAnimationFrame(r));
}

/* ── Main exported component ── */
export function QrPrintTemplates(props: QrPrintTemplatesProps) {
  const [variant, setVariant] = useState<Variant>("impact");
  const [format, setFormat] = useState<Format>("a4-portrait");
  const previewRef = useRef<HTMLDivElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(async () => {
    const el = previewRef.current;
    const printArea = printAreaRef.current;
    if (!el || !printArea) return;

    const dims = FORMAT_DIMS[format];

    // Clone the poster content into the hidden #print-area
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.transform = "none";
    clone.style.width = dims.w;
    clone.style.height = dims.h;
    serializeSvgsToImages(clone);

    printArea.innerHTML = "";
    printArea.appendChild(clone);

    // Inject print-only styles
    const STYLE_ID = "qr-poster-print-style";
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @media print {
        @page { size: ${dims.w} ${dims.h}; margin: 0; }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: ${dims.w} !important;
          height: ${dims.h} !important;
          overflow: hidden !important;
          background: #fff !important;
        }
        body * { visibility: hidden !important; }
        #qr-poster-print-area,
        #qr-poster-print-area * {
          visibility: visible !important;
        }
        #qr-poster-print-area {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: ${dims.w} !important;
          height: ${dims.h} !important;
          transform: none !important;
          overflow: hidden !important;
          z-index: 999999 !important;
          background: #fff !important;
        }
      }
    `;
    document.head.appendChild(style);

    await waitForRender(printArea);

    window.print();

    // Cleanup after print
    const cleanup = () => {
      style.remove();
      printArea.innerHTML = "";
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    // Fallback cleanup after 10s (iOS doesn't always fire afterprint)
    setTimeout(cleanup, 10000);
  }, [format]);

  // Preview: scale the full-size poster down to fit within the card.
  // Use pre-computed pixel values so calc() works correctly (no mm × unitless).
  const dims = FORMAT_DIMS[format];
  const maxPreviewWidth = 360;
  const previewScale = Math.min(maxPreviewWidth / dims.wPx, 1);
  const previewW = Math.round(dims.wPx * previewScale);
  const previewH = Math.round(dims.hPx * previewScale);

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

      {/* Preview — fixed pixel dimensions, no calc(mm * unitless) */}
      <div className="rounded-2xl bg-muted/50 border border-border/30 p-4 overflow-hidden flex justify-center">
        <div
          style={{
            width: previewW,
            height: previewH,
            position: "relative",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              transform: `scale(${previewScale})`,
              transformOrigin: "top left",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          >
            <div ref={previewRef}>
              <TemplateContent variant={variant} format={format} {...props} />
            </div>
          </div>
        </div>
      </div>

      {/* Print button */}
      <div className="flex gap-2 justify-center">
        <Button onClick={handlePrint} className="rounded-xl gap-2 bg-gradient-primary text-primary-foreground">
          <Printer className="w-4 h-4" /> Imprimer l'affiche
        </Button>
      </div>

      {/* Hidden print area — only visible via @media print */}
      <div
        id="qr-poster-print-area"
        ref={printAreaRef}
        style={{
          position: "fixed",
          top: "-99999px",
          left: "-99999px",
          width: 0,
          height: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
