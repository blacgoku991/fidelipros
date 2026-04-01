import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Mail, Eye, Trash2, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  new: { label: "Nouveau", icon: AlertCircle, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  read: { label: "Lu", icon: Eye, color: "bg-muted text-muted-foreground" },
  handled: { label: "Traité", icon: CheckCircle, color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
};

const AdminMessages = () => {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<any>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["admin-contact-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_messages" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("contact_messages" as any)
        .update({ status } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-contact-messages"] });
    },
  });

  const deleteMsg = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contact_messages" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-contact-messages"] });
      setSelected(null);
      toast.success("Message supprimé");
    },
  });

  const openMessage = (msg: any) => {
    setSelected(msg);
    if (msg.status === "new") {
      updateStatus.mutate({ id: msg.id, status: "read" });
    }
  };

  const newCount = messages.filter((m: any) => m.status === "new").length;

  return (
    <AdminGuard>
      <AdminLayout title="Messages de contact">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold flex items-center gap-3">
                <Mail className="w-6 h-6 text-primary" />
                Messages de contact
                {newCount > 0 && (
                  <Badge className="bg-blue-500 text-white text-xs">{newCount} nouveau{newCount > 1 ? "x" : ""}</Badge>
                )}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{messages.length} message{messages.length > 1 ? "s" : ""} reçu{messages.length > 1 ? "s" : ""}</p>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Chargement…</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Aucun message pour le moment</p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((msg: any) => {
                const st = statusConfig[msg.status] || statusConfig.new;
                const StIcon = st.icon;
                return (
                  <button
                    key={msg.id}
                    onClick={() => openMessage(msg)}
                    className={`w-full text-left rounded-xl border p-4 transition-colors hover:bg-secondary/50 ${
                      msg.status === "new" ? "border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20" : "border-border/50 bg-card"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        <StIcon className={`w-4 h-4 ${msg.status === "new" ? "text-blue-500" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-semibold text-sm ${msg.status === "new" ? "text-foreground" : "text-muted-foreground"}`}>
                            {msg.full_name}
                          </span>
                          <span className="text-xs text-muted-foreground">— {msg.email}</span>
                        </div>
                        <p className="text-sm font-medium truncate">{msg.subject}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.message}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <Badge className={`${st.color} text-[10px]`}>{st.label}</Badge>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {format(new Date(msg.created_at), "d MMM HH:mm", { locale: fr })}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-lg rounded-2xl">
            {selected && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-lg">{selected.subject}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-semibold">{selected.full_name}</span>
                    <a href={`mailto:${selected.email}`} className="text-primary hover:underline">{selected.email}</a>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {format(new Date(selected.created_at), "d MMMM yyyy à HH:mm", { locale: fr })}
                  </div>
                  <div className="rounded-xl bg-secondary/30 p-4 text-sm whitespace-pre-wrap leading-relaxed">
                    {selected.message}
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    {selected.status !== "handled" && (
                      <Button
                        size="sm"
                        className="rounded-xl gap-1.5"
                        onClick={() => { updateStatus.mutate({ id: selected.id, status: "handled" }); setSelected({ ...selected, status: "handled" }); toast.success("Marqué comme traité"); }}
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Marquer traité
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl gap-1.5"
                      asChild
                    >
                      <a href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}>
                        <Mail className="w-3.5 h-3.5" /> Répondre par email
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl gap-1.5 text-destructive hover:text-destructive ml-auto"
                      onClick={() => deleteMsg.mutate(selected.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Supprimer
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminMessages;
