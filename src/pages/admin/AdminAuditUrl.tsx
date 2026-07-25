import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ExternalLink, FileText, Loader2, Printer, Search, Stethoscope, Wand2 } from "lucide-react";

import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  BandeauNonConcluant, NotesAudit, OngletsPiliers,
} from "@/components/admin/prospection/AffichageAudit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  auditeUrl, chargeProspectsManuels, euros, formateDate, genereProposition,
  LIBELLES_ACCESSIBILITE, LIBELLES_URGENCE,
  type ProspectEnregistre, type ResultatAudit,
} from "@/lib/prospection";

/** Ce que l'audit va chercher, annoncé pendant l'attente (15 à 45 s). */
const ETAPES = [
  "Page d'accueil et redirections",
  "robots.txt, plan de site et page 404",
  "DNS : usurpation d'email (SPF, DMARC)",
  "Lighthouse : performance, accessibilité, capture mobile",
  "Fichiers publics laissés en ligne",
];

const AdminAuditUrl = () => {
  const [url, setUrl] = useState("");
  const [nom, setNom] = useState("");
  const [enAudit, setEnAudit] = useState(false);
  const [enGeneration, setEnGeneration] = useState(false);
  const [resultat, setResultat] = useState<ResultatAudit | null>(null);
  const [propositionFaite, setPropositionFaite] = useState(false);
  const [historique, setHistorique] = useState<ProspectEnregistre[]>([]);

  const rechargeHistorique = useCallback(async () => {
    try {
      setHistorique(await chargeProspectsManuels());
    } catch {
      // L'historique est un confort : son échec ne doit pas gêner l'audit.
    }
  }, []);

  useEffect(() => {
    void rechargeHistorique();
  }, [rechargeHistorique]);

  const lance = async () => {
    const saisie = url.trim();
    if (!saisie || !/\.[a-z]{2,}/i.test(saisie)) {
      toast.error("Saisissez une adresse de site valide, par exemple smartfixx.fr");
      return;
    }

    setEnAudit(true);
    setResultat(null);
    setPropositionFaite(false);
    try {
      const reponse = await auditeUrl(saisie, nom.trim() || undefined);
      setResultat(reponse);
      if (reponse.concluant === false) {
        toast.warning("Audit non concluant", {
          description: reponse.message ?? "Le site n'a pas pu être analysé.",
        });
      } else {
        toast.success(`Audit terminé : ${reponse.audit?.scores.global}/100`, {
          description: `${reponse.audit?.findings.length ?? 0} point(s) relevé(s)`,
        });
      }
      await rechargeHistorique();
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "L'audit a échoué");
    } finally {
      setEnAudit(false);
    }
  };

  const genere = async () => {
    if (!resultat?.prospect_id) return;
    setEnGeneration(true);
    try {
      const proposition = await genereProposition(resultat.prospect_id);
      setPropositionFaite(true);
      toast.success(`Proposition générée : ${euros(proposition.devis.total_ht)} HT`, {
        description: `${proposition.devis.lignes_projet.length} prestation(s) chiffrée(s)`,
      });
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Génération impossible");
    } finally {
      setEnGeneration(false);
    }
  };

  const audit = resultat?.audit ?? null;
  const nonConcluant = resultat?.concluant === false;
  const scores = nonConcluant ? null : audit?.scores ?? null;
  const accessibilite = nonConcluant
    ? LIBELLES_ACCESSIBILITE[resultat?.accessibilite ?? "bloque"]
    : null;

  return (
    <AdminLayout
      title="Auditer un site"
      subtitle="Analyser l'adresse d'un site précis, sans passer par la recherche d'entreprises"
      headerAction={
        <Button variant="outline" size="sm" className="rounded-xl" asChild>
          <Link to="/admin/prospection">
            <Search className="w-4 h-4 mr-2" />
            Trouver des prospects
          </Link>
        </Button>
      }
    >
      {/* ── Saisie ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm mb-6">
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="url" className="text-xs text-muted-foreground">Adresse du site</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !enAudit && lance()}
              placeholder="smartfixx.fr"
              className="rounded-xl mt-1.5"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="nom" className="text-xs text-muted-foreground">
              Nom de l'entreprise (optionnel)
            </Label>
            <Input
              id="nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !enAudit && lance()}
              placeholder="Déduit du domaine"
              className="rounded-xl mt-1.5"
            />
          </div>
          <Button onClick={lance} disabled={enAudit} className="rounded-xl">
            {enAudit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Stethoscope className="w-4 h-4 mr-2" />}
            {enAudit ? "Analyse en cours…" : "Auditer le site"}
          </Button>
        </div>

        {enAudit && (
          <div className="mt-5 border-t border-border/40 pt-4">
            <p className="text-sm text-muted-foreground mb-2">
              Analyse de {url.trim()} — comptez 15 à 45 secondes.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              {ETAPES.map((etape) => (
                <li key={etape} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{etape}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!enAudit && !resultat && (
          <p className="text-xs text-muted-foreground mt-4">
            Le site analysé est enregistré comme prospect : vous pourrez enchaîner sur le devis,
            le rapport client et le suivi commercial depuis sa fiche.
          </p>
        )}
      </div>

      {/* ── Résultat ──────────────────────────────────────────────────── */}
      {resultat && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            {audit?.urlFinale && (
              <a
                href={audit.urlFinale}
                target="_blank"
                rel="noreferrer"
                className="text-sm inline-flex items-center gap-1 hover:underline"
              >
                {audit.urlFinale} <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {scores && (
              <Badge variant="secondary" className={LIBELLES_URGENCE[scores.urgence].classe}>
                {LIBELLES_URGENCE[scores.urgence].label}
              </Badge>
            )}
            {accessibilite && (
              <Badge variant="secondary" className={accessibilite.classe}>{accessibilite.label}</Badge>
            )}
          </div>

          {nonConcluant ? (
            <BandeauNonConcluant
              raison={resultat.message ?? audit?.erreurs[0] ?? "Le site n'a pas pu être analysé."}
              action={
                <Button size="sm" className="rounded-xl" onClick={lance} disabled={enAudit}>
                  Relancer l'audit
                </Button>
              }
            />
          ) : (
            <>
              <NotesAudit
                global={scores?.global ?? null}
                seo={scores?.seo ?? null}
                design={scores?.design ?? null}
                securite={scores?.securite ?? null}
                technique={scores?.technique ?? null}
              />

              <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <p className="text-sm font-medium">
                    {audit?.findings.length ?? 0} point(s) relevé(s)
                  </p>
                  {Boolean(audit?.erreurs.length) && (
                    <span className="text-xs text-muted-foreground">
                      Non vérifié : {audit?.erreurs.join(" · ")}
                    </span>
                  )}
                </div>
                <OngletsPiliers findings={audit?.findings ?? []} />
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={genere} disabled={enGeneration || nonConcluant} className="rounded-xl">
              {enGeneration ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
              Générer la proposition
            </Button>
            {resultat.prospect_id && (
              <Button variant="outline" className="rounded-xl" asChild>
                <Link to={`/admin/prospection/${resultat.prospect_id}`}>
                  <FileText className="w-4 h-4 mr-2" />
                  Ouvrir la fiche
                </Link>
              </Button>
            )}
            {propositionFaite && resultat.prospect_id && (
              <Button variant="outline" className="rounded-xl" asChild>
                <Link to={`/admin/prospection/${resultat.prospect_id}/rapport`}>
                  <Printer className="w-4 h-4 mr-2" />
                  Rapport imprimable
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Historique ────────────────────────────────────────────────── */}
      {historique.length > 0 && (
        <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm mt-6">
          <p className="text-sm font-medium mb-3">Derniers sites audités à la main</p>
          <ul className="divide-y divide-border/40">
            {historique.map((prospect) => (
              <li key={prospect.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/admin/prospection/${prospect.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {prospect.nom}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">
                    {prospect.site_web ?? "—"} · {formateDate(prospect.audit_le)}
                  </p>
                </div>
                <span className="text-sm tabular-nums shrink-0">
                  {prospect.score_audit ?? "—"}
                  <span className="text-xs text-muted-foreground">/100</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminAuditUrl;
