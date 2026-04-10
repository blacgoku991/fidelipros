import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrintPosterA4, type QrPrintVariant } from "@/components/dashboard/PrintPosterA4";

interface QrPrintTemplatesProps {
  businessName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  publicUrl: string;
  promoText?: string;
}

const VARIANT_LABELS: Record<QrPrintVariant, { label: string; desc: string }> = {
  minimal: { label: "✨ Premium Minimaliste", desc: "Épuré, élégant, essentiel" },
  impact: { label: "🎯 Impact Vitrine", desc: "Commercial, accrocheur, conversion" },
  luxe: { label: "💎 Luxe Épuré", desc: "Très haut de gamme, sobre" },
};

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const PRINT_STYLE_ID = "qr-poster-a4-print-style";

function twoRaf(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

async function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
}

function serializeSvgsToImages(container: HTMLElement) {
  container.querySelectorAll("svg").forEach((svg) => {
    const data = new XMLSerializer().serializeToString(svg);
    const img = document.createElement("img");
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
    const w = svg.getAttribute("width");
    const h = svg.getAttribute("height");
    if (w) img.style.width = `${w}px`;
    if (h) img.style.height = `${h}px`;
    img.style.display = "block";
    svg.replaceWith(img);
  });
}

export function QrPrintTemplates(props: QrPrintTemplatesProps) {
  const [variant, setVariant] = useState<QrPrintVariant>("impact");
  const [isPrintMode, setIsPrintMode] = useState(false);
  const printRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.getElementById(PRINT_STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = PRINT_STYLE_ID;
    style.textContent = `
      @media print {
        @page {
          size: A4 portrait;
          margin: 0;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 210mm !important;
          height: 297mm !important;
          overflow: hidden !important;
          background: #fff !important;
        }
        body * {
          visibility: hidden !important;
        }
        #qr-poster-print-root,
        #qr-poster-print-root * {
          visibility: visible !important;
        }
        #qr-poster-print-root {
          position: fixed !important;
          inset: 0 !important;
          width: 210mm !important;
          height: 297mm !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          display: block !important;
          background: #fff !important;
          z-index: 2147483647 !important;
          transform: none !important;
        }
        #qr-poster-print-area {
          width: 210mm !important;
          height: 297mm !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
          page-break-after: avoid !important;
          transform: none !important;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, []);

  const handlePrint = useCallback(async () => {
    setIsPrintMode(true);

    await twoRaf();

    const printRoot = printRootRef.current;
    if (!printRoot) {
      setIsPrintMode(false);
      return;
    }

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    await waitForImages(printRoot);
    serializeSvgsToImages(printRoot);
    await twoRaf();

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      setIsPrintMode(false);
      window.removeEventListener("afterprint", cleanup);
    };

    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    setTimeout(cleanup, 10000);
  }, []);

  const maxPreviewWidth = 360;
  const previewScale = Math.min(maxPreviewWidth / A4_WIDTH_PX, 1);
  const previewW = Math.round(A4_WIDTH_PX * previewScale);
  const previewH = Math.round(A4_HEIGHT_PX * previewScale);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Template</label>
        <Select value={variant} onValueChange={(v) => setVariant(v as QrPrintVariant)}>
          <SelectTrigger className="rounded-xl h-10 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(VARIANT_LABELS) as QrPrintVariant[]).map((v) => (
              <SelectItem key={v} value={v} className="text-xs">
                <span className="font-medium">{VARIANT_LABELS[v].label}</span>
                <span className="text-muted-foreground ml-2">— {VARIANT_LABELS[v].desc}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
            <PrintPosterA4 variant={variant} {...props} />
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <Button onClick={handlePrint} className="rounded-xl gap-2 bg-gradient-primary text-primary-foreground">
          <Printer className="w-4 h-4" /> Imprimer l'affiche
        </Button>
      </div>

      <div
        id="qr-poster-print-root"
        ref={printRootRef}
        style={{
          position: "fixed",
          left: "-99999px",
          top: "-99999px",
          width: 0,
          height: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
        aria-hidden
      >
        {isPrintMode ? (
          <div id="qr-poster-print-area">
            <PrintPosterA4 variant={variant} {...props} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
