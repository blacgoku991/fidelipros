import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Shield, LogIn, LogOut, Trash2, Edit, Eye } from "lucide-react";

const actionConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  impersonation_start: { label: "Impersonation", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", icon: LogIn },
  impersonation_stop: { label: "Fin impersonation", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: LogOut },
  delete_business: { label: "Suppression", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: Trash2 },
  update_plan: { label: "Changement plan", color: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400", icon: Edit },
  update_status: { label: "Changement statut", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", icon: Edit },
};

const AdminAuditLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [bizNames, setBizNames] = useState<Record<string, string>>({});

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    const { data } = await supabase
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!data) return;
    setLogs(data);

    // Fetch admin profiles
    const adminIds = [...new Set(data.map(l => l.admin_user_id))];
    if (adminIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", adminIds);
      const map: Record<string, string> = {};
      profs?.forEach(p => { map[p.id] = p.full_name || p.email || p.id.slice(0, 8); });
      setProfiles(map);
    }

    // Fetch business names
    const bizIds = [...new Set(data.filter(l => l.target_business_id).map(l => l.target_business_id))];
    if (bizIds.length) {
      const { data: bizs } = await supabase.from("businesses").select("id, name").in("id", bizIds);
      const map: Record<string, string> = {};
      bizs?.forEach(b => { map[b.id] = b.name; });
      setBizNames(map);
    }
  };

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      (profiles[l.admin_user_id] || "").toLowerCase().includes(search.toLowerCase()) ||
      (bizNames[l.target_business_id] || "").toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === "all" || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  const uniqueActions = [...new Set(logs.map(l => l.action))];

  return (
    <AdminLayout title="Journal d'audit" subtitle={`${logs.length} entrée(s)`}>
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="pl-10 rounded-xl" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les actions</SelectItem>
            {uniqueActions.map(a => (
              <SelectItem key={a} value={a}>{actionConfig[a]?.label || a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card overflow-x-auto shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Cible</TableHead>
              <TableHead>Détails</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Aucune entrée dans le journal
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(log => {
                const cfg = actionConfig[log.action] || { label: log.action, color: "bg-muted text-muted-foreground", icon: Eye };
                const ActionIcon = cfg.icon;
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {profiles[log.admin_user_id] || log.admin_user_id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <Badge className={`gap-1 text-[10px] ${cfg.color}`}>
                        <ActionIcon className="w-3 h-3" />
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.target_business_id ? (bizNames[log.target_business_id] || log.target_business_id.slice(0, 8)) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {log.metadata ? JSON.stringify(log.metadata) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
};

export default AdminAuditLogs;
