import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppleWalletPass } from "@/components/AppleWalletPass";
import { QRCodeSVG } from "qrcode.react";
import { Gift, Star, Bell, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function DemoPage() {
  const { slug } = useParams<{ slug: string }>();
  const [business, setBusiness] = useState<any>(null);
  const [rewards, setRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: biz } = await supabase
        .from("businesses")
        .select("*")
        .eq("slug", slug)
        .eq("is_demo", true)
        .maybeSingle();

      if (!biz) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setBusiness(biz);

      const { data: rw } = await supabase
        .from("rewards")
        .select("*")
        .eq("business_id", biz.id)
        .eq("is_active", true)
        .order("points_required");
      setRewards(rw ?? []);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !business) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <h1 className="text-2xl font-bold">Démo introuvable</h1>
        <p className="text-muted-foreground">Ce lien de démonstration n'existe pas ou a été supprimé.</p>
      </div>
    );
  }

  const color = business.primary_color ?? "#6B46C1";
  const joinUrl = `${window.location.origin}/b/${business.id}`;

  const sampleNotifications = [
    { title: "🎉 Plus que 4 points !", msg: "Vous êtes proche de votre récompense" },
    { title: "📍 On vous attend !", msg: `${business.name} est tout près. Passez nous voir !` },
    { title: "🎂 Bon anniversaire !", msg: "Un cadeau surprise vous attend en magasin" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Demo banner */}
      <div className="sticky top-0 z-50 bg-primary text-primary-foreground text-center py-2 px-4 text-sm font-medium">
        🎭 Mode démonstration — {business.name}
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color }}>{business.name}</h1>
          <p className="text-muted-foreground text-lg">Programme de fidélité propulsé par FidélisPro</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left: Card preview */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="flex flex-col items-center gap-6">
            <AppleWalletPass
              backgroundColor={color}
              logoText={business.name}
              headerFields={[{ key: "level", label: "NIVEAU", value: "Silver ⭐" }]}
              primaryFields={[{ key: "pts", label: "POINTS", value: "6 / 10" }]}
              secondaryFields={[
                { key: "name", label: "CLIENT", value: "Marie Dupont" },
                { key: "reward", label: "RÉCOMPENSE", value: rewards[0]?.title ?? "Offre spéciale" },
              ]}
              auxiliaryFields={[
                { key: "visits", label: "VISITES", value: "6" },
                { key: "next", label: "PROCHAIN", value: "4 pts" },
              ]}
              width={320}
            />

            {/* QR code */}
            <div className="bg-card rounded-xl border p-6 text-center w-full max-w-xs">
              <p className="text-sm font-medium mb-3">QR Code d'inscription</p>
              <div className="flex justify-center">
                <QRCodeSVG value={joinUrl} size={160} level="M" />
              </div>
              <p className="text-xs text-muted-foreground mt-3">Scannez pour rejoindre le programme</p>
            </div>
          </motion.div>

          {/* Right: Features */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="space-y-6">
            {/* Rewards */}
            {rewards.length > 0 && (
              <div className="bg-card rounded-xl border p-5">
                <h2 className="font-semibold flex items-center gap-2 mb-4">
                  <Gift className="h-5 w-5" style={{ color }} /> Récompenses
                </h2>
                <div className="space-y-3">
                  {rewards.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="font-medium text-sm">{r.title}</span>
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: color + "20", color }}>
                        {r.points_required} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress */}
            <div className="bg-card rounded-xl border p-5">
              <h2 className="font-semibold flex items-center gap-2 mb-4">
                <Star className="h-5 w-5" style={{ color }} /> Progression client
              </h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Marie Dupont</span>
                  <span className="font-medium">6/10 points</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: "60%", backgroundColor: color }} />
                </div>
                <p className="text-xs text-muted-foreground">Plus que 4 points avant la prochaine récompense !</p>
              </div>
            </div>

            {/* Sample notifications */}
            <div className="bg-card rounded-xl border p-5">
              <h2 className="font-semibold flex items-center gap-2 mb-4">
                <Bell className="h-5 w-5" style={{ color }} /> Notifications automatiques
              </h2>
              <div className="space-y-2">
                {sampleNotifications.map((n, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/50 border-l-2" style={{ borderColor: color }}>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.msg}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="text-center pt-2">
              <Button size="lg" className="w-full" style={{ backgroundColor: color }} asChild>
                <a href="/" target="_blank" rel="noopener">
                  Créer mon programme <ArrowRight className="h-4 w-4 ml-2" />
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
