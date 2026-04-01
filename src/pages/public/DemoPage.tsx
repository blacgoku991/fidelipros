import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppleWalletPass } from "@/components/AppleWalletPass";
import { QRCodeSVG } from "qrcode.react";
import { Gift, Star, Bell, ArrowRight, Loader2, CheckCircle, Sparkles, Rocket, CreditCard, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { getLoyaltyLabels } from "@/lib/cardConfig";
import addToWalletBadge from "@/assets/add-to-apple-wallet-fr.png";

type DemoStep = "add_pass" | "demo_running" | "cta";

interface DemoUpdate {
  step: number;
  message: string;
  points: number;
  completed: boolean;
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

  // Demo flow state
  const [currentPhase, setCurrentPhase] = useState<DemoStep>("add_pass");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [demoUpdates, setDemoUpdates] = useState<DemoUpdate[]>([]);
  const [currentDemoStep, setCurrentDemoStep] = useState(0);
  const [walletLoading, setWalletLoading] = useState(false);
  const [passInstalled, setPassInstalled] = useState(false);
  const sequenceRunning = useRef(false);

  const isAppleDevice = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: biz } = await supabase
        .from("businesses")
        .select("*")
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

      // Fetch the demo card
      const { data: cards } = await supabase
        .from("customer_cards")
        .select("*")
        .eq("business_id", biz.id)
        .limit(1);
      if (cards?.[0]) setCard(cards[0]);

      // Create or fetch demo session
      const { data: existingSession } = await supabase
        .from("demo_sessions")
        .select("*")
        .eq("slug", slug)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSession && !existingSession.converted) {
        setSessionId(existingSession.id);
        if (existingSession.pass_installed) {
          setPassInstalled(true);
          if (existingSession.current_step >= 3) {
            setCurrentPhase("cta");
            setCurrentDemoStep(3);
          } else if (existingSession.demo_started) {
            setCurrentPhase("demo_running");
            setCurrentDemoStep(existingSession.current_step);
          }
        }
      } else {
        const { data: newSession } = await supabase
          .from("demo_sessions")
          .insert({
            business_id: biz.id,
            card_id: cards?.[0]?.id || null,
            slug,
          })
          .select("id")
          .single();
        if (newSession) setSessionId(newSession.id);
      }

      setLoading(false);
    })();
  }, [slug]);

  const triggerDemoStep = useCallback(async (step: number) => {
    if (!sessionId) return null;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/demo-sequence`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
        body: JSON.stringify({ session_id: sessionId, step }),
      });
      return await res.json();
    } catch {
      return null;
    }
  }, [sessionId]);

  const runDemoSequence = useCallback(async () => {
    if (sequenceRunning.current) return;
    sequenceRunning.current = true;
    setCurrentPhase("demo_running");

    const delays = [5000, 15000, 20000]; // Step 1 at 5s, step 2 at 15s, step 3 at 20s

    for (let step = 1; step <= 3; step++) {
      await new Promise(r => setTimeout(r, delays[step - 1]));
      setCurrentDemoStep(step);
      const result = await triggerDemoStep(step);
      setDemoUpdates(prev => [...prev, {
        step,
        message: result?.change_message || `Étape ${step} terminée`,
        points: result?.new_points ?? 0,
        completed: true,
        pushSent: result?.push_sent || false,
      }]);
    }

    // Show CTA after a short pause
    await new Promise(r => setTimeout(r, 3000));
    setCurrentPhase("cta");
    sequenceRunning.current = false;
  }, [triggerDemoStep]);

  const handleAddToWallet = () => {
    if (!card?.card_code) return;
    setWalletLoading(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    window.location.href = `${supabaseUrl}/functions/v1/generate-pass?card_code=${encodeURIComponent(card.card_code)}`;
  };

  const handleSimulateInstall = async () => {
    setPassInstalled(true);
    if (sessionId) {
      await supabase
        .from("demo_sessions")
        .update({ pass_installed: true, updated_at: new Date().toISOString() })
        .eq("id", sessionId);
    }
    runDemoSequence();
  };

  const trackClick = async (type: "signup" | "pricing") => {
    if (sessionId) {
      const update: Record<string, any> = { updated_at: new Date().toISOString() };
      if (type === "signup") update.clicked_signup = true;
      if (type === "pricing") update.clicked_pricing = true;
      await supabase.from("demo_sessions").update(update).eq("id", sessionId);
    }
  };

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
  const loyaltyType = business.loyalty_type || "points";
  const labels = getLoyaltyLabels(loyaltyType);
  const maxPts = business.max_points_per_card || 10;
  const displayPoints = demoUpdates.length > 0 ? demoUpdates[demoUpdates.length - 1].points : 6;

  const steps = [
    { num: 1, label: "Ajoutez la carte", icon: CreditCard },
    { num: 2, label: "Recevez les mises à jour", icon: Bell },
    { num: 3, label: "Lancez votre programme", icon: Rocket },
  ];

  const activeStepIndex = currentPhase === "add_pass" ? 0 : currentPhase === "demo_running" ? 1 : 2;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Demo banner */}
      <div className="sticky top-0 z-50 text-center py-2.5 px-4 text-sm font-medium text-white" style={{ backgroundColor: color }}>
        🎭 Démonstration — {business.name}
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-10">
          {steps.map((s, i) => {
            const StepIcon = s.icon;
            const isActive = i === activeStepIndex;
            const isDone = i < activeStepIndex;
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

        {/* PHASE 1: Add pass */}
        <AnimatePresence mode="wait">
          {currentPhase === "add_pass" && (
            <motion.div
              key="add_pass"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color }}>
                  Découvrez votre carte de fidélité
                </h1>
                <p className="text-muted-foreground">
                  Ajoutez-la à votre Wallet pour voir la magie en action
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

              <div className="flex flex-col items-center gap-3">
                {/* Apple Wallet button */}
                {isAppleDevice && card?.card_code && (
                  <button onClick={handleAddToWallet} disabled={walletLoading} className="flex justify-center">
                    <img
                      src={addToWalletBadge}
                      alt="Ajouter à Apple Cartes"
                      className="h-14 hover:opacity-80 transition-opacity"
                      style={{ filter: walletLoading ? "grayscale(1) opacity(0.5)" : "none" }}
                    />
                  </button>
                )}

                {/* Simulate install button (demo fallback or non-Apple) */}
                <Button
                  onClick={handleSimulateInstall}
                  variant={isAppleDevice ? "outline" : "default"}
                  size="lg"
                  className="gap-2"
                  style={!isAppleDevice ? { backgroundColor: color } : undefined}
                >
                  <Sparkles className="w-4 h-4" />
                  {isAppleDevice ? "Simuler l'ajout (démo)" : "Voir la démo en action"}
                </Button>
              </div>
            </motion.div>
          )}

          {/* PHASE 2: Demo running */}
          {currentPhase === "demo_running" && (
            <motion.div
              key="demo_running"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Démo en cours…</h2>
                <p className="text-muted-foreground text-sm">
                  Regardez votre carte se mettre à jour en temps réel
                </p>
              </div>

              {/* Live card preview */}
              <div className="flex justify-center">
                <AppleWalletPass
                  backgroundColor={color}
                  logoText={business.name}
                  headerFields={[{ key: "level", label: "NIVEAU", value: "Silver ⭐" }]}
                  primaryFields={[{ key: "pts", label: labels.unitLabel.toUpperCase(), value: `${displayPoints} / ${maxPts}` }]}
                  secondaryFields={[
                    { key: "name", label: "CLIENT", value: "Marie Dupont" },
                    { key: "reward", label: "RÉCOMPENSE", value: rewards[0]?.title ?? "Offre spéciale" },
                  ]}
                  auxiliaryFields={[
                    { key: "visits", label: "VISITES", value: String(displayPoints) },
                    { key: "next", label: "PROCHAIN", value: `${maxPts - displayPoints} ${labels.unitPlural}` },
                  ]}
                  width={300}
                />
              </div>

              {/* Update timeline */}
              <div className="space-y-3 max-w-md mx-auto">
                {[1, 2, 3].map((step) => {
                  const update = demoUpdates.find(u => u.step === step);
                  const isWaiting = !update && step > currentDemoStep;
                  const isCurrent = step === currentDemoStep && !update;

                  return (
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: update || isCurrent ? 1 : 0.4, x: 0 }}
                      transition={{ delay: 0.1 * step }}
                      className={`p-4 rounded-xl border transition-all ${
                        update ? 'bg-card border-primary/30 shadow-sm' :
                        isCurrent ? 'bg-card border-primary/50 shadow-md' :
                        'bg-muted/30 border-border/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          update ? 'bg-primary/20 text-primary' :
                          isCurrent ? 'bg-primary text-primary-foreground' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {update ? <CheckCircle className="w-4 h-4" /> :
                           isCurrent ? <Loader2 className="w-4 h-4 animate-spin" /> :
                           <span className="text-xs font-bold">{step}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          {update ? (
                            <>
                              <p className="text-sm font-medium">{update.message}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {update.pushSent && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
                                    Push envoyé ✓
                                  </span>
                                )}
                                {!update.pushSent && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                                    Simulation
                                  </span>
                                )}
                              </div>
                            </>
                          ) : isCurrent ? (
                            <p className="text-sm text-muted-foreground">Mise à jour en cours…</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">En attente…</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* PHASE 3: CTA */}
          {currentPhase === "cta" && (
            <motion.div
              key="cta"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Recap updates */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-2">
                  Prêt à lancer votre programme ?
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Vous venez de voir comment vos clients vivent l'expérience : carte dans le Wallet, mises à jour instantanées, progression vers les récompenses.
                </p>
              </div>

              {/* Value props */}
              <div className="grid sm:grid-cols-3 gap-4 max-w-lg mx-auto">
                {[
                  { icon: CreditCard, title: "Carte digitale", desc: "Apple & Google Wallet" },
                  { icon: Zap, title: "Notifications push", desc: "Mises à jour automatiques" },
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

              {/* Demo summary */}
              {demoUpdates.length > 0 && (
                <div className="p-4 rounded-xl bg-muted/30 border max-w-md mx-auto">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Résumé de la démo</p>
                  {demoUpdates.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 text-sm">
                      <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{u.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  size="lg"
                  className="w-full sm:w-auto gap-2 text-base px-8"
                  style={{ backgroundColor: color }}
                  onClick={async () => {
                    await trackClick("signup");
                    navigate("/register");
                  }}
                >
                  <Rocket className="w-5 h-5" />
                  Créer mon compte
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto gap-2 text-base px-8"
                  onClick={async () => {
                    await trackClick("pricing");
                    navigate("/tarifs");
                  }}
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
