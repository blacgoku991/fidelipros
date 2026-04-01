import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { AlertCircle, Gift, Clock, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

interface Suggestion {
  icon: React.ElementType;
  text: string;
  action: string;
  link: string;
  variant: "warning" | "success" | "info";
}

export function SmartSuggestions() {
  const { business } = useAuth();
  const businessId = (business as any)?.id;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (!businessId) return;
    const compute = async () => {
      const [customersRes, cardsRes] = await Promise.all([
        supabase.from("customers").select("id, last_visit_at, total_visits").eq("business_id", businessId),
        supabase.from("customer_cards").select("current_points, max_points").eq("business_id", businessId).eq("is_active", true),
      ]);

      const customers = customersRes.data || [];
      const cards = cardsRes.data || [];
      const items: Suggestion[] = [];

      // Inactive clients
      const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const inactive = customers.filter((c: any) => !c.last_visit_at || new Date(c.last_visit_at) < sevenDaysAgo).length;
      if (inactive > 0) {
        items.push({
          icon: Clock,
          text: `${inactive} client${inactive > 1 ? "s" : ""} inactif${inactive > 1 ? "s" : ""} depuis 7 jours`,
          action: "Relancer",
          link: "/dashboard/campaigns",
          variant: "warning",
        });
      }

      // Close to reward
      const closeToReward = cards.filter((c: any) => {
        const remaining = (c.max_points || 10) - (c.current_points || 0);
        return remaining > 0 && remaining <= 2;
      }).length;
      if (closeToReward > 0) {
        items.push({
          icon: Gift,
          text: `${closeToReward} client${closeToReward > 1 ? "s" : ""} proche${closeToReward > 1 ? "s" : ""} d'une récompense`,
          action: "Voir",
          link: "/dashboard/clients",
          variant: "success",
        });
      }

      // No automations
      const { count: autoCount } = await supabase.from("automations").select("*", { count: "exact", head: true }).eq("business_id", businessId).eq("is_active", true);
      if (!autoCount || autoCount === 0) {
        items.push({
          icon: Sparkles,
          text: "Activez les automations pour engager vos clients automatiquement",
          action: "Configurer",
          link: "/dashboard/automations",
          variant: "info",
        });
      }

      setSuggestions(items.slice(0, 3));
    };
    compute();
  }, [businessId]);

  if (suggestions.length === 0) return null;

  const variantStyles = {
    warning: "border-amber-500/20 bg-amber-500/5",
    success: "border-emerald-500/20 bg-emerald-500/5",
    info: "border-primary/20 bg-primary/5",
  };

  return (
    <div className="space-y-2">
      <h3 className="font-display font-semibold text-sm flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" /> Suggestions
      </h3>
      {suggestions.map((s, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
          className={`flex items-center gap-3 p-3 rounded-xl border ${variantStyles[s.variant]}`}>
          <s.icon className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-sm flex-1">{s.text}</p>
          <Button asChild variant="ghost" size="sm" className="rounded-lg text-xs shrink-0">
            <Link to={s.link}>{s.action}</Link>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}
