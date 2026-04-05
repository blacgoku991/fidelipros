import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Users, ScanLine, Gift, Pencil, Trash2 } from "lucide-react";

interface LocationWithStats {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  manager_user_id: string | null;
  scans_today: number;
  total_customers: number;
  rewards_claimed: number;
}

export default function LocationsPage() {
  const { business } = useAuth();
  const { toast } = useToast();
  const [locations, setLocations] = useState<LocationWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "" });

  const maxLocations = (business as any)?.max_locations ?? 5;

  const fetchLocations = async () => {
    if (!business) return;
    const { data: locs } = await supabase
      .from("merchant_locations")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: true });

    if (!locs) { setLoading(false); return; }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch stats for all locations
    const enriched = await Promise.all(
      locs.map(async (loc) => {
        const [scansRes, customersRes, rewardsRes] = await Promise.all([
          supabase
            .from("points_history")
            .select("*", { count: "exact", head: true })
            .eq("business_id", business.id)
            .eq("location_id", loc.id)
            .gte("created_at", today.toISOString()),
          supabase
            .from("points_history")
            .select("customer_id")
            .eq("business_id", business.id)
            .eq("location_id", loc.id),
          supabase
            .from("points_history")
            .select("*", { count: "exact", head: true })
            .eq("business_id", business.id)
            .eq("location_id", loc.id)
            .eq("action", "reward_claimed"),
        ]);

        const uniqueCustomers = new Set(customersRes.data?.map(r => r.customer_id) || []);

        return {
          ...loc,
          address: loc.address ?? null,
          phone: (loc as any).phone ?? null,
          email: (loc as any).email ?? null,
          manager_user_id: (loc as any).manager_user_id ?? null,
          scans_today: scansRes.count ?? 0,
          total_customers: uniqueCustomers.size,
          rewards_claimed: rewardsRes.count ?? 0,
        } as LocationWithStats;
      })
    );

    setLocations(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchLocations(); }, [business]);

  const handleSave = async () => {
    if (!business || !form.name.trim()) return;

    if (!editingId && locations.length >= maxLocations) {
      toast({ title: "Limite atteinte", description: `Votre plan permet ${maxLocations} établissements maximum.`, variant: "destructive" });
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from("merchant_locations")
        .update({ name: form.name.trim(), address: form.address || null, phone: form.phone || null, email: form.email || null })
        .eq("id", editingId);
      if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Établissement modifié" });
    } else {
      const { error } = await supabase
        .from("merchant_locations")
        .insert({ business_id: business.id, name: form.name.trim(), address: form.address || null, phone: form.phone || null, email: form.email || null });
      if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Établissement ajouté" });
    }

    setDialogOpen(false);
    setEditingId(null);
    setForm({ name: "", address: "", phone: "", email: "" });
    fetchLocations();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cet établissement ? Cette action est irréversible.")) return;
    const { error } = await supabase.from("merchant_locations").delete().eq("id", id);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Établissement supprimé" });
    fetchLocations();
  };

  const openEdit = (loc: LocationWithStats) => {
    setEditingId(loc.id);
    setForm({ name: loc.name, address: loc.address || "", phone: loc.phone || "", email: loc.email || "" });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: "", address: "", phone: "", email: "" });
    setDialogOpen(true);
  };

  return (
    <DashboardLayout
      title="Établissements"
      subtitle={`${locations.length}/${maxLocations} établissements`}
      headerAction={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} disabled={locations.length >= maxLocations}>
              <Plus className="w-4 h-4 mr-2" /> Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Modifier" : "Nouvel"} établissement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Nom *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Point B - Marseille Centre" />
              </div>
              <div>
                <Label>Adresse</Label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="12 rue de la Paix, 13001 Marseille" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Téléphone</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="04 91 00 00 00" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="marseille@pointb.fr" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleSave} disabled={!form.name.trim()}>{editingId ? "Enregistrer" : "Ajouter"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : locations.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun établissement</h3>
            <p className="text-muted-foreground mb-4">Ajoutez votre premier point de vente pour commencer.</p>
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Ajouter un établissement</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map(loc => (
            <Card key={loc.id} className="relative group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base truncate">{loc.name}</CardTitle>
                    {loc.address && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{loc.address}</p>
                    )}
                  </div>
                  <Badge variant={loc.is_active ? "default" : "secondary"} className="ml-2 shrink-0">
                    {loc.is_active ? "Actif" : "Inactif"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/50 rounded-lg p-2">
                    <ScanLine className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold">{loc.scans_today}</p>
                    <p className="text-[10px] text-muted-foreground">Scans auj.</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <Users className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold">{loc.total_customers}</p>
                    <p className="text-[10px] text-muted-foreground">Clients</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <Gift className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold">{loc.rewards_claimed}</p>
                    <p className="text-[10px] text-muted-foreground">Récompenses</p>
                  </div>
                </div>

                {(loc.phone || loc.email) && (
                  <div className="mt-3 text-xs text-muted-foreground space-y-0.5">
                    {loc.phone && <p>{loc.phone}</p>}
                    {loc.email && <p>{loc.email}</p>}
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(loc)}>
                    <Pencil className="w-3 h-3 mr-1" /> Modifier
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(loc.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
