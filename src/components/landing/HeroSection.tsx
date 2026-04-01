import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, Award, TrendingUp, MapPin, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { AppleWalletPass } from "@/components/AppleWalletPass";
import { IPhoneMockup } from "@/components/IPhoneMockup";
import fideliproBanner from "@/assets/fidelipro-banner.jpg";

/* ─── Stamp grid component ─── */
function StampGrid({ filled, total, s = 1 }: { filled: number; total: number; s?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(5, 1fr)`, gap: `${6 * s}px`, padding: `${10 * s}px ${16 * s}px` }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: `${28 * s}px`,
            height: `${28 * s}px`,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: `${14 * s}px`,
            background: i < filled ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)",
            border: `${1.5 * s}px solid ${i < filled ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.15)"}`,
          }}
        >
          {i < filled ? "✓" : ""}
        </div>
      ))}
    </div>
  );
}

/* ─── Card type data for the hero demo ─── */
const DEMO_CARDS = [
  {
    id: "stamps",
    label: "Tampons",
    bg: "#7c3aed",
    headerFields: [{ key: "stamps", label: "Tampons", value: "7 / 10" }],
    primaryFields: [{ key: "member", label: "Membre", value: "Marie Dupont" }],
    secondaryFields: [],
    auxiliaryFields: [],
    stamps: { filled: 7, total: 10 },
  },
  {
    id: "points",
    label: "Points",
    bg: "#2563eb",
    headerFields: [{ key: "points", label: "Points", value: "120" }],
    primaryFields: [{ key: "member", label: "Membre", value: "Marie Dupont" }],
    secondaryFields: [{ key: "progress", label: "Objectif", value: "120 / 200" }],
    auxiliaryFields: [],
  },
  {
    id: "cashback",
    label: "Cagnotte",
    bg: "#059669",
    headerFields: [{ key: "balance", label: "Cagnotte", value: "24,50 €" }],
    primaryFields: [{ key: "member", label: "Membre", value: "Marie Dupont" }],
    secondaryFields: [],
    auxiliaryFields: [],
  },
  {
    id: "subscription",
    label: "Abonnement",
    bg: "#d97706",
    headerFields: [{ key: "plan", label: "Plan", value: "Premium ✓" }],
    primaryFields: [{ key: "member", label: "Membre", value: "Marie Dupont" }],
    secondaryFields: [],
    auxiliaryFields: [],
  },
] as const;

/* ─── Notification definitions ─── */
const NOTIFICATIONS = [
  {
    icon: MapPin,
    text: "Vous êtes à proximité !",
    sub: "Boutique FidéliPro · 50m",
    bg: "bg-blue-500/90",
    iconBg: "bg-blue-400",
  },
  {
    icon: Gift,
    text: "Offre spéciale disponible !",
    sub: "-20% aujourd'hui seulement",
    bg: "bg-emerald-500/90",
    iconBg: "bg-emerald-400",
  },
];

/* ═══════════════════ HERO ═══════════════════ */
export function HeroSection() {
  const { data: settings } = useSiteSettings();
  const [activeIndex, setActiveIndex] = useState(0);
  const [notifIndex, setNotifIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % DEMO_CARDS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNotifIndex((prev) => (prev + 1) % NOTIFICATIONS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const { data: businessCount } = useQuery({
    queryKey: ["business-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("businesses")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  const headline = settings?.hero_headline || "Vos clients reviennent.";
  const headlineGradient = settings?.hero_headline_gradient || "Encore et encore.";
  const subtitle = settings?.hero_subtitle || "Créez des cartes de fidélité digitales premium, envoyez des notifications intelligentes et boostez votre chiffre d'affaires. Compatible Apple Wallet & Google Wallet.";
  const ctaPrimary = settings?.hero_cta_primary || "Commencer maintenant";
  const ctaSecondary = settings?.hero_cta_secondary || "Voir les tarifs";
  const badge = settings?.hero_badge || "La fidélité réinventée";
  const stat1 = settings?.hero_stat_1 || "⭐ 4.9/5";
  const stat2 = settings?.hero_stat_2 || "📲 50 000 cartes générées";
  const stat3 = settings?.hero_stat_3 || "🚀 Sans engagement";
  const liveMerchantCount = businessCount ?? 0;

  const activeCard = DEMO_CARDS[activeIndex];
  const currentNotif = NOTIFICATIONS[notifIndex];

  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden">
      {/* Mesh gradient background */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0" style={{
        background: [
          "radial-gradient(ellipse 90% 70% at 10% 30%, hsl(245 58% 51% / 0.18), transparent)",
          "radial-gradient(ellipse 60% 50% at 80% 20%, hsl(270 65% 55% / 0.12), transparent)",
          "radial-gradient(ellipse 55% 45% at 65% 80%, hsl(38 92% 50% / 0.10), transparent)",
          "radial-gradient(ellipse 40% 35% at 30% 90%, hsl(245 58% 51% / 0.08), transparent)",
        ].join(", ")
      }} />
      <div className="absolute inset-0 opacity-[0.025]" style={{
        backgroundImage: "linear-gradient(hsl(245 58% 51%) 1px, transparent 1px), linear-gradient(90deg, hsl(245 58% 51%) 1px, transparent 1px)",
        backgroundSize: "60px 60px"
      }} />

      <div className="container relative z-10 py-16 sm:py-20 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* ─── Left column ─── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-center sm:text-left"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-6">
              <Sparkles className="w-4 h-4" />
              {badge}
            </div>

            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex items-center gap-2 mb-5 justify-center sm:justify-start"
            >
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                <motion.span
                  className="w-2 h-2 rounded-full bg-emerald-500"
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                🟢 {liveMerchantCount} commerçants actifs
              </span>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-extrabold leading-[1.05] tracking-tight">
              {headline}{" "}
              <span className="text-gradient">{headlineGradient}</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg">
              {subtitle}
            </p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              className="mt-6 flex flex-wrap items-center justify-center sm:justify-start gap-3"
            >
              {[stat1, stat2, stat3].map((stat, i) => (
                <motion.span
                  key={i}
                  className="px-3 py-1.5 rounded-full bg-card border border-border/60 text-xs font-semibold shadow-sm"
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.55 + i * 0.1 }}
                >
                  {stat}
                </motion.span>
              ))}
            </motion.div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="w-full sm:w-auto bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 transition-opacity rounded-xl px-8 h-13 text-base font-bold">
                <Link to="/register">
                  {ctaPrimary}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto rounded-xl px-8 h-13 text-base border-border/60 hover:border-primary/30 hover:bg-primary/5">
                <a href="/tarifs">{ctaSecondary}</a>
              </Button>
            </div>

            <div className="mt-7 flex items-center justify-center sm:justify-start gap-5 text-sm text-muted-foreground">
              {["Résiliation facile", "Activation immédiate", "Support français"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-[10px]">✓</span>
                  {t}
                </span>
              ))}
            </div>
          </motion.div>

          {/* ─── Right — iPhone mockup with REAL PassKit card ─── */}
          <motion.div
            initial={{ opacity: 0, x: 48 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="flex justify-center items-center relative"
          >
            {/* Glow orbs */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.div
                className="w-80 h-80 rounded-full bg-primary/12 blur-3xl"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.div
                className="w-56 h-56 rounded-full bg-amber-400/10 blur-2xl"
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              />
            </div>

            {/* Floating badges */}
            <motion.div
              className="absolute top-4 left-0 z-20 px-3 py-2 rounded-xl bg-card/90 backdrop-blur-sm border border-border/60 shadow-xl flex items-center gap-2"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 1 }}>
                <Award className="w-4 h-4 text-amber-500" />
              </motion.div>
              <span className="text-xs font-bold">Bronze → Silver 🎉</span>
            </motion.div>

            <motion.div
              className="absolute top-1/4 -right-4 z-20 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 shadow-xl flex items-center gap-2"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">+23% CA</span>
            </motion.div>

            <motion.div
              className="absolute bottom-1/3 -left-4 z-20 px-3 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xl shadow-amber-500/30"
              animate={{ scale: [1, 1.12, 1], y: [0, -4, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            >
              <span className="text-xs font-bold">+1 pt</span>
            </motion.div>

            {/* iPhone with REAL Apple Wallet card */}
            <motion.div
              className="relative z-10"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <IPhoneMockup width={278}>
                {/* Card type tabs (outside the pass, as a Wallet-level UI) */}
                <div className="flex gap-1 mb-2 px-1">
                  {DEMO_CARDS.map((card, i) => (
                    <button
                      key={card.id}
                      onClick={() => setActiveIndex(i)}
                      className={`flex-1 py-1.5 rounded-lg text-[8px] font-bold transition-all ${
                        activeIndex === i
                          ? "text-white shadow-sm"
                          : "text-gray-400 hover:text-gray-200"
                      }`}
                      style={activeIndex === i ? { background: card.bg } : undefined}
                    >
                      {card.label}
                    </button>
                  ))}
                </div>

                {/* The REAL PassKit card — same component used everywhere */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeCard.id}
                    initial={{ opacity: 0, x: 20, scale: 0.98 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -20, scale: 0.98 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <AppleWalletPass
                      backgroundColor={activeCard.bg}
                      logoText="FidéliPro"
                      stripImageUrl={fideliproBanner}
                      headerFields={[...activeCard.headerFields]}
                      primaryFields={[...activeCard.primaryFields]}
                      secondaryFields={[...activeCard.secondaryFields]}
                      auxiliaryFields={[...activeCard.auxiliaryFields]}
                      barcodeValue="FIDELIPRO-DEMO-001"
                      footerText="FIDELIPRO-001"
                      width={246}
                    />
                  </motion.div>
                </AnimatePresence>

                {/* Smart notification */}
                <div className="mt-2">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={notifIndex}
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.3 }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl ${currentNotif.bg} backdrop-blur-sm`}
                    >
                      <div className={`w-6 h-6 rounded-lg ${currentNotif.iconBg} flex items-center justify-center shrink-0`}>
                        <currentNotif.icon className="w-3 h-3 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold text-white leading-none">{currentNotif.text}</p>
                        <p className="text-[7px] text-white/60 mt-0.5">{currentNotif.sub}</p>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </IPhoneMockup>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
