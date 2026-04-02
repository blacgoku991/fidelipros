import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Shield, Building2, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const AdminUsers = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    const [profilesRes, rolesRes, bizRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("businesses").select("id, name, owner_id, subscription_plan, subscription_status"),
    ]);

    const roles = (rolesRes.data || []).reduce((acc: Record<string, string>, r: any) => {
      acc[r.user_id] = r.role; return acc;
    }, {});

    const bizMap = (bizRes.data || []).reduce((acc: Record<string, any>, b: any) => {
      acc[b.owner_id] = b; return acc;
    }, {});

    const merged = (profilesRes.data || []).map((p: any) => ({
      ...p,
      role: roles[p.id] || "business_owner",
      business: bizMap[p.id] || null,
    }));
    setUsers(merged);
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "super_admin" ? "business_owner" : "super_admin";
    await supabase.from("user_roles").update({ role: newRole as any }).eq("user_id", userId);
    toast.success(`Rôle mis à jour : ${newRole}`);
    fetchUsers();
  };

  const handleDeleteUser = async (user: any) => {
    setDeleting(true);
    try {
      const userId = user.id;
      const bizId = user.business?.id;

      if (bizId) {
        // Delete all business-related data
        await Promise.all([
          supabase.from("points_history").delete().eq("business_id", bizId),
          supabase.from("customer_scores").delete().eq("business_id", bizId),
          supabase.from("notifications_log").delete().eq("business_id", bizId),
          supabase.from("notification_campaigns").delete().eq("business_id", bizId),
          supabase.from("notification_templates").delete().eq("business_id", bizId),
          supabase.from("automations").delete().eq("business_id", bizId),
          supabase.from("special_events").delete().eq("business_id", bizId),
          supabase.from("wallet_registrations").delete().eq("business_id", bizId),
          supabase.from("digest_logs").delete().eq("merchant_id", bizId),
          supabase.from("merchant_locations").delete().eq("business_id", bizId),
          supabase.from("user_merchant_points").delete().eq("business_id", bizId),
          supabase.from("demo_sessions").delete().eq("business_id", bizId),
          supabase.from("rewards").delete().eq("business_id", bizId),
        ]);
        await supabase.from("customer_cards").delete().eq("business_id", bizId);
        await supabase.from("customers").delete().eq("business_id", bizId);
        await supabase.from("businesses").delete().eq("id", bizId);
      }

      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("profiles").delete().eq("id", userId);

      toast.success(`Utilisateur "${user.full_name || user.email}" supprimé`);
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  const exportCSV = () => {
    const headers = ["Nom", "Email", "Rôle", "Entreprise", "Plan", "Inscrit le"];
    const rows = filtered.map((u) => [
      u.full_name || "", u.email || "", u.role, u.business?.name || "",
      u.business?.subscription_plan || "", new Date(u.created_at).toLocaleDateString("fr-FR"),
    ]);
    const csv = [headers.join(","), ...rows.map((r: string[]) => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `utilisateurs_${new Date().toISOString().split("T")[0]}.csv`; link.click();
  };

  const filtered = users.filter((u) => {
    const matchSearch = !search ||
      (u.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <AdminLayout title="Utilisateurs" subtitle={`${users.length} utilisateur(s)`}
      headerAction={
        <Button variant="outline" className="rounded-xl gap-2 text-xs" onClick={exportCSV}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      }>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom ou email..." className="pl-10 rounded-xl" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40 rounded-xl"><SelectValue placeholder="Rôle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
            <SelectItem value="business_owner">Commerçant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Entreprise</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Statut abo</TableHead>
              <TableHead>Inscrit le</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                      {(u.full_name || u.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{u.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={u.role === "super_admin"
                    ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                  }>
                    {u.role === "super_admin" ? (
                      <><Shield className="w-3 h-3 mr-1" /> Admin</>
                    ) : (
                      <><Building2 className="w-3 h-3 mr-1" /> Commerçant</>
                    )}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{u.business?.name || "—"}</TableCell>
                <TableCell>
                  {u.business ? (
                    <Badge variant="outline" className="text-[10px] capitalize">{u.business.subscription_plan}</Badge>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {u.business ? (
                    <Badge className={
                      u.business.subscription_status === "active" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]" :
                      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-[10px]"
                    }>{u.business.subscription_status}</Badge>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString("fr-FR")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" className="text-xs h-8"
                      onClick={() => toggleRole(u.id, u.role)}>
                      {u.role === "super_admin" ? "Rétrograder" : "Promouvoir"}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Supprimer" onClick={() => setDeleteTarget(u)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete user confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous allez supprimer <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong>
              {deleteTarget?.business && <> ainsi que son entreprise <strong>{deleteTarget.business.name}</strong> et toutes ses données associées (clients, cartes, historique…)</>}.
              <br /><br />
              <span className="text-destructive font-medium">Cette action est irréversible.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => deleteTarget && handleDeleteUser(deleteTarget)}>
              {deleting ? "Suppression…" : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminUsers;
