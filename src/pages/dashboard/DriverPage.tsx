import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Car, MapPin, Radio, Users, Clock, Bell, Loader2 } from "lucide-react";

interface NotifiedCustomer {
  id: string;
  name: string;
  distance_km: number;
}

export default function DriverPage() {
  const { business } = useAuth();
  const businessId = business?.id;
  const isVtc = (business as any)?.business_template === "vtc";

  const [online, setOnline] = useState<boolean>(!!(business as any)?.driver_is_online);
  const [lastPos, setLastPos] = useState<{ lat: number; lng: number; at: Date } | null>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState({ eligible: 0, notified: 0, lastBatch: [] as NotifiedCustomer[] });
  const [recentNotifs, setRecentNotifs] = useState<{ name: string; sent_at: string; distance_km: number | null }[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // Load recent proximity notifications
  useEffect(() => {
    if (!businessId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("driver_proximity_log")
        .select("sent_at, distance_km, customer_id, customers(full_name)")
        .eq("business_id", businessId)
        .order("sent_at", { ascending: false })
        .limit(20);
      if (data) {
        setRecentNotifs(
          data.map((r: any) => ({
            name: r.customers?.full_name || "Client",
            sent_at: r.sent_at,
            distance_km: r.distance_km,
          }))
        );
      }
    })();
  }, [businessId, stats.notified]);

  // Broadcast position to backend
  const broadcast = async (lat: number, lng: number) => {
    if (!businessId || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "driver-broadcast-position",
        { body: { business_id: businessId, lat, lng } }
      );
      if (error) throw error;
      if (data?.notified_count > 0) {
        toast.success(
          `📣 ${data.notified_count} client${data.notified_count > 1 ? "s" : ""} notifié${data.notified_count > 1 ? "s" : ""} dans votre zone`
        );
      }
      setStats({
        eligible: data?.eligible_count ?? 0,
        notified: data?.notified_count ?? 0,
        lastBatch: data?.notified_customers ?? [],
      });
    } catch (e: any) {
      console.error("[driver] broadcast error", e);
    } finally {
      setBusy(false);
    }
  };

  // Geolocation watcher
  const startTracking = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Géolocalisation non supportée sur cet appareil");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLastPos({ lat: latitude, lng: longitude, at: new Date() });
        // Throttle: 1 broadcast every 60s minimum
        const now = Date.now();
        if (now - lastTickRef.current > 60_000) {
          lastTickRef.current = now;
          broadcast(latitude, longitude);
        }
      },
      (err) => {
        console.error("[geo]", err);
        toast.error("Impossible d'accéder à votre position GPS");
        setOnline(false);
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 60_000 }
    );
    watchIdRef.current = watchId;

    // Safety: also tick every 90s using cached position to ensure broadcast continues
    tickTimerRef.current = window.setInterval(() => {
      if (lastPos) broadcast(lastPos.lat, lastPos.lng);
    }, 90_000);
  };

  const stopTracking = async () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (tickTimerRef.current != null) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    if (businessId) {
      await supabase.functions.invoke("driver-broadcast-position", {
        body: { business_id: businessId, online: false },
      });
    }
  };

  const toggleOnline = async (next: boolean) => {
    setOnline(next);
    if (next) {
      startTracking();
      toast.success("Vous êtes en ligne — vos clients seront notifiés à proximité 🚗");
    } else {
      await stopTracking();
      toast.info("Vous êtes hors ligne");
    }
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (tickTimerRef.current != null) clearInterval(tickTimerRef.current);
    };
  }, []);

  if (!isVtc) {
    return (
      <DashboardLayout title="Mode chauffeur" subtitle="Réservé aux commerces VTC">
        <Card className="p-8 text-center">
          <Car className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-lg font-semibold">Ce mode est réservé aux activités VTC.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Sélectionne le template <strong>VTC / Chauffeur</strong> dans tes paramètres pour activer cette fonctionnalité.
          </p>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Mode chauffeur"
      subtitle="Notifie automatiquement tes clients quand tu passes près de chez eux"
    >
      {/* Status card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-6 border-2 mb-6 ${
          online
            ? "bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/40"
            : "bg-card border-border/40"
        }`}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                online ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              <Car className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
                Statut
              </p>
              <p className="text-2xl font-display font-bold">
                {online ? "En course" : "Hors ligne"}
              </p>
              {online && lastPos && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-pulse text-emerald-500" />
                  Position MAJ il y a {Math.round((Date.now() - lastPos.at.getTime()) / 1000)}s
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {online ? "Je termine ma journée" : "Je commence à rouler"}
            </span>
            <Switch checked={online} onCheckedChange={toggleOnline} />
          </div>
        </div>
      </motion.div>

      {/* Live stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            <Users className="w-3.5 h-3.5" /> Clients dans ta zone
          </div>
          <p className="text-3xl font-display font-bold">{stats.eligible}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            <Bell className="w-3.5 h-3.5" /> Notifiés au dernier ping
          </div>
          <p className="text-3xl font-display font-bold">{stats.notified}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            <MapPin className="w-3.5 h-3.5" /> Position GPS
          </div>
          <p className="text-sm font-mono mt-1">
            {lastPos
              ? `${lastPos.lat.toFixed(4)}, ${lastPos.lng.toFixed(4)}`
              : "—"}
          </p>
        </Card>
      </div>

      {/* Last batch notified */}
      {stats.lastBatch.length > 0 && (
        <Card className="p-5 mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            🔔 Dernier envoi
          </p>
          <div className="flex flex-wrap gap-2">
            {stats.lastBatch.map((c) => (
              <Badge key={c.id} variant="secondary" className="text-xs">
                {c.name} — {c.distance_km} km
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Recent notification history */}
      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" /> Historique des notifications de proximité
        </p>
        {recentNotifs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune notification envoyée pour le moment. Passe en ligne pour commencer.
          </p>
        ) : (
          <div className="divide-y divide-border/40">
            {recentNotifs.map((n, i) => (
              <div key={i} className="py-2 flex items-center justify-between text-sm">
                <span className="font-medium">{n.name}</span>
                <span className="text-xs text-muted-foreground">
                  {n.distance_km ? `${n.distance_km} km · ` : ""}
                  {new Date(n.sent_at).toLocaleString("fr-FR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {busy && (
        <div className="fixed bottom-6 right-6 bg-card border border-border/40 rounded-xl px-3 py-2 shadow-lg flex items-center gap-2 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Recherche des clients à proximité…
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-6 text-center">
        💡 Garde cette page ouverte au premier plan pendant ta course pour que la position GPS reste active.
      </p>
    </DashboardLayout>
  );
}
