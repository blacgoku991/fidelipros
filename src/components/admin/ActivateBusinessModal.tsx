import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { businessTemplates } from "@/lib/businessTemplates";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

interface Props {
  business: any | null;
  open: boolean;
  onClose: () => void;
  onActivated: () => void;
}

export function ActivateBusinessModal({ business, open, onClose, onActivated }: Props) {
  const [plan, setPlan] = useState<string>(business?.subscription_plan ?? "pro");
  const [template, setTemplate] = useState<string>(business?.business_template ?? "restaurant");
  const [isFranchise, setIsFranchise] = useState<boolean>(!!business?.is_franchise);
  const [maxLocations, setMaxLocations] = useState<number>(business?.max_locations ?? 1);
  const [expiresAt, setExpiresAt] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [saving, setSaving] = useState(false);

  // Sync defaults when business changes
  useState(() => {
    if (business) {
      setPlan(business.subscription_plan ?? "pro");
      setTemplate(business.business_template ?? "restaurant");
      setIsFranchise(!!business.is_franchise);
      setMaxLocations(business.max_locations ?? 1);
    }
  });

  const handleSubmit = async () => {
    if (!business) return;
    setSaving(true);
    const { error } = await (supabase as any).rpc("admin_activate_business", {
      p_business_id: business.id,
      p_plan: plan,
      p_template: template,
      p_is_franchise: isFranchise,
      p_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      p_max_locations: isFranchise ? Math.max(1, maxLocations) : 1,
    });
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error(error.message || "Erreur lors de l'activation");
      return;
    }
    toast.success(`${business.name} activé avec succès`);
    onActivated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Activer {business?.name}
          </DialogTitle>
          <DialogDescription>
            Attribuer un plan et un template à ce commerce. L'activation est immédiate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs">Plan</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="franchise">Franchise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Template métier</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                {businessTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.emoji} {t.label}
                    {t.superAdminOnly ? " 🔒" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Date d'expiration</Label>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="rounded-xl"
            />
            <p className="text-[10px] text-muted-foreground">
              Optionnel — laisser vide pour ne pas définir d'expiration.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
            <div>
              <Label className="text-xs cursor-pointer">Mode franchise multi-sites</Label>
              <p className="text-[10px] text-muted-foreground">
                Active la gestion d'établissements
              </p>
            </div>
            <Switch checked={isFranchise} onCheckedChange={setIsFranchise} />
          </div>

          {isFranchise && (
            <div className="space-y-2">
              <Label className="text-xs">Nombre maximum d'établissements</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={maxLocations}
                onChange={(e) => setMaxLocations(Number(e.target.value) || 1)}
                className="rounded-xl"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="rounded-xl gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Activer le compte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
