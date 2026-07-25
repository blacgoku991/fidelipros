import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Printer } from "lucide-react";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { Button } from "@/components/ui/button";
import { chargeDocuments, chargeProspect, type ProspectEnregistre } from "@/lib/prospection";

/**
 * Rapport d'audit client, sans habillage d'application : la page est faite pour être
 * imprimée ou enregistrée en PDF (même approche que QrPrintTemplates).
 *
 * Le HTML injecté est produit par notre propre générateur, qui échappe systématiquement
 * le contenu venant du site audité (voir proposition/redaction.ts).
 */
const AdminProspectRapport = () => {
  const { prospectId = "" } = useParams();
  const [prospect, setProspect] = useState<ProspectEnregistre | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        const [fiche, documents] = await Promise.all([
          chargeProspect(prospectId),
          chargeDocuments(prospectId),
        ]);
        if (!actif) return;
        setProspect(fiche);
        setHtml(documents.find((d) => d.type === "rapport")?.contenu_html ?? null);
      } finally {
        if (actif) setChargement(false);
      }
    })();
    return () => { actif = false; };
  }, [prospectId]);

  return (
    <AdminGuard>
      <div className="min-h-screen bg-muted/30">
        <div className="print:hidden sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/40 px-4 py-3 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" className="rounded-xl" asChild>
            <Link to={`/admin/prospection/${prospectId}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour à la fiche
            </Link>
          </Button>
          <Button size="sm" className="rounded-xl" onClick={() => window.print()} disabled={!html}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimer / enregistrer en PDF
          </Button>
        </div>

        <div className="py-6 px-4">
          {chargement && (
            <p className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Chargement du rapport…
            </p>
          )}
          {!chargement && !html && (
            <div className="max-w-lg mx-auto text-center text-muted-foreground">
              <p>
                Aucun rapport pour {prospect?.nom ?? "ce prospect"}. Générez la proposition depuis
                la fiche pour produire le rapport client.
              </p>
              <Button variant="outline" className="rounded-xl mt-4" asChild>
                <Link to={`/admin/prospection/${prospectId}`}>Ouvrir la fiche</Link>
              </Button>
            </div>
          )}
          {html && (
            <div
              className="bg-white text-black mx-auto max-w-[860px] rounded-2xl shadow-sm print:shadow-none print:rounded-none"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </div>
    </AdminGuard>
  );
};

export default AdminProspectRapport;
