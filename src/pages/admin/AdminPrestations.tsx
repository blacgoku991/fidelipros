import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { chargePrestations, euros, majPrestation, type Prestation } from "@/lib/prospection";

interface PrestationEnregistree extends Prestation {
  id: string;
}

/** Champs `site_settings` qui alimentent l'en-tête et le pied des devis. */
const CHAMPS_DEVIS: Array<{ cle: string; label: string; aide?: string; multiligne?: boolean }> = [
  { cle: "devis_raison_sociale", label: "Raison sociale" },
  { cle: "devis_siret", label: "SIRET" },
  { cle: "devis_adresse", label: "Adresse" },
  { cle: "devis_email", label: "Email" },
  { cle: "devis_telephone", label: "Téléphone" },
  { cle: "devis_taux_tva", label: "Taux de TVA (%)", aide: "0 si vous n'êtes pas assujetti" },
  { cle: "devis_validite_jours", label: "Validité du devis (jours)" },
  { cle: "devis_mentions", label: "Mentions du devis", multiligne: true },
];

const AdminPrestations = () => {
  const [prestations, setPrestations] = useState<PrestationEnregistree[]>([]);
  const [reglages, setReglages] = useState<Record<string, string>>({});
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);

  const recharge = useCallback(async () => {
    setChargement(true);
    try {
      const [catalogue, { data }] = await Promise.all([
        chargePrestations(),
        supabase.from("site_settings").select("key, value").like("key", "devis_%"),
      ]);
      setPrestations(catalogue as PrestationEnregistree[]);
      const map: Record<string, string> = {};
      (data ?? []).forEach((row: { key: string; value: string }) => { map[row.key] = row.value; });
      setReglages(map);
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Chargement impossible");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void recharge();
  }, [recharge]);

  const modifie = (id: string, patch: Partial<PrestationEnregistree>) => {
    setPrestations((liste) => liste.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const enregistrePrestation = async (prestation: PrestationEnregistree) => {
    try {
      await majPrestation(prestation.id, {
        libelle: prestation.libelle,
        description: prestation.description,
        prix: prestation.prix,
        unite: prestation.unite,
        actif: prestation.actif,
      });
      toast.success(`${prestation.libelle} enregistrée`);
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Enregistrement impossible");
    }
  };

  const enregistreReglages = async () => {
    setEnregistrement(true);
    try {
      const lignes = CHAMPS_DEVIS.map((champ) => ({
        key: champ.cle,
        value: reglages[champ.cle] ?? "",
      }));
      const { error } = await supabase.from("site_settings").upsert(lignes, { onConflict: "key" });
      if (error) throw new Error(error.message);
      toast.success("Informations du devis enregistrées");
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Enregistrement impossible");
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <AdminLayout
      title="Prestations & devis"
      subtitle="Tarifs utilisés pour chiffrer automatiquement les propositions"
    >
      <div className="rounded-2xl border border-border/40 bg-card overflow-x-auto shadow-sm mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prestation</TableHead>
              <TableHead className="w-32">Prix</TableHead>
              <TableHead className="w-24">Unité</TableHead>
              <TableHead className="w-20">Active</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {prestations.map((prestation) => (
              <TableRow key={prestation.id}>
                <TableCell>
                  <Input
                    value={prestation.libelle}
                    onChange={(e) => modifie(prestation.id, { libelle: e.target.value })}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{prestation.description}</p>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    step={10}
                    value={prestation.prix}
                    onChange={(e) => modifie(prestation.id, { prix: Number(e.target.value) })}
                    className="rounded-xl tabular-nums"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{euros(prestation.prix)}</p>
                </TableCell>
                <TableCell className="text-sm">
                  {prestation.unite === "mois" ? "par mois" : "forfait"}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={prestation.actif !== false}
                    onCheckedChange={(actif) => modifie(prestation.id, { actif })}
                    aria-label={`Activer ${prestation.libelle}`}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => enregistrePrestation(prestation)}
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!prestations.length && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  {chargement ? "Chargement…" : "Aucune prestation au catalogue."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm">
        <p className="text-sm font-medium mb-1">Informations portées sur le devis</p>
        <p className="text-xs text-muted-foreground mb-4">
          Ces informations apparaissent dans l'en-tête du rapport et dans le pied du devis envoyé au prospect.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {CHAMPS_DEVIS.map((champ) => (
            <div key={champ.cle} className={champ.multiligne ? "sm:col-span-2" : undefined}>
              <Label htmlFor={champ.cle} className="text-xs text-muted-foreground">{champ.label}</Label>
              {champ.multiligne ? (
                <Textarea
                  id={champ.cle}
                  value={reglages[champ.cle] ?? ""}
                  onChange={(e) => setReglages({ ...reglages, [champ.cle]: e.target.value })}
                  className="rounded-xl mt-1.5 min-h-[80px]"
                />
              ) : (
                <Input
                  id={champ.cle}
                  value={reglages[champ.cle] ?? ""}
                  onChange={(e) => setReglages({ ...reglages, [champ.cle]: e.target.value })}
                  className="rounded-xl mt-1.5"
                />
              )}
              {champ.aide && <p className="text-xs text-muted-foreground mt-1">{champ.aide}</p>}
            </div>
          ))}
        </div>
        <Button className="rounded-xl mt-4" onClick={enregistreReglages} disabled={enregistrement}>
          {enregistrement ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Enregistrer
        </Button>
      </div>
    </AdminLayout>
  );
};

export default AdminPrestations;
