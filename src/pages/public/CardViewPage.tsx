import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppleWalletPass } from "@/components/AppleWalletPass";
import { buildCardConfig, buildCustomerData, buildApplePassFields, getProgressInfo, getLoyaltyLabels } from "@/lib/cardConfig";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Star, Crown, Trophy, Share, Download, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { StarRating } from "@/components/public/StarRating";
import addToWalletBadge from "@/assets/add-to-apple-wallet-fr.png";

const badgeIcons: Record<string, string> = {
  first_visit: "🎯",
  streak_3: "🔥",
  streak_7: "💎",
  streak_30: "👑",
  reward_earned: "🏆",
  vip: "⭐",
};

const CardViewPage = () => {
  const { cardCode } = useParams();
  const [card, setCard] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(false);
  const [googleWalletLoading, setGoogleWalletLoading] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(true);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [canReview, setCanReview] = useState(false);

  const isAppleDevice = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;

  const handleAddToWallet = () => {
    if (!cardCode) return;
    setWalletLoading(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    window.location.href = `${supabaseUrl}/functions/v1/generate-pass?card_code=${encodeURIComponent(cardCode)}`;
  };

  const handleAddToGoogleWallet = async () => {
    if (!cardCode) return;
    setGoogleWalletLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/generate-google-pass?card_code=${encodeURIComponent(cardCode)}`
      );
      const data = await res.json();
      if (data.saveUrl) {
        window.open(data.saveUrl, "_blank");
      } else if (data.unavailable) {
        // Google Wallet not configured — hide button gracefully
        setGoogleAvailable(false);
        toast.info("Google Wallet n'est pas encore disponible pour ce commerce.");
      } else {
        toast.error("Impossible de générer la carte Google Wallet");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setGoogleWalletLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!cardCode) return;
      const { data: cardData } = await supabase
        .from("customer_cards")
        .select("id, business_id, customer_id, card_code, current_points, max_points, rewards_earned, is_active, last_visit, created_at, wallet_pass_installed, customers(*)")
        .eq("card_code", cardCode)
        .maybeSingle();

      if (!cardData) { setLoading(false); return; }
      setCard(cardData);
      setCustomer(cardData.customers);

      const { data: biz } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", cardData.business_id)
        .maybeSingle();
      if (biz) setBusiness(biz);

      // Check if customer can leave a review (visited in last 24h and no review today)
      if (cardData.customers) {
        const lastVisit = cardData.customers.last_visit_at;
        const now = new Date();
        const visitedRecently = lastVisit && (now.getTime() - new Date(lastVisit).getTime()) < 24 * 60 * 60 * 1000;
        if (visitedRecently) {
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          const { count } = await supabase.from("customer_reviews").select("*", { count: "exact", head: true })
            .eq("customer_id", cardData.customers.id)
            .eq("business_id", cardData.business_id)
            .gte("created_at", todayStart);
          if ((count || 0) === 0) setCanReview(true);
        }
      }

      setLoading(false);
    };
    fetchData();
  }, [cardCode]);

  useEffect(() => {
    if (!isStandalone) {
      const dismissed = localStorage.getItem("pwa-install-dismissed");
      if (!dismissed) setShowInstallBanner(true);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!card || !customer || !business) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold">Carte introuvable</h1>
          <p className="text-muted-foreground mt-2">Ce code carte n'est pas valide.</p>
        </div>
      </div>
    );
  }

  // ── Unified config ──
  const config = buildCardConfig(business);
  const customerData = buildCustomerData(card, customer);
  const { headerFields, primaryFields, secondaryFields, auxiliaryFields } = buildApplePassFields(config, customerData);
  const progressInfo = getProgressInfo(config, customerData);
  const labels = getLoyaltyLabels(config.loyaltyType);

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem("pwa-install-dismissed", "1");
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center p-6 pt-8 safe-area-top safe-area-bottom"
      style={{
        background: `linear-gradient(135deg, ${config.backgroundColor}10 0%, ${config.backgroundColor}05 100%)`,
      }}
    >
      {/* PWA Install Banner */}
      <AnimatePresence>
        {showInstallBanner && !isStandalone && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md mb-4 p-4 rounded-2xl bg-card border border-border/50 shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Installer l'application</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pour recevoir les notifications et accéder rapidement à votre carte
                  </p>
                  {isAppleDevice ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        1. Appuyez sur <Share className="w-3.5 h-3.5 inline text-primary" />
                      </span>
                      <span>→</span>
                      <span>2. « Sur l'écran d'accueil »</span>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Appuyez sur le menu ⋮ → « Ajouter à l'écran d'accueil »
                    </p>
                  )}
                </div>
              </div>
              <button onClick={dismissInstallBanner} className="shrink-0 p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6"
      >
        <AppleWalletPass
          backgroundColor={config.backgroundColor}
          foregroundColor={config.foregroundColor || undefined}
          labelColor={config.labelColor || undefined}
          logoUrl={config.logoUrl || undefined}
          logoText={config.businessName}
          stripImageUrl={config.stripImageUrl || undefined}
          loyaltyType={config.loyaltyType}
          currentStamps={customerData.currentPoints}
          maxStamps={customerData.maxPoints}
          headerFields={headerFields}
          primaryFields={primaryFields}
          secondaryFields={secondaryFields}
          auxiliaryFields={auxiliaryFields}
          barcodeValue={config.showQrCode ? customerData.cardCode : undefined}
          footerText={customerData.cardCode.slice(0, 12)}
          width={320}
        />

        {/* Apple Wallet button */}
        {isAppleDevice && (
          <button
            onClick={handleAddToWallet}
            disabled={walletLoading}
            className="w-full flex justify-center"
          >
            <img
              src={addToWalletBadge}
              alt="Ajouter à Apple Cartes"
              className="h-14 hover:opacity-80 transition-opacity"
              style={{ filter: walletLoading ? "grayscale(1) opacity(0.5)" : "none" }}
            />
          </button>
        )}

        {/* Google Wallet button — only if available */}
        {!isAppleDevice && googleAvailable && (
          <button
            onClick={handleAddToGoogleWallet}
            disabled={googleWalletLoading}
            className="w-full flex justify-center"
          >
            <div
              className="h-14 px-6 rounded-lg flex items-center gap-3 hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: "#1f1f1f",
                filter: googleWalletLoading ? "grayscale(1) opacity(0.5)" : "none",
              }}
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

        <p className="text-center text-xs text-muted-foreground">
          Code : <span className="font-mono">{customerData.cardCode}</span>
        </p>

        {/* Progress info */}
        <div className="p-5 rounded-2xl bg-card border border-border/50">
          {!progressInfo.isComplete ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Flame className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="font-semibold text-sm">{progressInfo.remainingText}</p>
                <p className="text-xs text-muted-foreground">{config.rewardDescription}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="font-semibold text-sm">Récompense disponible ! 🎉</p>
                <p className="text-xs text-muted-foreground">Présentez votre carte en magasin</p>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-card border border-border/50 text-center">
            <p className="text-2xl font-display font-bold">{customerData.totalVisits}</p>
            <p className="text-xs text-muted-foreground">Visites</p>
          </div>
          <div className="p-4 rounded-2xl bg-card border border-border/50 text-center">
            <p className="text-2xl font-display font-bold">{customer.current_streak || 0}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Flame className="w-3 h-3" />Streak</p>
          </div>
          <div className="p-4 rounded-2xl bg-card border border-border/50 text-center">
            <p className="text-2xl font-display font-bold">{customerData.rewardsEarned}</p>
            <p className="text-xs text-muted-foreground">Récompenses</p>
          </div>
        </div>

        {/* Badges */}
        {customer.badges && customer.badges.length > 0 && (
          <div className="p-5 rounded-2xl bg-card border border-border/50">
            <p className="font-semibold text-sm mb-3">Vos badges</p>
            <div className="flex flex-wrap gap-2">
              {customer.badges.map((badge: string) => (
                <span key={badge} className="px-3 py-1.5 rounded-full bg-secondary text-sm">
                  {badgeIcons[badge] || "🏅"} {badge.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Review section */}
        {canReview && !reviewSubmitted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl bg-card border border-border/50 space-y-3"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <p className="font-semibold text-sm">Notez votre expérience</p>
            </div>
            <div className="flex justify-center">
              <StarRating value={reviewRating} onChange={setReviewRating} />
            </div>
            {reviewRating > 0 && (
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Un commentaire ? (optionnel)"
                className="w-full rounded-xl border border-border/50 bg-background p-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/30"
                maxLength={500}
              />
            )}
            {reviewRating > 0 && (
              <Button
                onClick={async () => {
                  setReviewSubmitting(true);
                  try {
                    await supabase.from("customer_reviews").insert({
                      business_id: business.id,
                      customer_id: customer.id,
                      rating: reviewRating,
                      comment: reviewComment.trim() || null,
                    });
                    setReviewSubmitted(true);
                    setCanReview(false);
                    toast.success("Merci pour votre avis !");
                  } catch {
                    toast.error("Erreur lors de l'envoi");
                  }
                  setReviewSubmitting(false);
                }}
                disabled={reviewSubmitting}
                className="w-full rounded-xl"
                size="sm"
              >
                {reviewSubmitting ? "Envoi..." : "Envoyer mon avis"}
              </Button>
            )}
          </motion.div>
        )}
        {reviewSubmitted && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <p className="text-sm font-medium text-emerald-600">Merci pour votre avis ! ⭐</p>
          </div>
        )}

        {/* Level info */}
        <div className="p-5 rounded-2xl bg-card border border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              {customer.level === "gold" ? <Crown className="w-5 h-5 text-yellow-500" /> :
               customer.level === "silver" ? <Crown className="w-5 h-5 text-slate-400" /> :
               <Star className="w-5 h-5 text-amber-600" />}
            </div>
            <div>
              <p className="font-semibold text-sm capitalize">Niveau {customer.level}</p>
              <p className="text-xs text-muted-foreground">
                {customer.level === "bronze" ? `20 ${labels.unitPlural} pour Silver` :
                 customer.level === "silver" ? `50 ${labels.unitPlural} pour Gold` :
                 "Niveau maximum atteint !"}
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Propulsé par <span className="font-semibold text-primary">FidéliPro</span>
        </p>
      </motion.div>
    </div>
  );
};

export default CardViewPage;
