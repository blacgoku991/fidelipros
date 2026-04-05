import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, UserCog, MapPin, Trash2, Mail } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface ManagerRow {
  id: string;
  location_id: string;
  user_id: string;
  role: string;
  invited_at: string;
  accepted_at: string | null;
  location_name: string;
  user_email: string;
}

interface LocationOption {
  id: string;
  name: string;
}

export default function ManagersPage() {
  const { business, user } = useAuth();
  const { toast } = useToast();
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLocationId, setInviteLocationId] = useState("");
  const [inviting, setInviting] = useState(false);

  const fetchManagers = async () => {
    if (!business) return;

    const { data: locs } = await supabase
      .from("merchant_locations")
      .select("id, name")
      .eq("business_id", business.id);
    setLocations(locs || []);

    const { data: lmData } = await supabase
      .from("location_managers")
      .select("*, merchant_locations(name)")
      .in("location_id", (locs || []).map(l => l.id));

    if (!lmData) { setLoading(false); return; }

    // Resolve manager emails from profiles table
    const userIds = lmData.map((lm: any) => lm.user_id).filter(Boolean);
    const { data: profiles } = userIds.length > 0
      ? await supabase.from("profiles").select("id, email").in("id", userIds)
      : { data: [] };
    const emailMap = new Map((profiles || []).map((p: any) => [p.id, p.email]));

    const rows: ManagerRow[] = lmData.map((lm: any) => ({
      id: lm.id,
      location_id: lm.location_id,
      user_id: lm.user_id,
      role: lm.role,
      invited_at: lm.invited_at,
      accepted_at: lm.accepted_at,
      location_name: lm.merchant_locations?.name || "—",
      user_email: (lm as any).invite_email || emailMap.get(lm.user_id) || "",
    }));

    setManagers(rows);
    setLoading(false);
  };

  useEffect(() => { fetchManagers(); }, [business]);

  const handleInvite = async () => {
    if (!business || !user || !inviteEmail.trim() || !inviteLocationId) return;
    setInviting(true);

    try {
      const { data, error } = await supabase.functions.invoke("invite-manager", {
        body: {
          email: inviteEmail.trim(),
          location_id: inviteLocationId,
          business_id: business.id,
        },
      });

      if (error) throw error;

      toast({ title: "Invitation envoyée", description: `Un email a été envoyé à ${inviteEmail.trim()}` });
      setDialogOpen(false);
      setInviteEmail("");
      setInviteLocationId("");
      fetchManagers();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message || "Impossible d'envoyer l'invitation", variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (managerId: string) => {
    if (!confirm("Retirer ce manager ? Il perdra l'accès au dashboard.")) return;

    const { error } = await supabase.from("location_managers").delete().eq("id", managerId);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Manager retiré" });
    fetchManagers();
  };

  return (
    <DashboardLayout
      title="Managers"
      subtitle="Gérez les gérants de vos établissements"
      headerAction={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={locations.length === 0}>
              <UserPlus className="w-4 h-4 mr-2" /> Inviter un manager
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inviter un manager</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Email du manager *</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="manager@example.com"
                />
              </div>
              <div>
                <Label>Établissement *</Label>
                <Select value={inviteLocationId} onValueChange={setInviteLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un établissement" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Le manager recevra un email avec un lien pour créer son compte et accéder au dashboard de l'établissement sélectionné.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim() || !inviteLocationId}>
                {inviting ? "Envoi..." : "Envoyer l'invitation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : managers.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <UserCog className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun manager</h3>
            <p className="text-muted-foreground mb-4">
              Invitez des gérants pour qu'ils puissent scanner et voir les stats de leur établissement.
            </p>
            {locations.length > 0 ? (
              <Button onClick={() => setDialogOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" /> Inviter un manager
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Créez d'abord un établissement.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Manager</TableHead>
                  <TableHead>Établissement</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Invité le</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managers.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{m.user_email || m.user_id.slice(0, 8) + "…"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm">{m.location_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.accepted_at ? (
                        <Badge variant="default">Actif</Badge>
                      ) : (
                        <Badge variant="secondary">En attente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(m.invited_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleRemove(m.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
