import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Zap, Plus, Clock, Users, MapPin, Gift, Calendar, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const TRIGGER_TYPES = [
  { value: "inactive_days", label: "Client inactif", icon: Clock, desc: "Relance après X jours d'inactivité" },
  { value: "reward_reached", label: "Récompense atteinte", icon: Gift, desc: "Notifier quand le client atteint sa récompense" },
  { value: "birthday", label: "Anniversaire", icon: Calendar, desc: "Message automatique le jour de l'anniversaire" },
  { value: "nearby", label: "Proximité", icon: MapPin, desc: "Notification quand le client passe à proximité" },
];

const SEGMENTS = [
  { value: "all", label: "Tous les clients" },
  { value: "bronze", label: "Bronze" },
  { value: "silver", label: "Silver" },
  { value: "gold", label: "Gold" },
  { value: "inactive", label: "Inactifs" },
  { value: "vip", label: "VIP" },
];

interface Automation {
  id: string;
  trigger_type: string;
  trigger_value: number;
  title: string;
  message: string;
  target_segment: string;
  cooldown_hours: number;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

const AutomationsPage = () => {
  const { business } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    trigger_type: "inactive_days",
    trigger_value: 7,
    title: "",
    message: "",
    target_segment: "all",
    cooldown_hours: 24,
    is_active: true,
  });

  const businessId = (business as any)?.id;

  useEffect(() => {
    if (businessId) fetchAutomations();
  }, [businessId]);

  const fetchAutomations = async () => {
    const { data } = await supabase
      .from("automations")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    setAutomations((data as any[]) || []);
  };

  const resetForm = () => {
    setForm({ trigger_type: "inactive_days", trigger_value: 7, title: "", message: "", target_segment: "all", cooldown_hours: 24, is_active: true });
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.title || !form.message) {
      toast.error("Titre et message requis");
      return;
    }

    if (editingId) {
      await supabase.from("automations").update({ ...form } as any).eq("id", editingId);
      toast.success("Automation mise à jour");
    } else {
      await supabase.from("automations").insert({ ...form, business_id: businessId } as any);
      toast.success("Automation créée");
    }
    setDialogOpen(false);
    resetForm();
    fetchAutomations();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("automations").delete().eq("id", id);
    toast.success("Automation supprimée");
    fetchAutomations();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("automations").update({ is_active: active } as any).eq("id", id);
    fetchAutomations();
  };

  const handleEdit = (a: Automation) => {
    setForm({
      trigger_type: a.trigger_type,
      trigger_value: a.trigger_value,
      title: a.title,
      message: a.message,
      target_segment: a.target_segment,
      cooldown_hours: a.cooldown_hours,
      is_active: a.is_active,
    });
    setEditingId(a.id);
    setDialogOpen(true);
  };

  const getTriggerConfig = (type: string) => TRIGGER_TYPES.find(t => t.value === type) || TRIGGER_TYPES[0];

  return (
    <DashboardLayout title="Automations" subtitle="Engagez vos clients automatiquement"
      headerAction={
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2">
              <Plus className="w-4 h-4" /> Nouvelle automation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Modifier" : "Créer"} une automation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Déclencheur</Label>
                <Select value={form.trigger_type} onValueChange={v => setForm(f => ({ ...f, trigger_type: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-2">
                          <t.icon className="w-4 h-4" /> {t.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">{getTriggerConfig(form.trigger_type).desc}</p>
              </div>

              {form.trigger_type === "inactive_days" && (
                <div>
                  <Label>Jours d'inactivité</Label>
                  <Input type="number" min={1} value={form.trigger_value} onChange={e => setForm(f => ({ ...f, trigger_value: +e.target.value }))} className="rounded-xl" />
                </div>
              )}

              <div>
                <Label>Segment cible</Label>
                <Select value={form.target_segment} onValueChange={v => setForm(f => ({ ...f, target_segment: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Titre de la notification</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Vous nous manquez !" className="rounded-xl" />
              </div>

              <div>
                <Label>Message</Label>
                <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Ex: -20% aujourd'hui pour vous !" className="rounded-xl" rows={3} />
              </div>

              <div>
                <Label>Cooldown (heures)</Label>
                <Input type="number" min={1} value={form.cooldown_hours} onChange={e => setForm(f => ({ ...f, cooldown_hours: +e.target.value }))} className="rounded-xl" />
                <p className="text-xs text-muted-foreground mt-1">Délai minimum entre deux envois au même client</p>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label>Activer immédiatement</Label>
              </div>

              <Button onClick={handleSave} className="w-full rounded-xl">{editingId ? "Mettre à jour" : "Créer l'automation"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      {automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-lg mb-1">Aucune automation</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            Créez des automations pour envoyer automatiquement des notifications à vos clients au bon moment.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {automations.map((a, i) => {
            const trigger = getTriggerConfig(a.trigger_type);
            return (
              <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.is_active ? "bg-primary/10" : "bg-muted"}`}>
                      <trigger.icon className={`w-5 h-5 ${a.is_active ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{trigger.label}</p>
                    </div>
                  </div>
                  <Switch checked={a.is_active} onCheckedChange={v => handleToggle(a.id, v)} />
                </div>

                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{a.message}</p>

                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <Badge variant="outline" className="text-[10px]">{SEGMENTS.find(s => s.value === a.target_segment)?.label}</Badge>
                  <Badge variant="outline" className="text-[10px]">
                    <Clock className="w-3 h-3 mr-1" /> {a.cooldown_hours}h cooldown
                  </Badge>
                  {a.trigger_type === "inactive_days" && (
                    <Badge variant="outline" className="text-[10px]">{a.trigger_value} jours</Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="rounded-lg text-xs gap-1" onClick={() => handleEdit(a)}>
                    <Edit className="w-3 h-3" /> Modifier
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-lg text-xs gap-1 text-destructive hover:text-destructive" onClick={() => handleDelete(a.id)}>
                    <Trash2 className="w-3 h-3" /> Supprimer
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
};

export default AutomationsPage;
