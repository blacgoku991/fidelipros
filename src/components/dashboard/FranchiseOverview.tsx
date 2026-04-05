import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, ScanLine, MapPin, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

interface LocationMini {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  scans_today: number;
  unique_customers: number;
}

export function FranchiseOverview() {
  const { business } = useAuth();
  const [locations, setLocations] = useState<LocationMini[]>([]);
  const [totalClients, setTotalClients] = useState(0);
  const [totalScansToday, setTotalScansToday] = useState(0);

  useEffect(() => {
    if (!business) return;
    (async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: locs } = await supabase
        .from("merchant_locations")
        .select("id, name, address, is_active")
        .eq("business_id", business.id)
        .order("created_at", { ascending: true });

      if (!locs) return;

      const { count: clients } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id);
      setTotalClients(clients || 0);

      // 2 global queries instead of N per location
      const [scansRes, custRes] = await Promise.all([
        supabase
          .from("points_history")
          .select("location_id")
          .eq("business_id", business.id)
          .not("location_id", "is", null)
          .gte("created_at", today.toISOString()),
        supabase
          .from("points_history")
          .select("location_id, customer_id")
          .eq("business_id", business.id)
          .not("location_id", "is", null),
      ]);

      const scansByLoc = new Map<string, number>();
      for (const s of scansRes.data || []) {
        scansByLoc.set(s.location_id, (scansByLoc.get(s.location_id) || 0) + 1);
      }
      const custByLoc = new Map<string, Set<string>>();
      for (const c of custRes.data || []) {
        if (!custByLoc.has(c.location_id)) custByLoc.set(c.location_id, new Set());
        custByLoc.get(c.location_id)!.add(c.customer_id);
      }

      const enriched: LocationMini[] = locs.map(loc => ({
        ...loc,
        scans_today: scansByLoc.get(loc.id) || 0,
        unique_customers: custByLoc.get(loc.id)?.size || 0,
      }));

      setLocations(enriched);
      setTotalScansToday(enriched.reduce((s, l) => s + l.scans_today, 0));
    })();
  }, [business]);

  if (locations.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 space-y-4"
    >
      {/* Network summary */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base">Votre réseau</h2>
            <p className="text-xs text-muted-foreground">{locations.length} établissement{locations.length > 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-display font-bold">{locations.length}</p>
            <p className="text-[10px] text-muted-foreground">Points de vente</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-display font-bold">{totalClients}</p>
            <p className="text-[10px] text-muted-foreground">Clients total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-display font-bold">{totalScansToday}</p>
            <p className="text-[10px] text-muted-foreground">Scans aujourd'hui</p>
          </div>
        </div>
      </div>

      {/* Location cards grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {locations.slice(0, 8).map((loc, i) => (
          <motion.div
            key={loc.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link to="/dashboard/locations" className="block">
              <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-semibold truncate flex-1">{loc.name}</p>
                    <Badge variant={loc.is_active ? "default" : "secondary"} className="text-[9px] ml-1 shrink-0">
                      {loc.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                  {loc.address && (
                    <p className="text-[10px] text-muted-foreground truncate mb-3">{loc.address}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <ScanLine className="w-3 h-3" />
                      <span className="font-semibold text-foreground">{loc.scans_today}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-3 h-3" />
                      <span className="font-semibold text-foreground">{loc.unique_customers}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
      {locations.length > 8 && (
        <div className="text-center">
          <Link to="/dashboard/locations" className="text-sm font-medium text-primary hover:underline">
            Voir les {locations.length} établissements →
          </Link>
        </div>
      )}
    </motion.div>
  );
}
