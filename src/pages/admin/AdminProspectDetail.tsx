import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Copy, Download, ExternalLink, FileText, Loader2, Mail, MapPin, MessageSquare,
  Phone, Printer, RefreshCw, Sparkles, Wand2,
} from "lucide-react";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  auditeProspect, chargeDernierAudit, chargeDocuments, chargeProspect, CLASSES_SEVERITE,
  classeScore, euros, formateDate, formateEuros, genereProposition, LIBELLES_ACCESSIBILITE,
  LIBELLES_EFFORT, LIBELLES_PILIERS, LIBELLES_SEVERITE, LIBELLES_URGENCE, lienMaps, majProspect,
  PRIORITES, STATUTS_COMMERCIAUX, STATUTS_SITE, telechargeFichier, urlCapture,
  type AuditEnregistre, type DocumentProspect, type Finding, type Pilier,
  type ProspectEnregistre, type StatutCommercial,
} from "@/lib/prospection";
import { cn } from "@/lib/utils";

const PILIERS: Pilier[] = ["seo", "design", "securite", "technique"];

function Score({ label, valeur }: { label: string; valeur: number | null }) {
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

function ListeFindings({ findings }: { findings: Finding[] }) {
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

function BoutonCopier({ texte, libelle }: { texte: string; libelle: string }) {
  const copie = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      toast.success(`${libelle} copié`);
    } catch {
      toast.error("Copie impossible depuis ce navigateur");
    }
  };
  return (
    <Button variant="outline" size="sm" className="rounded-xl" onClick={copie}>
      <Copy className="w-4 h-4 mr-2" />
      Copier
    </Button>
  );
}

const AdminProspectDetail = () => {
  const { prospectId = "" } = useParams();
  const [prospect, setProspect] = useState<ProspectEnregistre | null>(null);
  const [audit, setAudit] = useState<AuditEnregistre | null>(null);
  const [documents, setDocuments] = useState<DocumentProspect[]>([]);
  const [capture, setCapture] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enAudit, setEnAudit] = useState(false);
  const [enGeneration, setEnGeneration] = useState(false);
  const [notes, setNotes] = useState("");

  const recharge = useCallback(async () => {
    setChargement(true);
    try {
      const [fiche, dernier, docs] = await Promise.all([
        chargeProspect(prospectId),
        chargeDernierAudit(prospectId),
        chargeDocuments(prospectId),
      ]);
      setProspect(fiche);
      setAudit(dernier);
      setDocuments(docs);
      setNotes(fiche?.notes ?? "");
      setCapture(dernier?.capture_path ? await urlCapture(dernier.capture_path) : null);
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Chargement impossible");
    } finally {
      setChargement(false);
    }
  }, [prospectId]);

  useEffect(() => {
    void recharge();
  }, [recharge]);

  const lanceAudit = async () => {
    setEnAudit(true);
    try {
      const resultat = await auditeProspect({ prospect_id: prospectId }, "complet");
      if (resultat.sans_site) {
        toast.info(resultat.message ?? "Aucun site détecté pour cette entreprise");
      } else if (resultat.concluant === false) {
        toast.warning("Audit non concluant", {
          description: resultat.message ?? "Le site n'a pas pu être analysé — rien n'est conclu.",
        });
      } else {
        toast.success(`Audit terminé : ${resultat.audit?.scores.global}/100`, {
          description: resultat.audit?.erreurs.length
            ? `Non vérifié : ${resultat.audit.erreurs.join(" · ")}`
            : `${resultat.audit?.findings.length} point(s) analysé(s)`,
        });
      }
      await recharge();
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "L'audit a échoué");
    } finally {
      setEnAudit(false);
    }
  };

  const genere = async (avecIa: boolean) => {
    setEnGeneration(true);
    try {
      const resultat = await genereProposition(prospectId, { avecIa });
      toast.success(
        `Proposition générée : ${euros(resultat.devis.total_ht)} HT`,
        {
          description: avecIa && !resultat.genere_par_ia
            ? "Textes déterministes utilisés (IA indisponible)"
            : undefined,
        },
      );
      await recharge();
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Génération impossible");
    } finally {
      setEnGeneration(false);
    }
  };

  const changeStatut = async (statut: StatutCommercial) => {
    if (!prospect) return;
    setProspect({ ...prospect, statut });
    try {
      await majProspect(prospect.id, { statut });
      toast.success("Statut mis à jour");
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Mise à jour impossible");
      await recharge();
    }
  };

  const enregistreNotes = async () => {
    if (!prospect) return;
    try {
      await majProspect(prospect.id, { notes });
      setProspect({ ...prospect, notes });
      toast.success("Notes enregistrées");
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Enregistrement impossible");
    }
  };

  const document_ = (type: DocumentProspect["type"]) => documents.find((d) => d.type === type);
  const rapport = document_("rapport");
  const devis = document_("devis");
  const email = document_("email");

  const findingsParPilier = useMemo(() => {
    const groupes = {} as Record<Pilier, Finding[]>;
    const exploitables = audit?.concluant === false ? [] : audit?.findings ?? [];
    for (const pilier of PILIERS) {
      groupes[pilier] = exploitables.filter((f) => f.pilier === pilier);
    }
    return groupes;
  }, [audit]);

  if (chargement && !prospect) {
    return (
      <AdminLayout title="Fiche prospect" subtitle="Chargement…">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement de la fiche…
        </div>
      </AdminLayout>
    );
  }

  if (!prospect) {
    return (
      <AdminLayout title="Fiche prospect" subtitle="Introuvable">
        <p className="text-muted-foreground">Ce prospect n'existe plus.</p>
        <Button asChild variant="outline" className="rounded-xl mt-4">
          <Link to="/admin/prospection"><ArrowLeft className="w-4 h-4 mr-2" />Retour à la prospection</Link>
        </Button>
      </AdminLayout>
    );
  }

  const site = STATUTS_SITE[prospect.site_statut];
  const priorite = PRIORITES[prospect.priorite];
  const auditExploitable = audit?.concluant !== false ? audit : null;
  const urgence = auditExploitable ? LIBELLES_URGENCE[auditExploitable.urgence] : null;
  const accessibilite = audit && audit.concluant === false
    ? LIBELLES_ACCESSIBILITE[audit.accessibilite ?? "bloque"]
    : null;

  return (
    <AdminLayout
      title={prospect.enseigne || prospect.nom}
      subtitle={[prospect.code_postal, prospect.ville, prospect.activite_code].filter(Boolean).join(" · ")}
      headerAction={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" asChild>
            <Link to="/admin/prospection"><ArrowLeft className="w-4 h-4 mr-2" />Retour</Link>
          </Button>
          <Button size="sm" className="rounded-xl" onClick={lanceAudit} disabled={enAudit}>
            {enAudit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {enAudit ? "Audit en cours…" : audit ? "Relancer l'audit" : "Lancer l'audit"}
          </Button>
        </div>
      }
    >
      {/* ── Identité et scores ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Badge variant="secondary" className={priorite.classe}>{priorite.label} · {prospect.score}/100</Badge>
        <Badge variant="secondary" className={site.classe}>{site.label}</Badge>
        {urgence && <Badge variant="secondary" className={urgence.classe}>{urgence.label}</Badge>}
        {accessibilite && (
          <Badge variant="secondary" className={accessibilite.classe}>{accessibilite.label}</Badge>
        )}
        <span className="text-xs text-muted-foreground">SIREN {prospect.siren}</span>
        {prospect.site_web && (
          <a
            href={prospect.site_web}
            target="_blank"
            rel="noreferrer"
            className="text-xs inline-flex items-center gap-1 hover:underline"
          >
            {prospect.site_web} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Score
          label="Note globale"
          valeur={auditExploitable?.score_global ?? (audit ? null : prospect.score_audit ?? null)}
        />
        {PILIERS.map((pilier) => (
          <Score
            key={pilier}
            label={LIBELLES_PILIERS[pilier]}
            valeur={auditExploitable ? auditExploitable[`score_${pilier}` as const] : null}
          />
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Défauts par volet ────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm">
            {audit && audit.concluant === false ? (
              <div className="text-sm">
                <p className="font-medium mb-1">Audit non concluant</p>
                <p className="text-muted-foreground">
                  {audit.erreurs[0] ?? "Le site n'a pas pu être analysé."} Aucun défaut n'est
                  affirmé et aucun devis n'est proposé : ouvrez le site à la main, ou relancez
                  l'audit depuis un autre réseau.
                </p>
                <Button size="sm" className="rounded-xl mt-3" onClick={lanceAudit} disabled={enAudit}>
                  {enAudit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Relancer l'audit
                </Button>
              </div>
            ) : !audit ? (
              <div className="text-sm text-muted-foreground">
                <p className="mb-3">
                  Aucun audit pour ce prospect. Lancez-le pour obtenir les notes SEO, design,
                  sécurité et technique, puis la proposition commerciale correspondante.
                </p>
                <Button size="sm" className="rounded-xl" onClick={lanceAudit} disabled={enAudit}>
                  {enAudit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Lancer l'audit complet
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <p className="text-sm font-medium">
                    {audit.findings.length} point(s) relevé(s) — audit {audit.profondeur} du {formateDate(audit.created_at)}
                  </p>
                  {audit.erreurs.length > 0 && (
                    <span className="text-xs text-muted-foreground">Non vérifié : {audit.erreurs.join(" · ")}</span>
                  )}
                </div>
                <Tabs defaultValue="seo">
                  <TabsList className="rounded-xl">
                    {PILIERS.map((pilier) => (
                      <TabsTrigger key={pilier} value={pilier} className="rounded-lg text-xs sm:text-sm">
                        {LIBELLES_PILIERS[pilier]}
                        <span className="ml-1.5 text-muted-foreground">{findingsParPilier[pilier].length}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {PILIERS.map((pilier) => (
                    <TabsContent key={pilier} value={pilier}>
                      <ListeFindings findings={findingsParPilier[pilier]} />
                    </TabsContent>
                  ))}
                </Tabs>
              </>
            )}
          </div>

          {capture && (
            <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm">
              <p className="text-sm font-medium mb-3">Aperçu mobile du site</p>
              <img src={capture} alt="Aperçu mobile du site audité" className="max-w-[280px] rounded-xl border border-border/40" />
            </div>
          )}

          {/* ── Messages de démarchage ─────────────────────────────────── */}
          {documents.length > 0 && (
            <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm">
              <p className="text-sm font-medium mb-3">Messages prêts à envoyer</p>
              <Tabs defaultValue="email">
                <TabsList className="rounded-xl">
                  <TabsTrigger value="email" className="rounded-lg"><Mail className="w-3.5 h-3.5 mr-1.5" />Email</TabsTrigger>
                  <TabsTrigger value="sms" className="rounded-lg"><MessageSquare className="w-3.5 h-3.5 mr-1.5" />SMS</TabsTrigger>
                  <TabsTrigger value="script_appel" className="rounded-lg"><Phone className="w-3.5 h-3.5 mr-1.5" />Appel</TabsTrigger>
                </TabsList>
                {(["email", "sms", "script_appel"] as const).map((type) => {
                  const doc = document_(type);
                  const contenu = type === "email"
                    ? `${doc?.titre ? `Objet : ${doc.titre}\n\n` : ""}${doc?.contenu_md ?? ""}`
                    : doc?.contenu_md ?? "";
                  return (
                    <TabsContent key={type} value={type} className="space-y-2">
                      <pre className="whitespace-pre-wrap text-xs bg-muted/40 rounded-xl p-4 max-h-80 overflow-y-auto font-sans">
                        {contenu || "Non généré"}
                      </pre>
                      {contenu && (
                        <BoutonCopier
                          texte={contenu}
                          libelle={type === "script_appel" ? "Script d'appel" : type.toUpperCase()}
                        />
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </div>
          )}
        </div>

        {/* ── Colonne latérale : proposition et suivi ──────────────────── */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm">
            <p className="text-sm font-medium mb-3">Proposition commerciale</p>

            {devis && devis.lignes.length > 0 ? (
              <>
                <ul className="space-y-2 text-sm">
                  {devis.lignes.map((ligne) => (
                    <li key={ligne.code} className="flex justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate">{ligne.libelle}</span>
                        {ligne.motifs.length > 0 && (
                          <span className="block text-xs text-muted-foreground truncate">
                            {ligne.motifs.slice(0, 2).join(" · ")}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {euros(ligne.total)}{ligne.unite === "mois" ? "/mois" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-border/40 mt-3 pt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Total HT</span><strong className="tabular-nums">{euros(devis.total_ht ?? 0)}</strong></div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>TVA {devis.taux_tva ?? 0} %</span>
                    <span className="tabular-nums">{euros((devis.total_ttc ?? 0) - (devis.total_ht ?? 0))}</span>
                  </div>
                  <div className="flex justify-between text-base"><span>Total TTC</span><strong className="tabular-nums">{euros(devis.total_ttc ?? 0)}</strong></div>
                  {Boolean(devis.mensuel_ht) && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Puis par mois HT</span><span className="tabular-nums">{euros(devis.mensuel_ht ?? 0)}</span>
                    </div>
                  )}
                  {devis.valide_jusqu_au && (
                    <p className="text-xs text-muted-foreground pt-1">Valable jusqu'au {formateDate(devis.valide_jusqu_au)}</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Générez la proposition pour obtenir le devis chiffré, le rapport client et les messages.
              </p>
            )}

            <div className="grid gap-2 mt-4">
              {audit?.concluant === false && (
                <p className="text-xs text-muted-foreground">
                  Proposition indisponible : l'audit n'a rien pu constater.
                </p>
              )}
              <Button
                size="sm"
                className="rounded-xl"
                onClick={() => genere(true)}
                disabled={enGeneration || audit?.concluant === false}
              >
                {enGeneration ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                {devis ? "Régénérer avec l'IA" : "Générer la proposition"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={() => genere(false)}
                disabled={enGeneration || audit?.concluant === false}
              >
                <FileText className="w-4 h-4 mr-2" />
                Générer sans IA
              </Button>
              {rapport?.contenu_html && (
                <>
                  <Button size="sm" variant="outline" className="rounded-xl" asChild>
                    <Link to={`/admin/prospection/${prospect.id}/rapport`}>
                      <Printer className="w-4 h-4 mr-2" />
                      Rapport imprimable
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() =>
                      telechargeFichier(
                        `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Audit ${prospect.nom}</title></head><body>${rapport.contenu_html}</body></html>`,
                        `audit-${prospect.siren}.html`,
                      )}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger le rapport
                  </Button>
                </>
              )}
              {rapport?.genere_par_ia && (
                <p className="text-xs text-muted-foreground">Textes personnalisés par l'IA.</p>
              )}
            </div>
          </div>

          {/* ── Fiche entreprise ────────────────────────────────────────── */}
          <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm space-y-3 text-sm">
            <p className="font-medium">Entreprise</p>
            <p className="text-muted-foreground">
              Créée le {formateDate(prospect.date_creation)} · {prospect.effectif_estime ?? "—"} salarié(s) ·{" "}
              {formateEuros(prospect.chiffre_affaires)}
            </p>
            {prospect.dirigeant && <p>{prospect.dirigeant}</p>}
            <a
              className="flex items-start gap-2 hover:underline"
              href={lienMaps(prospect)}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
              <span>{prospect.adresse ?? [prospect.code_postal, prospect.ville].filter(Boolean).join(" ")}</span>
            </a>
            {prospect.email_contact && (
              <a className="flex items-center gap-2 hover:underline" href={`mailto:${prospect.email_contact}`}>
                <Mail className="w-4 h-4 shrink-0 text-muted-foreground" />{prospect.email_contact}
              </a>
            )}
            {prospect.telephone && (
              <a className="flex items-center gap-2 hover:underline" href={`tel:${prospect.telephone.replace(/\s/g, "")}`}>
                <Phone className="w-4 h-4 shrink-0 text-muted-foreground" />{prospect.telephone}
              </a>
            )}
          </div>

          {/* ── Suivi commercial ───────────────────────────────────────── */}
          <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm">
            <p className="text-sm font-medium mb-3">Suivi commercial</p>
            <Select value={prospect.statut} onValueChange={(v) => changeStatut(v as StatutCommercial)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUTS_COMMERCIAUX.map((s) => (
                  <SelectItem key={s.valeur} value={s.valeur}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Compte rendu d'appel, budget évoqué, prochaine relance…"
              className="rounded-xl min-h-[100px] mt-3"
            />
            <Button
              size="sm"
              className="rounded-xl mt-2"
              onClick={enregistreNotes}
              disabled={notes === (prospect.notes ?? "")}
            >
              Enregistrer les notes
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminProspectDetail;
