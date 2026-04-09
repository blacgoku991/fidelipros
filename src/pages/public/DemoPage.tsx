import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppleWalletPass } from "@/components/AppleWalletPass";
import { Gift, ArrowRight, Loader2, CheckCircle, Sparkles, Rocket, CreditCard, Zap, Bell, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { getLoyaltyLabels } from "@/lib/cardConfig";
import { toast } from "sonner";
import addToWalletBadge from "@/assets/add-to-apple-wallet-fr.png";

type DemoPhase = "add_pass" | "send_updates" | "cta";

interface SentUpdate {
  step: number;
  message: string;
  points: number;
  pushSent: boolean;
}

export default function DemoPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [business, setBusiness] = useState<any>(null);
  const [rewards, setRewards] = useState<any[]>([]);
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Flow state
  const [phase, setPhase] = useState<DemoPhase>("add_pass");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sentUpdates, setSentUpdates] = useState<SentUpdate[]>([]);
  const [sendingStep, setSendingStep] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [googleWalletLoading, setGoogleWalletLoading] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(true);

  const isAppleDevice = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

  // ── Load business + card + session ──
  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: biz } = await supabase
        .from("businesses")
        .select("id,name,description,primary_color,secondary_color,accent_color,foreground_color,label_color,card_style,card_bg_type,card_bg_image_url,card_animation_intensity,max_points_per_card,reward_description,address,city,phone,website,category,logo_url,loyalty_type,points_per_visit,points_per_euro,show_customer_name,show_qr_code,show_points,show_expiration,show_rewards_preview,promo_text,slug,is_demo")
        .eq("slug", slug)
        .eq("is_demo", true)
        .maybeSingle();

      if (!biz) { setNotFound(true); setLoading(false); return; }
      setBusiness(biz);

      const { data: rw } = await supabase
        .from("rewards")
        .select("*")
        .eq("business_id", biz.id)
        .eq("is_active", true)
        .order("points_required");
      setRewards(rw ?? []);

      const { data: demoCards } = await supabase
        .rpc("get_demo_card", { p_business_id: biz.id });
      if (demoCards?.[0]) setCard(demoCards[0] as any);

      // Create or resume session
      const { data: existing } = await supabase
        .from("demo_sessions")
        .select("*")
        .eq("slug", slug)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing && !existing.converted) {
        setSessionId(existing.id);
        if (existing.pass_installed) {
          if (existing.current_step >= 3) {
            setPhase("cta");
          } else {
            setPhase("send_updates");
          }
        }
        // Restore sent updates
        const restored: SentUpdate[] = [];
        if (existing.step1_at) restored.push({ step: 1, message: "Étape 1 envoyée", points: 0, pushSent: true });
        if (existing.step2_at) restored.push({ step: 2, message: "Étape 2 envoyée", points: 3, pushSent: true });
        if (existing.step3_at) restored.push({ step: 3, message: "Étape 3 envoyée", points: 6, pushSent: true });
        setSentUpdates(restored);
      } else {
        const { data: newSession } = await supabase
          .from("demo_sessions")
          .insert({ business_id: biz.id, card_id: card?.id || null, slug })
          .select("id")
          .single();
        if (newSession) setSessionId(newSession.id);
      }

      setLoading(false);
    })();
  }, [slug]);

  // ── Apple Wallet ──
  const handleAddToAppleWallet = () => {
    if (!card?.card_code) return;
    setWalletLoading(true);
    // Mark pass as installed before redirect
    if (sessionId) {
      supabase.from("demo_sessions").update({ pass_installed: true, updated_at: new Date().toISOString() }).eq("id", sessionId);
    }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    window.location.href = `${supabaseUrl}/functions/v1/generate-pass?card_code=${encodeURIComponent(card.card_code)}`;
  };

  // ── Google Wallet ──
  const handleAddToGoogleWallet = async () => {
    if (!card?.card_code) return;
    setGoogleWalletLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-google-pass?card_code=${encodeURIComponent(card.card_code)}`);
      const data = await res.json();
      if (data.saveUrl) {
        if (sessionId) {
          await supabase.from("demo_sessions").update({ pass_installed: true, updated_at: new Date().toISOString() }).eq("id", sessionId);
        }
        window.open(data.saveUrl, "_blank");
        setPhase("send_updates");
      } else if (data.unavailable) {
        setGoogleAvailable(false);
        toast.info("Google Wallet n'est pas encore disponible.");
      } else {
        toast.error("Impossible de générer la carte Google Wallet");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setGoogleWalletLoading(false);
    }
  };

  // ── Mark installed and go to step 2 (for returning from Wallet add) ──
  const handlePassAdded = async () => {
    if (sessionId) {
      await supabase.from("demo_sessions").update({ pass_installed: true, updated_at: new Date().toISOString() }).eq("id", sessionId);
    }
    setPhase("send_updates");
  };

  // ── Send a demo notification step ──
  const sendDemoStep = useCallback(async (step: number) => {
    if (!sessionId || sendingStep !== null) return;
    setSendingStep(step);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/demo-sequence`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
        body: JSON.stringify({ session_id: sessionId, step }),
      });
      const result = await res.json();
      if (result.success) {
        setSentUpdates(prev => [...prev, {
          step,
          message: result.change_message,
          points: result.new_points ?? 0,
          pushSent: result.push_sent || false,
        }]);
        toast.success(result.push_sent
          ? "Notification push envoyée sur votre appareil !"
          : "Mise à jour envoyée (simulation)");

        if (step === 3) {
          setTimeout(() => setPhase("cta"), 2000);
        }
      } else {
        toast.error(result.error || "Erreur lors de l'envoi");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setSendingStep(null);
    }
  }, [sessionId, sendingStep]);

  const trackClick = async (type: "signup" | "pricing") => {
    if (sessionId) {
      const update: Record<string, any> = { updated_at: new Date().toISOString() };
      if (type === "signup") update.clicked_signup = true;
      if (type === "pricing") update.clicked_pricing = true;
      await supabase.from("demo_sessions").update(update).eq("id", sessionId);
    }
  };

  // ── Loading / Not found ──
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
        <p className="text-muted-foreground">Ce lien n'existe pas ou a été supprimé.</p>
      </div>
    );
  }

  const color = business.primary_color ?? "#6B46C1";
  const loyaltyType = business.loyalty_type || "points";
  const labels = getLoyaltyLabels(loyaltyType);
  const maxPts = business.max_points_per_card || 10;
  const currentPoints = sentUpdates.length > 0 ? sentUpdates[sentUpdates.length - 1].points : 6;

  const steps = [
    { num: 1, label: "Ajoutez la carte", icon: CreditCard },
    { num: 2, label: "Envoyez les notifications", icon: Bell },
    { num: 3, label: "Lancez votre programme", icon: Rocket },
  ];
  const activeIdx = phase === "add_pass" ? 0 : phase === "send_updates" ? 1 : 2;

  // Demo update definitions
  const demoSteps = [
    { step: 1, emoji: "🎉", title: "Activation du programme", desc: `Message de bienvenue envoyé au client` },
    { step: 2, emoji: "⭐", title: `Ajout de ${labels.unitPlural}`, desc: `Le client gagne 3 ${labels.unitPlural} après sa visite` },
    { step: 3, emoji: "🎁", title: "Teaser récompense", desc: `Notification de progression vers la récompense` },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Banner */}
      <div className="sticky top-0 z-50 text-center py-2.5 px-4 text-sm font-medium text-white" style={{ backgroundColor: color }}>
        🎭 Démonstration — {business.name}
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-10">
          {steps.map((s, i) => {
            const StepIcon = s.icon;
            const isActive = i === activeIdx;
            const isDone = i < activeIdx;
            return (
              <div key={s.num} className="flex items-center gap-2 sm:gap-3">
                {i > 0 && <div className={`hidden sm:block w-8 h-0.5 ${isDone ? 'bg-primary' : 'bg-border'}`} />}
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isActive ? 'bg-primary text-primary-foreground shadow-lg scale-110' :
                    isDone ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {isDone ? <CheckCircle className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                  </div>
                  <span className={`text-[11px] font-medium text-center leading-tight max-w-[80px] ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {s.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {/* ═══ PHASE 1: Add to Wallet ═══ */}
          {phase === "add_pass" && (
            <motion.div key="add" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color }}>
                  Ajoutez la carte à votre Wallet
                </h1>
                <p className="text-muted-foreground">
                  Ajoutez-la réellement, puis envoyez des notifications pour voir le résultat
                </p>
              </div>

              <div className="flex justify-center">
                <AppleWalletPass
                  backgroundColor={color}
                  logoText={business.name}
                  headerFields={[{ key: "level", label: "NIVEAU", value: "Silver ⭐" }]}
                  primaryFields={[{ key: "pts", label: labels.pointsLabel, value: `6 / ${maxPts}` }]}
                  secondaryFields={[
                    { key: "name", label: "CLIENT", value: "Marie Dupont" },
                    { key: "reward", label: "RÉCOMPENSE", value: rewards[0]?.title ?? "Offre spéciale" },
                  ]}
                  auxiliaryFields={[
                    { key: "visits", label: "VISITES", value: "6" },
                    { key: "next", label: "PROCHAIN", value: `4 ${labels.unitPlural}` },
                  ]}
                  width={300}
                />
              </div>

              <div className="flex flex-col items-center gap-4">
                {/* Apple Wallet */}
                {isAppleDevice && card?.card_code && (
                  <button onClick={handleAddToAppleWallet} disabled={walletLoading} className="flex justify-center">
                    <img
                      src={addToWalletBadge}
                      alt="Ajouter à Apple Cartes"
                      className="h-14 hover:opacity-80 transition-opacity"
                      style={{ filter: walletLoading ? "grayscale(1) opacity(0.5)" : "none" }}
                    />
                  </button>
                )}

                {/* Google Wallet */}
                {!isAppleDevice && googleAvailable && card?.card_code && (
                  <button onClick={handleAddToGoogleWallet} disabled={googleWalletLoading} className="flex justify-center">
                    <div
                      className="h-14 px-6 rounded-lg flex items-center gap-3 hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: "#1f1f1f", filter: googleWalletLoading ? "grayscale(1) opacity(0.5)" : "none" }}
                    >
                      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
                        <path d="M21.4 11.3l-1-1.6-2.1 1.2.1-2.4h-1.9l.1 2.4-2.1-1.2-1 1.6 2.1 1.2-2.1 1.2 1 1.6 2.1-1.2-.1 2.4h1.9l-.1-2.4 2.1 1.2 1-1.6-2.1-1.2 2.1-1.2z" fill="#FBBC04"/>
                        <path d="M7.5 20C4.5 20 2 17.5 2 14.5S4.5 9 7.5 9c1.7 0 3 .6 4 1.7l-1.6 1.5c-.6-.6-1.4-.9-2.4-.9-2 0-3.6 1.6-3.6 3.6s1.6 3.6 3.6 3.6c1.5 0 2.3-.6 2.8-1.1.4-.4.7-1 .8-1.8H7.5v-2.1h5.8c.1.3.1.7.1 1.1 0 1.3-.4 3-1.5 4.1-1.1 1.2-2.5 1.8-4.4 1.8z" fill="#4285F4"/>
                      </svg>
                      <div className="text-left">
                        <p className="text-[10px] text-gray-400 leading-none">Ajouter à</p>
                        <p className="text-white font-medium text-base leading-tight">Google Wallet</p>
                      </div>
                    </div>
                  </button>
                )}

                {/* "J'ai ajouté la carte" confirmation button */}
                <Button onClick={handlePassAdded} variant="outline" size="lg" className="gap-2 mt-2">
                  <CheckCircle className="w-4 h-4" />
                  J'ai ajouté la carte → Passer aux notifications
                </Button>
              </div>
            </motion.div>
          )}

          {/* ═══ PHASE 2: Send notifications manually ═══ */}
          {phase === "send_updates" && (
            <motion.div key="send" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Envoyez les notifications</h2>
                <p className="text-muted-foreground text-sm">
                  Cliquez sur chaque bouton pour envoyer une vraie notification push sur votre appareil
                </p>
              </div>

              {/* Live card preview */}
              <div className="flex justify-center">
                <AppleWalletPass
                  backgroundColor={color}
                  logoText={business.name}
                  headerFields={[{ key: "level", label: "NIVEAU", value: "Silver ⭐" }]}
                  primaryFields={[{ key: "pts", label: labels.pointsLabel, value: `${currentPoints} / ${maxPts}` }]}
                  secondaryFields={[
                    { key: "name", label: "CLIENT", value: "Marie Dupont" },
                    { key: "reward", label: "RÉCOMPENSE", value: rewards[0]?.title ?? "Offre spéciale" },
                  ]}
                  auxiliaryFields={[
                    { key: "visits", label: "VISITES", value: String(currentPoints) },
                    { key: "next", label: "PROCHAIN", value: `${maxPts - currentPoints} ${labels.unitPlural}` },
                  ]}
                  width={300}
                />
              </div>

              {/* Manual send buttons */}
              <div className="space-y-3 max-w-md mx-auto">
                {demoSteps.map(({ step, emoji, title, desc }) => {
                  const alreadySent = sentUpdates.some(u => u.step === step);
                  const isSending = sendingStep === step;
                  const prevSent = step === 1 || sentUpdates.some(u => u.step === step - 1);
                  const canSend = !alreadySent && prevSent && sendingStep === null;

                  return (
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * step }}
                      className={`p-4 rounded-xl border transition-all ${
                        alreadySent ? 'bg-primary/5 border-primary/30' :
                        canSend ? 'bg-card border-primary/50 shadow-md' :
                        'bg-muted/30 border-border/30'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-2xl">{emoji}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{title}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                          {alreadySent && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                sentUpdates.find(u => u.step === step)?.pushSent
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : 'bg-amber-500/10 text-amber-600'
                              }`}>
                                {sentUpdates.find(u => u.step === step)?.pushSent ? "Push envoyé ✓" : "Simulation"}
                              </span>
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          disabled={!canSend || isSending}
                          onClick={() => sendDemoStep(step)}
                          className="shrink-0 gap-1.5"
                          variant={alreadySent ? "outline" : "default"}
                          style={canSend ? { backgroundColor: color } : undefined}
                        >
                          {isSending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : alreadySent ? (
                            <CheckCircle className="w-3.5 h-3.5" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          {alreadySent ? "Envoyé" : isSending ? "Envoi…" : "Envoyer"}
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Skip to CTA */}
              {sentUpdates.length >= 1 && (
                <div className="text-center">
                  <Button variant="ghost" size="sm" className="text-muted-foreground gap-1" onClick={() => setPhase("cta")}>
                    Passer à la suite <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ PHASE 3: Conversion CTA ═══ */}
          {phase === "cta" && (
            <motion.div key="cta" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-2">
                  Prêt à lancer votre programme ?
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Vous venez de voir comment vos clients reçoivent des mises à jour directement dans leur Wallet. Carte digitale, notifications push, progression vers les récompenses.
                </p>
              </div>

              {/* Value props */}
              <div className="grid sm:grid-cols-3 gap-4 max-w-lg mx-auto">
                {[
                  { icon: CreditCard, title: "Carte digitale", desc: "Apple & Google Wallet" },
                  { icon: Zap, title: "Push en temps réel", desc: "Notifications instantanées" },
                  { icon: Gift, title: "Récompenses", desc: "Fidélisez vos clients" },
                ].map((v, i) => {
                  const VIcon = v.icon;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * i }}
                      className="p-4 rounded-xl bg-card border text-center"
                    >
                      <VIcon className="w-6 h-6 mx-auto mb-2" style={{ color }} />
                      <p className="font-semibold text-sm">{v.title}</p>
                      <p className="text-xs text-muted-foreground">{v.desc}</p>
                    </motion.div>
                  );
                })}
              </div>

              {/* Sent updates recap */}
              {sentUpdates.length > 0 && (
                <div className="p-4 rounded-xl bg-muted/30 border max-w-md mx-auto">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Ce que vous avez envoyé</p>
                  {sentUpdates.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 text-sm">
                      <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{u.message}</span>
                      {u.pushSent && <span className="text-[10px] text-emerald-600 shrink-0">Push ✓</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* CTA */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  size="lg"
                  className="w-full sm:w-auto gap-2 text-base px-8"
                  style={{ backgroundColor: color }}
                  onClick={async () => { await trackClick("signup"); navigate("/register"); }}
                >
                  <Rocket className="w-5 h-5" />
                  Créer mon compte
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto gap-2 text-base px-8"
                  onClick={async () => { await trackClick("pricing"); navigate("/tarifs"); }}
                >
                  Voir les offres <ArrowRight className="w-4 h-4" />
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Propulsé par <span className="font-semibold text-primary">FidélisPro</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
