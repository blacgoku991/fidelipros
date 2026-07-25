// Briques d'affichage d'un audit, partagées par la fiche prospect et l'écran « Auditer une URL ».

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CLASSES_SEVERITE, classeScore, LIBELLES_EFFORT, LIBELLES_PILIERS, LIBELLES_SEVERITE, PILIERS,
  type Finding,
} from "@/lib/prospection";
import { cn } from "@/lib/utils";

/** Une note sur 100, ou « — » quand elle n'a pas de sens (audit non concluant). */
export function Score({ label, valeur }: { label: string; valeur: number | null }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-4 text-center shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-semibold mt-1", valeur === null ? "text-muted-foreground" : classeScore(valeur))}>
        {valeur === null ? "—" : valeur}
        {valeur !== null && <span className="text-sm font-normal text-muted-foreground">/100</span>}
      </p>
    </div>
  );
}

interface NotesAuditProps {
  global: number | null;
  seo: number | null;
  design: number | null;
  securite: number | null;
  technique: number | null;
}

/** La ligne des cinq notes : globale puis un pilier par colonne. */
export function NotesAudit(notes: NotesAuditProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Score label="Note globale" valeur={notes.global} />
      {PILIERS.map((pilier) => (
        <Score key={pilier} label={LIBELLES_PILIERS[pilier]} valeur={notes[pilier]} />
      ))}
    </div>
  );
}

/** Défauts d'un volet : gravité, constat mesuré, conséquence commerciale, effort. */
export function ListeFindings({ findings }: { findings: Finding[] }) {
  if (!findings.length) {
    return <p className="text-sm text-emerald-600 dark:text-emerald-400 py-4">Aucun défaut relevé sur ce volet.</p>;
  }
  return (
    <ul className="divide-y divide-border/40">
      {findings.map((finding) => (
        <li key={finding.regle} className="py-3 flex gap-3">
          <Badge variant="secondary" className={cn("h-fit shrink-0", CLASSES_SEVERITE[finding.severite])}>
            {LIBELLES_SEVERITE[finding.severite]}
          </Badge>
          <div className="min-w-0">
            <p className="font-medium text-sm">{finding.titre}</p>
            <p className="text-xs text-muted-foreground mt-0.5 break-words">{finding.constat}</p>
            <p className="text-xs mt-1 italic">{finding.impact}</p>
          </div>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">{LIBELLES_EFFORT[finding.effort]}</span>
        </li>
      ))}
    </ul>
  );
}

/** Les quatre volets d'audit en onglets, avec le nombre de défauts par volet. */
export function OngletsPiliers({ findings }: { findings: Finding[] }) {
  return (
    <Tabs defaultValue="seo">
      <TabsList className="rounded-xl">
        {PILIERS.map((pilier) => (
          <TabsTrigger key={pilier} value={pilier} className="rounded-lg text-xs sm:text-sm">
            {LIBELLES_PILIERS[pilier]}
            <span className="ml-1.5 text-muted-foreground">
              {findings.filter((f) => f.pilier === pilier).length}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      {PILIERS.map((pilier) => (
        <TabsContent key={pilier} value={pilier}>
          <ListeFindings findings={findings.filter((f) => f.pilier === pilier)} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

/** Bandeau affiché quand le site n'a pas pu être observé. */
export function BandeauNonConcluant({ raison, action }: { raison: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-300/60 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-4">
      <p className="font-medium text-sm text-amber-900 dark:text-amber-200">Audit non concluant</p>
      <p className="text-sm text-amber-900/80 dark:text-amber-200/80 mt-1">
        {raison} Aucun défaut n'est affirmé et aucun devis n'est proposé : ouvrez le site à la
        main, ou relancez l'audit depuis un autre réseau.
      </p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
