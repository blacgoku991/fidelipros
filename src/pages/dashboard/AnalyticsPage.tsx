import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Gift, BarChart3, Repeat, Target, ArrowUpRight, Wallet, Filter } from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

const AnalyticsPage = () => {
  const { business } = useAuth();
  const businessId = business?.id;
  const [stats, setStats] = useState({ totalScans: 0, activeClients: 0, rewardsEarned: 0, walletInstalls: 0, returnRate: 0, avgVisits: 0 });
  const [scansTrend, setScansTrend] = useState<any[]>([]);
  const [segmentData, setSegmentData] = useState<any[]>([]);
  const [monthlyScans, setMonthlyScans] = useState<any[]>([]);
  const [conversionFilter, setConversionFilter] = useState({ visits: 0, registrations: 0, active: 0, sourceBreakdown: [] as { source: string; count: number }[] });
  const [avgReviewRating, setAvgReviewRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    if (businessId) fetchAll();
  }, [businessId]);

  const fetchAll = async () => {
    const [customersRes, cardsRes, scansRes, walletRes] = await Promise.all([
      supabase.from("customers").select("*").eq("business_id", businessId),
      supabase.from("customer_cards").select("*").eq("business_id", businessId),
      supabase.from("points_history").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
      supabase.from("wallet_registrations").select("*", { count: "exact", head: true }).eq("business_id", businessId),
    ]);

    const customers = customersRes.data || [];
    const cards = cardsRes.data || [];
    const scans = scansRes.data || [];

    // Segment breakdown
    const segments: Record<string, number> = { bronze: 0, silver: 0, gold: 0 };
    customers.forEach((c: any) => { segments[c.level || "bronze"] = (segments[c.level || "bronze"] || 0) + 1; });
    setSegmentData(Object.entries(segments).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })));

    // Active clients (visited in last 30 days)
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeClients = customers.filter((c: any) => c.last_visit_at && new Date(c.last_visit_at) >= thirtyDaysAgo).length;

    // Return rate
    const multiVisit = customers.filter((c: any) => (c.total_visits || 0) > 1).length;
    const returnRate = customers.length > 0 ? Math.round((multiVisit / customers.length) * 100) : 0;

    // Avg visits
    const totalVisits = customers.reduce((sum: number, c: any) => sum + (c.total_visits || 0), 0);
    const avgVisits = customers.length > 0 ? +(totalVisits / customers.length).toFixed(1) : 0;

    // Rewards earned
    const rewardsEarned = cards.reduce((sum: number, c: any) => sum + (c.rewards_earned || 0), 0);

    // Monthly scans (last 6 months)
    const monthly: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString("fr-FR", { month: "short" });
      const count = scans.filter((s: any) => {
        const sd = new Date(s.created_at);
        return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
      }).length;
      monthly.push({ date: label, scans: count });
    }
    setMonthlyScans(monthly);

    // Daily scans (last 14 days)
    const daily: any[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split("T")[0];
      const count = scans.filter((s: any) => s.created_at.startsWith(dayStr)).length;
      daily.push({ date: d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }), scans: count });
    }
    setScansTrend(daily);

    // Conversion funnel
    try {
      const { count: visitCount } = await supabase.from("vitrine_visits").select("*", { count: "exact", head: true }).eq("business_id", businessId);
      const sourceCounts: Record<string, number> = {};
      customers.forEach((c: any) => {
        const src = (c as any).registration_source || "direct";
        sourceCounts[src] = (sourceCounts[src] || 0) + 1;
      });
      setConversionFilter({
        visits: visitCount || 0,
        registrations: customers.length,
        active: activeClients,
        sourceBreakdown: Object.entries(sourceCounts).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
      });
    } catch { /* vitrine_visits table may not exist yet */ }

    // Reviews stats
    try {
      const { data: reviewsData } = await supabase.from("customer_reviews").select("rating").eq("business_id", businessId);
      if (reviewsData && reviewsData.length > 0) {
        setReviewCount(reviewsData.length);
        setAvgReviewRating(Math.round((reviewsData.reduce((s, r) => s + r.rating, 0) / reviewsData.length) * 10) / 10);
      }
    } catch { /* customer_reviews table may not exist yet */ }

    setStats({
      totalScans: scans.length,
      activeClients,
      rewardsEarned,
      walletInstalls: walletRes.count || 0,
      returnRate,
      avgVisits,
    });
  };

  const statCards = [
    { label: "Scans total", value: stats.totalScans, icon: BarChart3 },
    { label: "Clients actifs (30j)", value: stats.activeClients, icon: Users },
    { label: "Taux de retour", value: `${stats.returnRate}%`, icon: Repeat },
    { label: "Wallet installés", value: stats.walletInstalls, icon: Wallet },
  ];

  return (
    <DashboardLayout title="Statistiques" subtitle="Performance de votre programme de fidélité">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s, i) => <StatsCard key={s.label} {...s} index={i} />)}
      </div>

      {/* Business Impact */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl bg-card border border-border/40 p-5 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Récompenses débloquées</p>
          <p className="text-3xl font-display font-bold">{stats.rewardsEarned}</p>
          <p className="text-xs text-muted-foreground mt-1">Total historique</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-2xl bg-card border border-border/40 p-5 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Visites moyennes</p>
          <p className="text-3xl font-display font-bold">{stats.avgVisits}</p>
          <p className="text-xs text-muted-foreground mt-1">Par client</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="rounded-2xl bg-card border border-border/40 p-5 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Taux de retour</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-display font-bold">{stats.returnRate}%</p>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Clients avec 2+ visites</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="rounded-2xl bg-card border border-border/40 p-5 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Note moyenne</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-display font-bold">{avgReviewRating > 0 ? `${avgReviewRating}/5` : "—"}</p>
            {avgReviewRating >= 4 && <ArrowUpRight className="w-4 h-4 text-emerald-500" />}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{reviewCount} avis clients</p>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="rounded-2xl bg-card border border-border/40 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Scans — 14 derniers jours</p>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={scansTrend}>
                <defs>
                  <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Area type="monotone" dataKey="scans" stroke="hsl(var(--primary))" fill="url(#aGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="rounded-2xl bg-card border border-border/40 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Scans mensuels</p>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyScans}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Bar dataKey="scans" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Conversion Filter */}
      {conversionFilter.visits > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="rounded-2xl bg-card border border-border/40 p-6 shadow-sm mb-8">
          <div className="flex items-center gap-2 mb-5">
            <Filter className="w-4 h-4 text-primary" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Entonnoir de conversion</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: "Visites vitrine", value: conversionFilter.visits, color: "text-blue-500" },
              { label: "Inscriptions", value: conversionFilter.registrations, color: "text-amber-500" },
              { label: "Clients actifs (30j)", value: conversionFilter.active, color: "text-emerald-500" },
            ].map((step, i) => (
              <div key={step.label} className="text-center">
                <p className={`text-3xl font-display font-bold ${step.color}`}>{step.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{step.label}</p>
                {i < 2 && conversionFilter.visits > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    → {Math.round(((i === 0 ? conversionFilter.registrations : conversionFilter.active) / conversionFilter.visits) * 100)}% conversion
                  </p>
                )}
              </div>
            ))}
          </div>
          {conversionFilter.sourceBreakdown.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Source d'inscription</p>
              <div className="flex flex-wrap gap-2">
                {conversionFilter.sourceBreakdown.map((s) => (
                  <Badge key={s.source} variant="secondary" className="text-xs">
                    {s.source === "direct" ? "Direct" : s.source === "vitrine" ? "Vitrine" : s.source === "widget" ? "Widget" : s.source}: {s.count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Segments */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
        className="rounded-2xl bg-card border border-border/40 p-6 shadow-sm max-w-md">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-primary" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Segmentation clients</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="h-[140px] w-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={segmentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30} strokeWidth={2}>
                  {segmentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {segmentData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-muted-foreground">{d.name}:</span>
                <span className="font-semibold">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default AnalyticsPage;
