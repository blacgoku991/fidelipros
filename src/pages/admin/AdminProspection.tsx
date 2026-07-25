import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2, Download, ExternalLink, Flame, Globe, Loader2, RefreshCw, Search, Wrench,
} from "lucide-react";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { ProspectDetailDialog } from "@/components/admin/ProspectDetailDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ANCIENNETES, chargeProspects, dateIlYaNMois, formateDate, formateEuros, lancerProspection,
  majProspect, PRIORITES, SECTEURS_CIBLES, STATUTS_COMMERCIAUX, STATUTS_SITE, telechargeCsv,
  type ProspectEnregistre, type ProspectionFilters, type StatutCommercial,
} from "@/lib/prospection";
import { cn } from "@/lib/utils";

const EFFECTIFS = [
  { valeur: "toutes", label: "Tous les effectifs", tranches: [] as string[] },
  { valeur: "avec_salaries", label: "Au moins 1 salarié", tranches: ["01", "02", "03", "11", "12", "21", "22"] },
  { valeur: "coeur_cible", label: "3 à 49 salariés (cœur de cible)", tranches: ["02", "03", "11", "12"] },
  { valeur: "dix_plus", label: "10 salariés et plus", tranches: ["11", "12", "21", "22", "31", "32"] },
];

const CA_MINIMUMS = [
  { valeur: "0", label: "Sans minimum" },
  { valeur: "50000", label: "CA ≥ 50 k€" },
  { valeur: "150000", label: "CA ≥ 150 k€" },
  { valeur: "500000", label: "CA ≥ 500 k€" },
];

const CIBLES: Array<{ valeur: NonNullable<ProspectionFilters["cible"]>; label: string; aide: string }> = [
  { valeur: "sans_site", label: "Sans site web", aide: "Création de site : aucune présence en ligne détectée" },
  { valeur: "site_a_refaire", label: "Site à refaire", aide: "Refonte : site obsolète ou non responsive" },
  { valeur: "tous", label: "Les deux", aide: "Toutes les entreprises correspondant aux critères" },
];

const VOLUMES = [
  { valeur: "1", label: "25 entreprises" },
  { valeur: "2", label: "50 entreprises" },
  { valeur: "4", label: "100 entreprises" },
  { valeur: "8", label: "200 entreprises" },
];

function Tuile({
  icone: Icone, label, valeur, accent,
}: { icone: React.ElementType; label: string; valeur: number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icone className={cn("w-4 h-4", accent)} />
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-semibold mt-1.5">{valeur}</p>
    </div>
  );
}

const AdminProspection = () => {
  const [secteurs, setSecteurs] = useState<string[]>([]);
  const [departement, setDepartement] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [motsCles, setMotsCles] = useState("");
  const [anciennete, setAnciennete] = useState("12");
  const [effectif, setEffectif] = useState("toutes");
  const [caMin, setCaMin] = useState("0");
  const [cible, setCible] = useState<NonNullable<ProspectionFilters["cible"]>>("tous");
  const [volume, setVolume] = useState("2");
  const [auditSites, setAuditSites] = useState(true);

  const [prospects, setProspects] = useState<ProspectEnregistre[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState(false);
  const [filtreTexte, setFiltreTexte] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [filtreSite, setFiltreSite] = useState("tous");
  const [selection, setSelection] = useState<ProspectEnregistre | null>(null);

  const recharge = useCallback(async () => {
    setChargement(true);
    try {
      setProspects(await chargeProspects());
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Chargement impossible");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void recharge();
  }, [recharge]);

  const basculeSecteur = (id: string) => {
    setSecteurs((actuels) =>
      actuels.includes(id) ? actuels.filter((s) => s !== id) : [...actuels, id],
    );
  };

  const construitFiltres = (): ProspectionFilters => {
    const mois = ANCIENNETES.find((a) => a.valeur === anciennete)?.mois ?? null;
    const tranches = EFFECTIFS.find((e) => e.valeur === effectif)?.tranches ?? [];
    const activites = SECTEURS_CIBLES.filter((s) => secteurs.includes(s.id)).flatMap((s) => s.naf);
    const ca = Number(caMin);

    return {
      q: motsCles.trim() || undefined,
      departement: departement.trim() || undefined,
      codePostal: codePostal.trim() || undefined,
      activitePrincipale: activites.length ? activites : undefined,
      trancheEffectif: tranches.length ? tranches : undefined,
      creeApres: mois ? dateIlYaNMois(mois) : undefined,
      caMin: ca > 0 ? ca : undefined,
      cible,
      pages: Number(volume),
      auditSites,
    };
  };

  const lance = async () => {
    const filtres = construitFiltres();
    if (!filtres.q && !filtres.departement && !filtres.codePostal && !filtres.activitePrincipale) {
      toast.error("Choisissez au moins un secteur, un département ou un code postal.");
      return;
    }

    setRecherche(true);
    try {
      const resultat = await lancerProspection(filtres);
      toast.success(
        `${resultat.retenus} prospect(s) retenu(s) dont ${resultat.nouveaux} nouveau(x)` +
          (resultat.tronque ? " — recherche interrompue (temps maximum atteint)" : ""),
        { description: `${resultat.total_disponible} entreprise(s) correspondent à ces critères sur l'annuaire.` },
      );
      await recharge();
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "La prospection a échoué");
    } finally {
      setRecherche(false);
    }
  };

  const changeStatut = async (prospect: ProspectEnregistre, statut: StatutCommercial) => {
    setProspects((liste) => liste.map((p) => (p.id === prospect.id ? { ...p, statut } : p)));
    try {
      await majProspect(prospect.id, { statut });
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Mise à jour impossible");
      await recharge();
    }
  };

  const appliqueMaj = (id: string, patch: Partial<ProspectEnregistre>) => {
    setProspects((liste) => liste.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setSelection((courant) => (courant && courant.id === id ? { ...courant, ...patch } : courant));
  };

  const filtres = useMemo(() => {
    const texte = filtreTexte.trim().toLowerCase();
    return prospects.filter((p) => {
      const correspondTexte =
        !texte ||
        p.nom.toLowerCase().includes(texte) ||
        (p.ville ?? "").toLowerCase().includes(texte) ||
        (p.code_postal ?? "").includes(texte) ||
        p.siren.includes(texte);
      const correspondStatut = filtreStatut === "tous" || p.statut === filtreStatut;
      const correspondSite = filtreSite === "tous" || p.site_statut === filtreSite;
      return correspondTexte && correspondStatut && correspondSite;
    });
  }, [prospects, filtreTexte, filtreStatut, filtreSite]);

  const stats = useMemo(
    () => ({
      total: prospects.length,
      chauds: prospects.filter((p) => p.priorite === "chaud").length,
      sansSite: prospects.filter((p) => p.site_statut === "aucun_site" || p.site_statut === "site_injoignable").length,
      aRefaire: prospects.filter((p) => p.site_statut === "site_obsolete" || p.site_statut === "site_a_rafraichir").length,
    }),
    [prospects],
  );

  return (
    <AdminLayout
      title="Prospection web"
      subtitle="Entreprises à démarcher pour créer ou refaire leur site"
      headerAction={
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => telechargeCsv(filtres, `prospects-${new Date().toISOString().slice(0, 10)}.csv`)}
          disabled={!filtres.length}
        >
          <Download className="w-4 h-4 mr-2" />
          Exporter ({filtres.length})
        </Button>
      }
    >
      {/* ── Critères de recherche ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm mb-6">
        <p className="text-sm font-medium mb-3">Secteurs ciblés</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {SECTEURS_CIBLES.map((secteur) => {
            const actif = secteurs.includes(secteur.id);
            return (
              <button
                key={secteur.id}
                type="button"
                onClick={() => basculeSecteur(secteur.id)}
                aria-pressed={actif}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  actif
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 hover:bg-muted",
                )}
              >
                {secteur.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="departement" className="text-xs text-muted-foreground">Département</Label>
            <Input
              id="departement"
              value={departement}
              onChange={(e) => setDepartement(e.target.value)}
              placeholder="33"
              maxLength={3}
              className="rounded-xl mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="code-postal" className="text-xs text-muted-foreground">Code postal</Label>
            <Input
              id="code-postal"
              value={codePostal}
              onChange={(e) => setCodePostal(e.target.value)}
              placeholder="33000"
              maxLength={5}
              className="rounded-xl mt-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="mots-cles" className="text-xs text-muted-foreground">Mots-clés (optionnel)</Label>
            <Input
              id="mots-cles"
              value={motsCles}
              onChange={(e) => setMotsCles(e.target.value)}
              placeholder="restaurant, plombier, salle de sport…"
              className="rounded-xl mt-1.5"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Ancienneté</Label>
            <Select value={anciennete} onValueChange={setAnciennete}>
              <SelectTrigger className="rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANCIENNETES.map((a) => (
                  <SelectItem key={a.valeur} value={a.valeur}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Effectif</Label>
            <Select value={effectif} onValueChange={setEffectif}>
              <SelectTrigger className="rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EFFECTIFS.map((e) => (
                  <SelectItem key={e.valeur} value={e.valeur}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Chiffre d'affaires</Label>
            <Select value={caMin} onValueChange={setCaMin}>
              <SelectTrigger className="rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CA_MINIMUMS.map((c) => (
                  <SelectItem key={c.valeur} value={c.valeur}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Volume analysé</Label>
            <Select value={volume} onValueChange={setVolume}>
              <SelectTrigger className="rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VOLUMES.map((v) => (
                  <SelectItem key={v.valeur} value={v.valeur}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 mt-5">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Objectif commercial</p>
            <div className="flex flex-wrap gap-2">
              {CIBLES.map((c) => (
                <button
                  key={c.valeur}
                  type="button"
                  onClick={() => setCible(c.valeur)}
                  aria-pressed={cible === c.valeur}
                  title={c.aide}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm transition-colors",
                    cible === c.valeur
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 hover:bg-muted",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="audit" checked={auditSites} onCheckedChange={setAuditSites} />
              <Label htmlFor="audit" className="text-sm">Auditer les sites web</Label>
            </div>
            <Button onClick={lance} disabled={recherche} className="rounded-xl">
              {recherche ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              {recherche ? "Recherche en cours…" : "Lancer la prospection"}
            </Button>
          </div>
        </div>
        {!auditSites && (
          <p className="text-xs text-muted-foreground mt-3">
            Sans audit, les entreprises sont importées plus vite mais l'état de leur site reste inconnu :
            le filtre « sans site / site à refaire » ne s'applique pas.
          </p>
        )}
      </div>

      {/* ── Indicateurs ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Tuile icone={Building2} label="Prospects enregistrés" valeur={stats.total} />
        <Tuile icone={Flame} label="Prospects chauds" valeur={stats.chauds} accent="text-rose-500" />
        <Tuile icone={Globe} label="Sans site web" valeur={stats.sansSite} accent="text-violet-500" />
        <Tuile icone={Wrench} label="Sites à refaire" valeur={stats.aRefaire} accent="text-amber-500" />
      </div>

      {/* ── Liste ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={filtreTexte}
            onChange={(e) => setFiltreTexte(e.target.value)}
            placeholder="Rechercher un nom, une ville, un SIREN…"
            className="pl-10 rounded-xl"
          />
        </div>
        <Select value={filtreSite} onValueChange={setFiltreSite}>
          <SelectTrigger className="w-48 rounded-xl"><SelectValue placeholder="État du site" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les sites</SelectItem>
            {Object.entries(STATUTS_SITE).map(([valeur, config]) => (
              <SelectItem key={valeur} value={valeur}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtreStatut} onValueChange={setFiltreStatut}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les statuts</SelectItem>
            {STATUTS_COMMERCIAUX.map((s) => (
              <SelectItem key={s.valeur} value={s.valeur}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="rounded-xl" onClick={recharge} aria-label="Recharger">
          <RefreshCw className={cn("w-4 h-4", chargement && "animate-spin")} />
        </Button>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card overflow-x-auto shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Score</TableHead>
              <TableHead>Entreprise</TableHead>
              <TableHead>Créée le</TableHead>
              <TableHead>Effectif / CA</TableHead>
              <TableHead>Site web</TableHead>
              <TableHead>Priorité</TableHead>
              <TableHead className="w-44">Statut</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtres.map((prospect) => {
              const site = STATUTS_SITE[prospect.site_statut];
              const priorite = PRIORITES[prospect.priorite];
              return (
                <TableRow key={prospect.id} className="cursor-pointer" onClick={() => setSelection(prospect)}>
                  <TableCell className="font-semibold tabular-nums">{prospect.score}</TableCell>
                  <TableCell>
                    <p className="font-medium">{prospect.nom}</p>
                    <p className="text-xs text-muted-foreground">
                      {[prospect.code_postal, prospect.ville].filter(Boolean).join(" ")}
                      {prospect.activite_code ? ` · ${prospect.activite_code}` : ""}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">{formateDate(prospect.date_creation)}</TableCell>
                  <TableCell className="text-sm">
                    {prospect.effectif_estime ?? "—"} sal. · {formateEuros(prospect.chiffre_affaires)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={site.classe}>{site.label}</Badge>
                      {prospect.site_web && (
                        <a
                          href={prospect.site_web}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Ouvrir le site de ${prospect.nom}`}
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={priorite.classe}>{priorite.label}</Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={prospect.statut}
                      onValueChange={(v) => changeStatut(prospect, v as StatutCommercial)}
                    >
                      <SelectTrigger className="rounded-xl h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUTS_COMMERCIAUX.map((s) => (
                          <SelectItem key={s.valeur} value={s.valeur}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setSelection(prospect)}>
                      Détail
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!filtres.length && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  {chargement
                    ? "Chargement…"
                    : prospects.length
                      ? "Aucun prospect ne correspond à ces filtres."
                      : "Aucun prospect pour le moment — lancez une première recherche."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ProspectDetailDialog
        prospect={selection}
        open={Boolean(selection)}
        onOpenChange={(ouvert) => !ouvert && setSelection(null)}
        onEnregistre={appliqueMaj}
      />
    </AdminLayout>
  );
};

export default AdminProspection;
