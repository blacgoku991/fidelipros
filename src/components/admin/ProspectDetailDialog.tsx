import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Building2, CalendarDays, ExternalLink, Mail, MapPin, Phone, TriangleAlert, Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  formateDate, formateEuros, lienMaps, majProspect, PRIORITES, STATUTS_COMMERCIAUX, STATUTS_SITE,
  type ProspectEnregistre, type StatutCommercial,
} from "@/lib/prospection";

interface ProspectDetailDialogProps {
  prospect: ProspectEnregistre | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnregistre: (id: string, patch: Partial<ProspectEnregistre>) => void;
}

function Ligne({ icone: Icone, label, valeur }: { icone: React.ElementType; label: string; valeur: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icone className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm break-words">{valeur}</div>
      </div>
    </div>
  );
}

export function ProspectDetailDialog({
  prospect, open, onOpenChange, onEnregistre,
}: ProspectDetailDialogProps) {
  const [notes, setNotes] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    setNotes(prospect?.notes ?? "");
  }, [prospect]);

  if (!prospect) return null;

  const changeStatut = async (statut: StatutCommercial) => {
    try {
      await majProspect(prospect.id, { statut });
      onEnregistre(prospect.id, { statut });
      toast.success("Statut mis à jour");
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Mise à jour impossible");
    }
  };

  const enregistreNotes = async () => {
    setEnregistrement(true);
    try {
      await majProspect(prospect.id, { notes });
      onEnregistre(prospect.id, { notes });
      toast.success("Notes enregistrées");
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Enregistrement impossible");
    } finally {
      setEnregistrement(false);
    }
  };

  const site = STATUTS_SITE[prospect.site_statut];
  const priorite = PRIORITES[prospect.priorite];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="pr-6">{prospect.nom}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
            <Badge className={priorite.classe} variant="secondary">{priorite.label} · {prospect.score}/100</Badge>
            <Badge className={site.classe} variant="secondary">{site.label}</Badge>
            <span className="text-xs">SIREN {prospect.siren}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-4">
          <Ligne
            icone={Building2}
            label="Activité"
            valeur={`${prospect.activite_code ?? "—"}${prospect.enseigne ? ` · ${prospect.enseigne}` : ""}`}
          />
          <Ligne icone={CalendarDays} label="Créée le" valeur={formateDate(prospect.date_creation)} />
          <Ligne
            icone={Users}
            label="Effectif / chiffre d'affaires"
            valeur={`${prospect.effectif_estime ?? "—"} salarié(s) · ${formateEuros(prospect.chiffre_affaires)}${
              prospect.annee_finances ? ` (${prospect.annee_finances})` : ""
            }`}
          />
          <Ligne
            icone={MapPin}
            label="Adresse"
            valeur={
              <a className="hover:underline" href={lienMaps(prospect)} target="_blank" rel="noreferrer">
                {prospect.adresse ?? (`${prospect.code_postal ?? ""} ${prospect.ville ?? ""}`.trim() || "—")}
              </a>
            }
          />
          {prospect.dirigeant && <Ligne icone={Users} label="Dirigeant" valeur={prospect.dirigeant} />}
          {prospect.email_contact && (
            <Ligne
              icone={Mail}
              label="Email trouvé sur le site"
              valeur={<a className="hover:underline" href={`mailto:${prospect.email_contact}`}>{prospect.email_contact}</a>}
            />
          )}
          {prospect.telephone && (
            <Ligne
              icone={Phone}
              label="Téléphone"
              valeur={<a className="hover:underline" href={`tel:${prospect.telephone.replace(/\s/g, "")}`}>{prospect.telephone}</a>}
            />
          )}
          {prospect.site_web && (
            <Ligne
              icone={ExternalLink}
              label="Site web"
              valeur={
                <a className="hover:underline break-all" href={prospect.site_web} target="_blank" rel="noreferrer">
                  {prospect.site_web}
                </a>
              }
            />
          )}
        </div>

        <div className="rounded-xl border border-border/40 bg-muted/30 p-4">
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <TriangleAlert className="w-4 h-4 text-muted-foreground" />
            Arguments commerciaux ({prospect.site_signaux?.length ?? 0})
          </p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {(prospect.site_signaux ?? []).map((signal) => (
              <li key={signal} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{signal}</span>
              </li>
            ))}
            {!prospect.site_signaux?.length && <li>Aucun audit réalisé sur ce prospect.</li>}
          </ul>
        </div>

        <div className="grid sm:grid-cols-[200px_1fr] gap-4 items-start">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Statut commercial</p>
            <Select value={prospect.statut} onValueChange={(v) => changeStatut(v as StatutCommercial)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUTS_COMMERCIAUX.map((s) => (
                  <SelectItem key={s.valeur} value={s.valeur}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Notes</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Compte rendu d'appel, budget évoqué, prochaine relance…"
              className="rounded-xl min-h-[90px]"
            />
            <Button
              size="sm"
              className="mt-2 rounded-xl"
              onClick={enregistreNotes}
              disabled={enregistrement || notes === (prospect.notes ?? "")}
            >
              {enregistrement ? "Enregistrement…" : "Enregistrer les notes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
