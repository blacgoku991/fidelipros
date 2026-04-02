import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Repeat, Gift, TrendingUp, Users } from "lucide-react";
import { motion } from "framer-motion";

export function BusinessResults() {
  const { business } = useAuth();
  const businessId = business?.id;
  const [stats, setStats] = useState({ returning: 0, rewardsUnlocked: 0, totalScans: 0, activeClients: 0 });

  useEffect(() => {
    if (!businessId) return;
    const fetchStats = async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [customersRes, scansRes, cardsRes] = await Promise.all([
        supabase.from("customers").select("total_visits, last_visit_at").eq("business_id", businessId),
        supabase.from("points_history").select("*", { count: "exact", head: true }).eq("business_id", businessId).gte("created_at", monthStart),
        supabase.from("customer_cards").select("rewards_earned").eq("business_id", businessId),
      ]);

      const customers = customersRes.data || [];
      const returning = customers.filter((c: any) => (c.total_visits || 0) > 1 && c.last_visit_at && new Date(c.last_visit_at) >= new Date(monthStart)).length;
      const rewardsUnlocked = (cardsRes.data || []).reduce((s: number, c: any) => s + (c.rewards_earned || 0), 0);
      const activeClients = customers.filter((c: any) => {
        const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
        return c.last_visit_at && new Date(c.last_visit_at) >= thirtyAgo;
      }).length;

      setStats({ returning, rewardsUnlocked, totalScans: scansRes.count || 0, activeClients });
    };
    fetchStats();
  }, [businessId]);

  const items = [
    { icon: Repeat, label: "Clients revenus", value: stats.returning, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
    { icon: Gift, label: "Récompenses", value: stats.rewardsUnlocked, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
    { icon: TrendingUp, label: "Scans ce mois", value: stats.totalScans, color: "text-primary", bg: "bg-primary/10" },
    { icon: Users, label: "Clients actifs", value: stats.activeClients, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
  ];

  return (
    <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm">
      <h3 className="font-display font-semibold text-sm mb-4">📊 Résultats ce mois-ci</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="flex flex-col items-center text-center p-3 rounded-xl bg-secondary/30">
            <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center mb-2`}>
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </div>
            <p className="text-xl font-display font-bold">{item.value}</p>
            <p className="text-[10px] text-muted-foreground">{item.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
