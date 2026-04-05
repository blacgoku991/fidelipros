import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Trophy, TrendingUp, Users, ScanLine } from "lucide-react";

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

interface LocationBasic {
  id: string;
  name: string;
}

interface LocationStat {
  location_id: string;
  name: string;
  scans_total: number;
  scans_30d: number;
  unique_customers: number;
  rewards_claimed: number;
}

export default function LocationsComparePage() {
  const { business } = useAuth();
  const [locations, setLocations] = useState<LocationBasic[]>([]);
  const [stats, setStats] = useState<LocationStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");

  useEffect(() => {
    if (!business) {
      setLocations([]);
      setStats([]);
      setLoading(false);
      return;
    }

    (async () => {
      const { data: locs } = await supabase
        .from("merchant_locations")
        .select("id, name")
        .eq("business_id", business.id)
        .eq("is_active", true);

      const nextLocations = locs || [];
      setLocations(nextLocations);

      if (nextLocations.length === 0) {
        setStats([]);
        setLoading(false);
      }
    })();
  }, [business]);

  useEffect(() => {
    if (!business) return;

    if (locations.length === 0) {
      setStats([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(period));

      const { data: scans } = await supabase
        .from("points_history")
        .select("id, customer_id, location_id, action, created_at")
        .eq("business_id", business.id)
        .not("location_id", "is", null);

      if (!scans) { setLoading(false); return; }

      const locStats: LocationStat[] = locations.map(loc => {
        const locScans = scans.filter(s => s.location_id === loc.id);
        const recentScans = locScans.filter(s => new Date(s.created_at) >= since);
        const uniqueCustomers = new Set(locScans.map(s => s.customer_id));
        const rewardsClaimed = locScans.filter(s => s.action === "reward_claimed").length;

        return {
          location_id: loc.id,
          name: loc.name,
          scans_total: locScans.length,
          scans_30d: recentScans.length,
          unique_customers: uniqueCustomers.size,
          rewards_claimed: rewardsClaimed,
        };
      });

      locStats.sort((a, b) => b.scans_30d - a.scans_30d);
      setStats(locStats);
      setLoading(false);
    })();
  }, [business, locations, period]);

  const chartData = useMemo(() => {
    return stats.map(s => ({
      name: s.name.length > 15 ? s.name.slice(0, 15) + "…" : s.name,
      Scans: s.scans_30d,
      Clients: s.unique_customers,
      Récompenses: s.rewards_claimed,
    }));
  }, [stats]);

  const topLocation = stats[0];

  return (
    <DashboardLayout title="Comparaison des établissements" subtitle="Performance par point de vente">
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : locations.length < 2 ? (
        <Card className="text-center py-12">
          <CardContent>
            <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Pas assez d'établissements</h3>
            <p className="text-muted-foreground">Ajoutez au moins 2 établissements pour comparer les performances.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Period selector */}
          <div className="flex items-center justify-between">
            {topLocation && (
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <span className="text-sm font-medium">Meilleur : <strong>{topLocation.name}</strong></span>
                <Badge variant="secondary">{topLocation.scans_30d} scans</Badge>
              </div>
            )}
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 jours</SelectItem>
                <SelectItem value="30">30 jours</SelectItem>
                <SelectItem value="90">90 jours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scans par établissement ({period} jours)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Scans" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Clients" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Récompenses" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Ranking table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Classement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.map((s, i) => (
                  <div key={s.location_id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                    <span className="text-2xl font-bold text-muted-foreground w-8 text-center">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{s.name}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <ScanLine className="w-3.5 h-3.5" />
                        <span className="font-medium text-foreground">{s.scans_30d}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span className="font-medium text-foreground">{s.unique_customers}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
