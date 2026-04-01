import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Bell, Award, TrendingUp, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import fideliproBanner from "@/assets/fidelipro-banner.jpg";

export function HeroSection() {
  const { data: settings } = useSiteSettings();

  // Fetch real business count
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
  const stat3 = settings?.hero_stat_3 || "🚀 Activation immédiate";
  const liveMerchantCount = businessCount ?? 0;

  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden">
      {/* Mesh gradient background — violet/amber */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0" style={{
        background: [
          "radial-gradient(ellipse 90% 70% at 10% 30%, hsl(245 58% 51% / 0.18), transparent)",
          "radial-gradient(ellipse 60% 50% at 80% 20%, hsl(270 65% 55% / 0.12), transparent)",
          "radial-gradient(ellipse 55% 45% at 65% 80%, hsl(38 92% 50% / 0.10), transparent)",
          "radial-gradient(ellipse 40% 35% at 30% 90%, hsl(245 58% 51% / 0.08), transparent)",
        ].join(", ")
      }} />
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 opacity-[0.025]" style={{
        backgroundImage: "linear-gradient(hsl(245 58% 51%) 1px, transparent 1px), linear-gradient(90deg, hsl(245 58% 51%) 1px, transparent 1px)",
        backgroundSize: "60px 60px"
      }} />

      <div className="container relative z-10 py-16 sm:py-20 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-center sm:text-left"
          >
            {/* Badge principal */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-6">
              <Sparkles className="w-4 h-4" />
              {badge}
            </div>

            {/* Live merchant badge — animé */}
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

            {/* Stats band */}
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

            {/* Trust indicators avec micro-accents ambrés */}
            <div className="mt-7 flex items-center justify-center sm:justify-start gap-5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-[10px]">✓</span>
                Résiliation facile
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-[10px]">✓</span>
                Activation immédiate
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-[10px]">✓</span>
                Support français
              </span>
            </div>
          </motion.div>

          {/* Right - iPhone mockup with Wallet */}
          <motion.div
            initial={{ opacity: 0, x: 48 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="flex justify-center items-center relative"
          >
            {/* Glow orbs */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 rounded-full bg-amber-400/10 blur-2xl" />
            </div>

            {/* Floating badges */}
            <motion.div
              className="absolute top-8 left-0 z-20 px-3 py-2 rounded-xl bg-card border border-border/60 shadow-lg flex items-center gap-2"
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <Award className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold">Bronze → Silver 🎉</span>
            </motion.div>

            <motion.div
              className="absolute top-1/4 -right-2 z-20 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 shadow-lg flex items-center gap-2"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">+23% CA</span>
            </motion.div>

            <motion.div
              className="absolute bottom-12 right-0 z-20 px-3 py-2 rounded-xl bg-card border border-border/60 shadow-lg flex items-center gap-2 max-w-[190px]"
              animate={{ y: [0, 7, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
            >
              <Bell className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-xs text-muted-foreground truncate">Récompense disponible !</span>
            </motion.div>

            <motion.div
              className="absolute bottom-1/3 -left-2 z-20 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30"
              animate={{ scale: [1, 1.14, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            >
              <span className="text-xs font-bold">+1 pt</span>
            </motion.div>

            {/* iPhone 17 Pro Max mockup — realistic 6.9" proportions */}
            <motion.div
              className="relative z-10"
              style={{ width: 260 }}
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* iPhone frame — 19.5:9 aspect ratio */}
              <div className="relative rounded-[48px] bg-[#1a1a2e] p-[10px] shadow-2xl shadow-black/30" style={{ aspectRatio: "9 / 19.5" }}>
                {/* Dynamic Island */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 w-[90px] h-[26px] bg-[#1a1a2e] rounded-b-[18px]" />
                {/* Side buttons */}
                <div className="absolute top-[110px] -right-[2px] w-[3px] h-[50px] rounded-r bg-[#2a2a3e]" />
                <div className="absolute top-[80px] -left-[2px] w-[3px] h-[28px] rounded-l bg-[#2a2a3e]" />
                <div className="absolute top-[120px] -left-[2px] w-[3px] h-[42px] rounded-l bg-[#2a2a3e]" />
                <div className="absolute top-[170px] -left-[2px] w-[3px] h-[42px] rounded-l bg-[#2a2a3e]" />

                {/* Screen */}
                <div className="rounded-[38px] overflow-hidden bg-[#f2f2f7] dark:bg-[#1c1c1e] h-full flex flex-col">
                  {/* Status bar */}
                  <div className="flex items-center justify-between px-7 pt-3.5 pb-1 shrink-0">
                    <span className="text-[11px] font-semibold text-foreground/80">19:24</span>
                    <div className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-foreground/60" viewBox="0 0 24 24" fill="currentColor"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
                      <svg className="w-3.5 h-3.5 text-foreground/60" viewBox="0 0 24 24" fill="currentColor"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/></svg>
                    </div>
                  </div>

                  {/* Wallet header */}
                  <div className="px-5 pt-1 pb-2 shrink-0">
                    <h3 className="text-lg font-bold text-foreground">Wallet</h3>
                  </div>

                  {/* Stacked cards */}
                  <div className="flex-1 px-4 pb-8 flex flex-col justify-start gap-0">
                    {/* Bank card 1 */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5, duration: 0.6 }}
                      className="relative z-[1] rounded-xl h-[60px] bg-gradient-to-r from-blue-600 to-blue-800 shadow-md px-4 py-3 shrink-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-white/90">💳 Ma Banque</span>
                        <span className="text-[9px] text-white/50">•••• 4242</span>
                      </div>
                    </motion.div>

                    {/* Bank card 2 */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7, duration: 0.6 }}
                      className="relative z-[2] -mt-[36px] rounded-xl h-[60px] bg-gradient-to-r from-gray-400 to-gray-600 shadow-md px-4 py-3 shrink-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-white/90">🏦 Revolut</span>
                        <span className="text-[9px] text-white/50">•••• 3669</span>
                      </div>
                    </motion.div>

                    {/* FidéliPro loyalty card */}
                    <motion.div
                      initial={{ opacity: 0, y: 30, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.9, duration: 0.7, ease: "easeOut" }}
                      className="relative z-[3] -mt-[36px] rounded-2xl overflow-hidden shadow-xl shadow-primary/20"
                    >
                      <div className="bg-gradient-to-br from-[hsl(245,58%,51%)] via-[hsl(270,65%,45%)] to-[hsl(245,58%,35%)] p-3.5">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-sm">
                              <CreditCard className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-[13px] font-bold text-white">FidéliPro</span>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] uppercase tracking-widest text-white/50 font-semibold">Stamps</p>
                            <motion.p
                              className="text-base font-extrabold text-white leading-none"
                              animate={{ scale: [1, 1.08, 1] }}
                              transition={{ duration: 2, repeat: Infinity, delay: 2 }}
                            >
                              7
                            </motion.p>
                          </div>
                        </div>

                        {/* Banner */}
                        <div className="rounded-xl overflow-hidden mb-2.5" style={{ aspectRatio: "3.2 / 1" }}>
                          <img src={fideliproBanner} alt="" className="w-full h-full object-cover" />
                        </div>

                        {/* Member + Reward */}
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-[8px] uppercase tracking-widest text-white/50 font-semibold">Member</p>
                            <p className="text-[12px] font-bold text-white">Marie Dupont</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] uppercase tracking-widest text-white/50 font-semibold">Reward</p>
                            <p className="text-[12px] font-bold text-white">3</p>
                          </div>
                        </div>

                        {/* QR */}
                        <div className="flex flex-col items-center pt-1 pb-0.5">
                          <div className="rounded-lg p-1.5 bg-white shadow-sm">
                            <div className="w-[52px] h-[52px] bg-gray-100 rounded grid grid-cols-5 grid-rows-5 gap-px p-1">
                              {Array.from({ length: 25 }).map((_, i) => (
                                <div key={i} className={`rounded-[1px] ${[0,1,2,4,5,6,10,14,18,20,21,22,24,3,8,12,16,9,13,17,11,23].includes(i) ? 'bg-gray-800' : 'bg-transparent'}`} />
                              ))}
                            </div>
                          </div>
                          <span className="text-[9px] font-mono tracking-wider text-white/35 mt-1">a8f4bc01</span>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Label */}
                  <motion.div
                    className="flex items-center justify-center pb-4 shrink-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                  >
                    <span className="text-xs italic text-primary font-medium">
                      ← Votre entreprise est ici
                    </span>
                  </motion.div>
                </div>
              </div>

              {/* Home indicator */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[90px] h-[4px] rounded-full bg-white/30" />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
