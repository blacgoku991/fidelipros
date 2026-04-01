import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, Bell, Award, TrendingUp, CreditCard, Stamp, Coins, Wallet, Crown, MapPin, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import fideliproBanner from "@/assets/fidelipro-banner.jpg";

/* ─── Card type definitions ─── */
const CARD_TYPES = [
  { id: "stamps", label: "Tampons", icon: Stamp, color: "from-violet-600 via-purple-600 to-indigo-700" },
  { id: "points", label: "Points", icon: Coins, color: "from-blue-600 via-cyan-600 to-blue-700" },
  { id: "cashback", label: "Cagnotte", icon: Wallet, color: "from-emerald-600 via-teal-600 to-emerald-700" },
  { id: "subscription", label: "Abo", icon: Crown, color: "from-amber-600 via-orange-500 to-amber-700" },
] as const;

type CardType = (typeof CARD_TYPES)[number]["id"];

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

/* ─── Stamp Card Content ─── */
function StampCardContent() {
  const stamps = 7;
  const total = 10;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center">
            <CreditCard className="w-3 h-3 text-white" />
          </div>
          <span className="text-[11px] font-bold text-white">FidéliPro</span>
        </div>
        <div className="text-right">
          <p className="text-[7px] uppercase tracking-widest text-white/50 font-semibold">Tampons</p>
          <p className="text-sm font-extrabold text-white leading-none">{stamps}/{total}</p>
        </div>
      </div>
      <div className="rounded-lg overflow-hidden" style={{ aspectRatio: "3.2 / 1" }}>
        <img src={fideliproBanner} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`aspect-square rounded-md flex items-center justify-center text-[10px] ${
              i < stamps
                ? "bg-white/25 text-white"
                : "bg-white/8 border border-white/10 text-white/20"
            }`}
          >
            {i < stamps ? "✓" : i + 1}
          </div>
        ))}
      </div>
      <div className="flex items-start justify-between pt-0.5">
        <div>
          <p className="text-[7px] uppercase tracking-widest text-white/50 font-semibold">Membre</p>
          <p className="text-[10px] font-bold text-white">Marie Dupont</p>
        </div>
        <div className="text-right">
          <p className="text-[7px] uppercase tracking-widest text-white/50 font-semibold">Récompense</p>
          <p className="text-[10px] font-bold text-white">Café offert</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Points Card Content ─── */
function PointsCardContent() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center">
            <Coins className="w-3 h-3 text-white" />
          </div>
          <span className="text-[11px] font-bold text-white">FidéliPro</span>
        </div>
        <div className="text-right">
          <p className="text-[7px] uppercase tracking-widest text-white/50 font-semibold">Points</p>
          <p className="text-sm font-extrabold text-white leading-none">120</p>
        </div>
      </div>
      <div className="rounded-lg overflow-hidden" style={{ aspectRatio: "3.2 / 1" }}>
        <img src={fideliproBanner} alt="" className="w-full h-full object-cover" />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[8px] text-white/60 font-semibold">Prochaine récompense</span>
          <span className="text-[8px] text-white/80 font-bold">120 / 200 pts</span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/15 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-white/60 to-white/90"
            initial={{ width: 0 }}
            animate={{ width: "60%" }}
            transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
          />
        </div>
        <p className="text-[8px] text-white/40 mt-1">Encore 80 pts → Remise 15%</p>
      </div>
      <div className="flex items-start justify-between pt-0.5">
        <div>
          <p className="text-[7px] uppercase tracking-widest text-white/50 font-semibold">Membre</p>
          <p className="text-[10px] font-bold text-white">Marie Dupont</p>
        </div>
        <div className="text-right">
          <p className="text-[7px] uppercase tracking-widest text-white/50 font-semibold">Niveau</p>
          <p className="text-[10px] font-bold text-amber-300">Gold ⭐</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Cashback Card Content ─── */
function CashbackCardContent() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center">
            <Wallet className="w-3 h-3 text-white" />
          </div>
          <span className="text-[11px] font-bold text-white">FidéliPro</span>
        </div>
        <div className="text-right">
          <p className="text-[7px] uppercase tracking-widest text-white/50 font-semibold">Cagnotte</p>
          <p className="text-sm font-extrabold text-white leading-none">24,50€</p>
        </div>
      </div>
      <div className="rounded-lg overflow-hidden" style={{ aspectRatio: "3.2 / 1" }}>
        <img src={fideliproBanner} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="flex items-center gap-2 p-2 rounded-lg bg-white/10 border border-white/10">
        <div className="w-7 h-7 rounded-full bg-emerald-400/20 flex items-center justify-center">
          <span className="text-[12px]">💰</span>
        </div>
        <div>
          <p className="text-[10px] font-bold text-white">Solde disponible</p>
          <p className="text-[8px] text-white/50">Utilisable en magasin</p>
        </div>
        <div className="ml-auto px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-400/30">
          <span className="text-[8px] font-bold text-emerald-300">Disponible</span>
        </div>
      </div>
      <div className="flex items-start justify-between pt-0.5">
        <div>
          <p className="text-[7px] uppercase tracking-widest text-white/50 font-semibold">Membre</p>
          <p className="text-[10px] font-bold text-white">Marie Dupont</p>
        </div>
        <div className="text-right">
          <p className="text-[7px] uppercase tracking-widest text-white/50 font-semibold">Cashback</p>
          <p className="text-[10px] font-bold text-white">5%</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Subscription Card Content ─── */
function SubscriptionCardContent() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center">
            <Crown className="w-3 h-3 text-white" />
          </div>
          <span className="text-[11px] font-bold text-white">FidéliPro</span>
        </div>
        <div className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/30">
          <span className="text-[8px] font-bold text-amber-300">Premium</span>
        </div>
      </div>
      <div className="rounded-lg overflow-hidden" style={{ aspectRatio: "3.2 / 1" }}>
        <img src={fideliproBanner} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="p-2 rounded-lg bg-white/10 border border-white/10 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-white/70 font-semibold">Abonnement</span>
          <span className="text-[9px] font-bold text-white">Premium Member</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-white/70 font-semibold">Statut</span>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-bold text-emerald-300">Actif</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-white/70 font-semibold">Renouvellement</span>
          <span className="text-[9px] font-bold text-white/80">15 Jan 2027</span>
        </div>
      </div>
      <div className="flex items-start justify-between pt-0.5">
        <div>
          <p className="text-[7px] uppercase tracking-widest text-white/50 font-semibold">Membre</p>
          <p className="text-[10px] font-bold text-white">Marie Dupont</p>
        </div>
        <div className="text-right">
          <p className="text-[7px] uppercase tracking-widest text-white/50 font-semibold">Avantages</p>
          <p className="text-[10px] font-bold text-white">∞ Illimités</p>
        </div>
      </div>
    </div>
  );
}

const CARD_CONTENT: Record<CardType, () => JSX.Element> = {
  stamps: StampCardContent,
  points: PointsCardContent,
  cashback: CashbackCardContent,
  subscription: SubscriptionCardContent,
};

/* ═══════════════════ HERO ═══════════════════ */
export function HeroSection() {
  const { data: settings } = useSiteSettings();
  const [activeCard, setActiveCard] = useState<CardType>("stamps");
  const [notifIndex, setNotifIndex] = useState(0);

  // Auto-rotate cards
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCard((prev) => {
        const idx = CARD_TYPES.findIndex((c) => c.id === prev);
        return CARD_TYPES[(idx + 1) % CARD_TYPES.length].id;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Alternate notifications
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

  const currentNotif = NOTIFICATIONS[notifIndex];
  const activeCardType = CARD_TYPES.find((c) => c.id === activeCard)!;
  const CardContent = CARD_CONTENT[activeCard];

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

          {/* ─── Right — iPhone mockup ─── */}
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

            {/* ── Floating badges ── */}
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

            {/* ── iPhone 17 Pro Max — enlarged ── */}
            <motion.div
              className="relative z-10"
              style={{ width: 300 }}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* iPhone frame */}
              <div
                className="relative rounded-[52px] bg-[#1a1a2e] p-[11px]"
                style={{
                  aspectRatio: "9 / 19.5",
                  boxShadow: "0 25px 80px -15px rgba(0,0,0,0.5), 0 10px 30px -10px rgba(107,70,193,0.2), inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              >
                {/* Dynamic Island */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 w-[100px] h-[28px] bg-[#1a1a2e] rounded-b-[18px]" />
                {/* Side buttons */}
                <div className="absolute top-[125px] -right-[2px] w-[3px] h-[55px] rounded-r bg-[#2a2a3e]" />
                <div className="absolute top-[90px] -left-[2px] w-[3px] h-[30px] rounded-l bg-[#2a2a3e]" />
                <div className="absolute top-[135px] -left-[2px] w-[3px] h-[46px] rounded-l bg-[#2a2a3e]" />
                <div className="absolute top-[190px] -left-[2px] w-[3px] h-[46px] rounded-l bg-[#2a2a3e]" />

                {/* Screen */}
                <div className="rounded-[41px] overflow-hidden bg-[#f2f2f7] dark:bg-[#1c1c1e] h-full flex flex-col">
                  {/* Status bar */}
                  <div className="flex items-center justify-between px-7 pt-4 pb-1 shrink-0">
                    <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200">19:24</span>
                    <div className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" /></svg>
                      <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" /></svg>
                    </div>
                  </div>

                  {/* Wallet header */}
                  <div className="px-5 pt-0.5 pb-1.5 shrink-0">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Wallet</h3>
                  </div>

                  {/* Stacked bank cards (decorative) */}
                  <div className="px-4 flex flex-col gap-0 shrink-0">
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4, duration: 0.5 }}
                      className="relative z-[1] rounded-xl h-[42px] bg-gradient-to-r from-blue-600 to-blue-800 shadow-md px-3.5 py-2.5 shrink-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-semibold text-white/90">💳 Ma Banque</span>
                        <span className="text-[8px] text-white/50">•••• 4242</span>
                      </div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.55, duration: 0.5 }}
                      className="relative z-[2] -mt-[26px] rounded-xl h-[42px] bg-gradient-to-r from-gray-400 to-gray-600 shadow-md px-3.5 py-2.5 shrink-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-semibold text-white/90">🏦 Revolut</span>
                        <span className="text-[8px] text-white/50">•••• 3669</span>
                      </div>
                    </motion.div>
                  </div>

                  {/* ── Interactive card type selector ── */}
                  <div className="px-3 pt-2 shrink-0">
                    <div className="flex gap-1 rounded-xl bg-gray-200/80 dark:bg-white/10 p-0.5">
                      {CARD_TYPES.map((ct) => {
                        const Icon = ct.icon;
                        const isActive = activeCard === ct.id;
                        return (
                          <button
                            key={ct.id}
                            onClick={() => setActiveCard(ct.id)}
                            className={`relative flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[7px] font-bold transition-all duration-200 ${
                              isActive
                                ? "text-white shadow-md"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            }`}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="activeCardBg"
                                className={`absolute inset-0 rounded-lg bg-gradient-to-r ${ct.color}`}
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                              />
                            )}
                            <Icon className="w-3 h-3 relative z-10" />
                            <span className="relative z-10 leading-none">{ct.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Active loyalty card ── */}
                  <div className="flex-1 px-3 pt-2 pb-2 overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeCard}
                        initial={{ opacity: 0, x: 30, scale: 0.97 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -30, scale: 0.97 }}
                        transition={{ duration: 0.35, ease: "easeInOut" }}
                        className={`rounded-2xl overflow-hidden shadow-xl p-3 bg-gradient-to-br ${activeCardType.color}`}
                      >
                        <CardContent />
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* ── Smart notification ── */}
                  <div className="px-3 pb-2 shrink-0">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={notifIndex}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.35 }}
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

                  {/* Label */}
                  <motion.div
                    className="flex items-center justify-center pb-3 shrink-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                  >
                    <span className="text-[10px] italic text-primary font-medium">
                      ← Votre entreprise est ici
                    </span>
                  </motion.div>
                </div>
              </div>

              {/* Home indicator */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[100px] h-[4px] rounded-full bg-white/30" />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
