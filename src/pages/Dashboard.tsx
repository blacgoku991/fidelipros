import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { usePermissions } from "@/hooks/usePermissions";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { QrCameraScanner } from "@/components/dashboard/QrCameraScanner";
import { ScanResultPopup } from "@/components/dashboard/ScanResultPopup";
import { AnalyticsChart } from "@/components/dashboard/AnalyticsChart";
import { FloatingActionButton } from "@/components/dashboard/FloatingActionButton";
import { RecentActivityWidget } from "@/components/dashboard/RecentActivityWidget";
import { ProgramHealthScore } from "@/components/dashboard/ProgramHealthScore";
import { BusinessResults } from "@/components/dashboard/BusinessResults";
import { SmartSuggestions } from "@/components/dashboard/SmartSuggestions";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, TrendingUp, QrCode, Crown, Sparkles, Search,
  Download, Copy, ExternalLink, Printer, Flame, Gift, Eye,
  Mail, Phone, History, MapPin, Star as StarIcon, MessageSquare,
  CheckCircle2, Circle, Palette, Send, Camera, ArrowUp, ArrowDown, Info,
  BarChart3, Euro,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { queueScan, getPendingScans, removeScan, getPendingCount } from "@/lib/offlineScanQueue";
import { OnboardingTour } from "@/components/dashboard/OnboardingTour";
import { FranchiseOverview } from "@/components/dashboard/FranchiseOverview";

const levelConfig: Record<string, { bg: string; text: string; label: string; emoji: string }> = {
  bronze: { bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", label: "Bronze", emoji: "🥉" },
  silver: { bg: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-300", label: "Silver", emoji: "🥈" },
  gold: { bg: "bg-yellow-500/10", text: "text-yellow-700 dark:text-yellow-400", label: "Gold", emoji: "⭐" },
};

const Dashboard = () => {
  const { user, business, loading, locationId, isFranchiseOwner } = useAuth();
  const navigate = useNavigate();
  const { permissions, requestNotifications, requestGeolocation } = usePermissions();
  const hasRedirected = useRef(false);

  // Safety net: redirect to correct onboarding step based on business state
  useEffect(() => {
    if (loading || hasRedirected.current) return;
    if (!business) {
      hasRedirected.current = true;
      navigate("/onboarding-business");
      return;
    }
    const name = business.name;
    const status = business.subscription_status;
    const onboardingCompleted = business.onboarding_completed;
    if (!name || name === "Mon Commerce") {
      hasRedirected.current = true;
      navigate("/onboarding-business");
    } else if (status === "active" && onboardingCompleted === false) {
      // Subscription paid but wizard not done yet (e.g. user navigated directly to /dashboard)
      hasRedirected.current = true;
      navigate("/setup");
    }
  }, [loading, business]);
  const { data: siteSettings } = useSiteSettings();
  const [permissionsDismissed, setPermissionsDismissed] = useState(false);
  const [stats, setStats] = useState({ clients: 0, returnRate: 0, scansToday: 0, rewardsGiven: 0, avgVisits: 0, avgRating: 0 });
  const [stats30dAgo, setStats30dAgo] = useState({ clients: 0, scansToday: 0, rewardsGiven: 0 });
  const [totalScans, setTotalScans] = useState(0);

  // Onboarding
  const [onboarding, setOnboarding] = useState({ hasCustomized: false, hasReward: false, hasScanned: false, hasCampaign: false });

  // Scanner
  const [cardCode, setCardCode] = useState("");
  const [scanAmount, setScanAmount] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scannerPaused, setScannerPaused] = useState(false);
  const scanLockRef = useRef(false);
  const [lastScan, setLastScan] = useState<any>(null);
  const [todayScans, setTodayScans] = useState(0);
  const isOnline = useOnlineStatus();
  const [pendingScanCount, setPendingScanCount] = useState(0);

  const loyaltyType = business?.loyalty_type || "stamps";
  const isCashback = loyaltyType === "cashback";
  const isEuroToPoints = loyaltyType === "points" && (business?.points_per_euro || 0) > 0;
  const needsAmount = isCashback || isEuroToPoints;
  const minPurchaseAmount = parseFloat((business as any)?.reward_min_purchase) || 0;
  const showAmountInput = needsAmount || minPurchaseAmount > 0;

  // Popup
  const [popup, setPopup] = useState<{
    open: boolean;
    type: "success" | "reward" | "error" | "pending";
    title: string;
    message: string;
    details?: string;
  }>({ open: false, type: "success", title: "", message: "" });

  // Clients
  const [customers, setCustomers] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [clientHistory, setClientHistory] = useState<Record<string, any[]>>({});
  const [selectedClient, setSelectedClient] = useState<any>(null);

  useEffect(() => {
    if (!business) return;
    fetchStats();
    fetchCustomers();
    fetchOnboarding();
  }, [business]);

  const fetchOnboarding = async () => {
    if (!business) return;
    const hasCustomized = !!(business.logo_url || (business.primary_color && business.primary_color !== "#6B46C1"));
    const { count: rewardCount } = await supabase.from("rewards").select("*", { count: "exact", head: true }).eq("business_id", business.id);
    const { count: scanCount } = await supabase.from("points_history").select("*", { count: "exact", head: true }).eq("business_id", business.id);
    const { count: campaignCount } = await supabase.from("notification_campaigns").select("*", { count: "exact", head: true }).eq("business_id", business.id);
    setOnboarding({
      hasCustomized,
      hasReward: (rewardCount || 0) > 0,
      hasScanned: (scanCount || 0) > 0,
      hasCampaign: (campaignCount || 0) > 0,
    });
    setTotalScans(scanCount || 0);
  };

  const fetchStats = async () => {
    if (!business) return;
    const { count: clientCount } = await supabase
      .from("customers").select("*", { count: "exact", head: true }).eq("business_id", business.id);
    const { data: rewardCards } = await supabase
      .from("customer_cards").select("rewards_earned").eq("business_id", business.id).gt("rewards_earned", 0);
    const rewardCount = rewardCards?.reduce((sum, c) => sum + (c.rewards_earned || 0), 0) || 0;
    const today = new Date().toISOString().split("T")[0];
    let scansTodayQ = supabase.from("points_history").select("*", { count: "exact", head: true }).eq("business_id", business.id).gte("created_at", today);
    if (locationId) scansTodayQ = scansTodayQ.eq("location_id", locationId);
    const { count: scansCount } = await scansTodayQ;

    // Return rate: customers with >1 visit / total customers
    const { data: returningData } = await supabase
      .from("customers").select("id", { count: "exact", head: false }).eq("business_id", business.id).gt("total_visits", 1);
    const returningCount = returningData?.length || 0;
    const returnRate = clientCount ? Math.round((returningCount / clientCount) * 100) : 0;

    // Average visits
    const { data: visitData } = await supabase
      .from("customers").select("total_visits").eq("business_id", business.id);
    const avgVisits = visitData && visitData.length > 0
      ? (visitData.reduce((sum, c) => sum + (c.total_visits || 0), 0) / visitData.length)
      : 0;

    // Average rating
    const { data: reviewData } = await supabase
      .from("customer_reviews").select("rating").eq("business_id", business.id);
    const avgRating = reviewData && reviewData.length > 0
      ? (reviewData.reduce((sum, r) => sum + r.rating, 0) / reviewData.length)
      : 0;

    // 30 days ago stats for trends
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();
    const { count: clientsPrev } = await supabase
      .from("customers").select("*", { count: "exact", head: true }).eq("business_id", business.id).lte("created_at", thirtyDaysAgo);
    let scansPrevQ = supabase.from("points_history").select("*", { count: "exact", head: true }).eq("business_id", business.id).gte("created_at", sixtyDaysAgo).lte("created_at", thirtyDaysAgo);
    if (locationId) scansPrevQ = scansPrevQ.eq("location_id", locationId);
    const { count: scansPrev } = await scansPrevQ;

    setStats({
      clients: clientCount || 0,
      returnRate,
      scansToday: scansCount || 0,
      rewardsGiven: rewardCount,
      avgVisits: Math.round(avgVisits * 10) / 10,
      avgRating: Math.round(avgRating * 10) / 10,
    });
    setStats30dAgo({
      clients: clientsPrev || 0,
      scansToday: scansPrev || 0,
      rewardsGiven: 0,
    });
  };

  const fetchCustomers = async () => {
    if (!business) return;
    const { data } = await supabase
      .from("customers").select("*, customer_cards(*)").eq("business_id", business.id).order("created_at", { ascending: false }).limit(50);
    if (data) setCustomers(data);
  };

  const fetchClientHistory = async (customerId: string) => {
    if (clientHistory[customerId]) return;
    const { data } = await supabase
      .from("points_history").select("*").eq("customer_id", customerId).eq("business_id", business!.id).order("created_at", { ascending: false }).limit(20);
    if (data) setClientHistory(prev => ({ ...prev, [customerId]: data }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié !`);
  };

  // ── Scanner logic ─────────────────────────────────────────
  // Sync pending offline scans when coming back online
  useEffect(() => {
    if (!isOnline || !business || !user) return;
    const syncOffline = async () => {
      const pending = await getPendingScans();
      for (const scan of pending) {
        try {
          await processCardCode(scan.cardCode, true);
          await removeScan(scan.id!);
        } catch { /* will retry next time */ }
      }
      setPendingScanCount(await getPendingCount());
    };
    syncOffline();
  }, [isOnline, business, user]);

  // Load pending count on mount
  useEffect(() => {
    getPendingCount().then(setPendingScanCount);
  }, []);

  const processCardCode = async (code: string, isSyncMode = false) => {
    // Prevent concurrent scan executions (double-scan guard)
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    if (!code.trim() || !business || !user) {
      scanLockRef.current = false;
      return;
    }

    if (showAmountInput && !isSyncMode && (!scanAmount || parseFloat(scanAmount) <= 0)) {
      toast.error("Entrez le montant de la commande");
      scanLockRef.current = false;
      return;
    }

    // Offline fallback: queue scan and show toast
    if (!isOnline && !isSyncMode) {
      await queueScan({ cardCode: code.trim(), businessId: business.id, userId: user.id, timestamp: new Date().toISOString() });
      setPendingScanCount(await getPendingCount());
      toast.info("Scan enregistré hors-ligne. Il sera synchronisé au retour de la connexion.");
      setCardCode("");
      scanLockRef.current = false;
      return;
    }

    setScanning(true);
    setScannerPaused(true);

    const { data: card, error: cardError } = await supabase
      .from("customer_cards").select("*, customers(*)").eq("card_code", code.trim()).eq("business_id", business.id).eq("is_active", true).maybeSingle();

    if (!card || cardError) {
      setPopup({ open: true, type: "error", title: "Carte introuvable", message: "Ce code ne correspond à aucune carte active." });
      setScanning(false);
      scanLockRef.current = false;
      return;
    }

    // ── Anti double-scan: check cooldown ──────────────────────────
    const { data: cooldown } = await supabase
      .from("scan_cooldowns")
      .select("last_scan")
      .eq("card_id", card.id)
      .maybeSingle();

    if (cooldown?.last_scan) {
      const elapsed = (Date.now() - new Date(cooldown.last_scan).getTime()) / 1000;
      if (elapsed < 30) {
        const remaining = Math.ceil(30 - elapsed);
        toast.warning(`⏱ Scan trop rapide`, {
          description: `Attendez encore ${remaining}s avant de scanner cette carte à nouveau.`,
        });
        setScanning(false);
        scanLockRef.current = false;
        return;
      }
    }

    const lt = business.loyalty_type || "points";
    let pointsToAdd = business.points_per_visit || 1;
    if (needsAmount && !isSyncMode) {
      const purchaseAmount = parseFloat(scanAmount) || 0;
      const ppe = business.points_per_euro || 1;
      if (isCashback) {
        pointsToAdd = Math.floor(purchaseAmount * ppe / 100);
      } else {
        pointsToAdd = Math.floor(purchaseAmount * ppe);
      }
      if (pointsToAdd < 1) pointsToAdd = 1;
    }
    const maxPts = card.max_points || business.max_points_per_card || 10;
    const currentPts = card.current_points || 0;
    const newPoints = currentPts + pointsToAdd;

    // ── Reward redemption logic with configurable conditions ──
    const bReward = business as any;
    const nextVisitOnly = bReward.reward_next_visit_only === true;
    const minPurchase = parseFloat(bReward.reward_min_purchase) || 0;
    const purchaseAmountForCheck = showAmountInput ? (parseFloat(scanAmount) || 0) : Infinity;

    // Was the threshold already reached BEFORE this scan?
    const wasAlreadyReady = currentPts >= maxPts;
    // Is the threshold reached now (after adding points)?
    const reachesThresholdNow = newPoints >= maxPts;

    let rewardEarned = false;
    let rewardPending = false;

    if (wasAlreadyReady) {
      // Threshold was already met — this is a "next visit"
      if (minPurchase > 0 && purchaseAmountForCheck < minPurchase) {
        // Minimum purchase not met — reward stays pending
        rewardPending = true;
      } else {
        rewardEarned = true;
      }
    } else if (reachesThresholdNow) {
      if (nextVisitOnly) {
        // Must come back next time — don't claim now
        rewardPending = true;
      } else if (minPurchase > 0 && purchaseAmountForCheck < minPurchase) {
        rewardPending = true;
      } else {
        rewardEarned = true;
      }
    }

    const customer = card.customers;
    const unitLabel = lt === "stamps" ? "tampon" : lt === "cashback" ? "€" : "point";
    const unitLabelPlural = lt === "stamps" ? "tampons" : lt === "cashback" ? "€" : "points";
    const addedLabel = pointsToAdd > 1 ? `+${pointsToAdd} ${unitLabelPlural}` : `+1 ${unitLabel}`;

    const effectivePoints = rewardEarned ? 0 : newPoints;

    const changeMsg = rewardEarned
      ? `🎁 Récompense débloquée chez ${business.name} !`
      : rewardPending
        ? `🎁 Récompense en attente${minPurchase > 0 ? ` (min. ${minPurchase}€)` : ""} chez ${business.name}`
        : `${addedLabel} chez ${business.name} ! ${newPoints}/${maxPts} ${unitLabelPlural}.`;

    const { error: updateError } = await supabase.from("customer_cards").update({
      current_points: effectivePoints,
      rewards_earned: rewardEarned ? (card.rewards_earned || 0) + 1 : card.rewards_earned,
      wallet_change_message: changeMsg,
      updated_at: new Date().toISOString(),
    }).eq("id", card.id);

    if (updateError) {
      setPopup({ open: true, type: "error", title: "Erreur", message: "La mise à jour des points a échoué. Réessayez." });
      setScanning(false);
      scanLockRef.current = false;
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      await fetch(`https://${projectId}.supabase.co/functions/v1/wallet-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ business_id: business.id, customer_id: customer.id, action_type: "points_increment", change_message: changeMsg }),
      });
    } catch { /* non-blocking */ }

    const newStreak = (customer.current_streak || 0) + 1;
    const newTotalPoints = (customer.total_points || 0) + pointsToAdd;
    const prevLevel = customer.level || "bronze";
    const newLevel: "bronze" | "silver" | "gold" =
      newTotalPoints >= ((business as any).tier_gold_points || 25) ? "gold" : newTotalPoints >= ((business as any).tier_silver_points || 10) ? "silver" : "bronze";
    const levelChanged = newLevel !== prevLevel && (newLevel === "silver" || newLevel === "gold");

    const { error: custErr } = await supabase.from("customers").update({
      total_points: newTotalPoints,
      total_visits: (customer.total_visits || 0) + 1,
      current_streak: newStreak,
      longest_streak: Math.max(newStreak, customer.longest_streak || 0),
      last_visit_at: new Date().toISOString(),
      level: newLevel,
    }).eq("id", customer.id);
    if (custErr) { /* silent — non-critical update */ }

    // Send level-up Apple Wallet notification
    if (levelChanged) {
      const levelLabel = newLevel === "gold" ? "Gold ⭐" : "Silver 🥈";
      const levelMsg = `Félicitations, vous passez au niveau ${levelLabel} chez ${business.name} !`;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? "";
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        await fetch(`https://${projectId}.supabase.co/functions/v1/wallet-push`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ business_id: business.id, customer_id: customer.id, action_type: "level_up", change_message: levelMsg }),
        });
      } catch { /* non-blocking */ }
    }

    const { error: histErr } = await supabase.from("points_history").insert({
      customer_id: customer.id, business_id: business.id, card_id: card.id,
      points_added: pointsToAdd, action: "scan", scanned_by: user.id,
      ...(locationId ? { location_id: locationId } : {}),
    });
    if (histErr) { /* silent — non-critical insert */ }

    // Google Reviews auto-push after X visits
    const newTotalVisits = (customer.total_visits || 0) + 1;
    const biz = business as any;
    if (biz.google_review_enabled && biz.google_place_id && biz.google_review_threshold) {
      if (newTotalVisits === biz.google_review_threshold) {
        const reviewUrl = `https://search.google.com/local/writereview?placeid=${biz.google_place_id}`;
        const reviewMsg = biz.google_review_message || "Merci pour votre fidélité ! Votre avis Google nous aiderait beaucoup";
        try {
          const { data: { session: gSess } } = await supabase.auth.getSession();
          const gToken = gSess?.access_token ?? "";
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          await fetch(`https://${projectId}.supabase.co/functions/v1/wallet-push`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${gToken}` },
            body: JSON.stringify({
              business_id: business.id, customer_id: customer.id,
              action_type: "google_review",
              change_message: `⭐ ${reviewMsg}`,
            }),
          });
        } catch { /* non-blocking */ }
      }
    }

    // Dispatch webhooks
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session: whSess } } = await supabase.auth.getSession();
      const whToken = whSess?.access_token ?? "";
      fetch(`${supabaseUrl}/functions/v1/dispatch-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${whToken}` },
        body: JSON.stringify({
          business_id: business.id,
          event_type: rewardEarned ? "customer.reward_claimed" : "customer.scan",
          payload: { customer_id: customer.id, customer_name: customer.full_name, points: effectivePoints, max_points: maxPts, reward_earned: rewardEarned },
        }),
      }).catch(() => {});
    } catch { /* non-blocking */ }

    // ── Update cooldown ──────────────────────────────────────────
    await supabase
      .from("scan_cooldowns")
      .upsert(
        { card_id: card.id, last_scan: new Date().toISOString(), scanned_by: user.id },
        { onConflict: "card_id" }
      );

    setLastScan({ customerName: customer.full_name, points: effectivePoints, maxPoints: maxPts, rewardEarned, loyaltyType });
    setTodayScans((p) => p + 1);
    setCardCode("");
    setScanAmount("");
    setScanning(false);
    scanLockRef.current = false;
    fetchStats();
    fetchOnboarding();

    if (rewardEarned) {
      setPopup({ open: true, type: "reward", title: "🎉 Récompense débloquée !", message: `${customer.full_name} a gagné sa récompense !`, details: "Le compteur a été remis à zéro." });
    } else if (rewardPending) {
      const pendingDetails = minPurchase > 0 && purchaseAmountForCheck < minPurchase
        ? `Montant de la commande : ${purchaseAmountForCheck}€ — Minimum requis : ${minPurchase}€. La récompense sera débloquée au prochain passage avec un achat d'au moins ${minPurchase}€.`
        : "Disponible au prochain passage";
      setPopup({ open: true, type: "pending", title: "🎁 Récompense en attente", message: `${customer.full_name} — seuil de points atteint !`, details: pendingDetails });
    } else {
      setPopup({ open: true, type: "success", title: `${addedLabel} !`, message: `${customer.full_name} — ${newPoints}/${maxPts} ${unitLabelPlural}` });
    }
  };

  // ── Render ────────────────────────────────────────────────
  const businessName = business?.name || user?.user_metadata?.business_name || "Mon Commerce";
  const filteredCustomers = customers.filter((c) =>
    !clientSearch || (c.full_name || "").toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.phone || "").includes(clientSearch)
  );

  const allOnboardingDone = onboarding.hasCustomized && onboarding.hasReward && onboarding.hasScanned && onboarding.hasCampaign;

  const getTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const onboardingSteps = [
    { done: onboarding.hasCustomized, label: siteSettings?.onboarding_step_1 || "Personnaliser votre carte", path: "/dashboard/customize", icon: Palette },
    { done: onboarding.hasReward, label: siteSettings?.onboarding_step_2 || "Ajouter une récompense", path: "/dashboard/rewards", icon: Gift },
    { done: onboarding.hasScanned, label: siteSettings?.onboarding_step_3 || "Scanner votre premier client", path: "/dashboard/scanner", icon: QrCode },
    { done: onboarding.hasCampaign, label: siteSettings?.onboarding_step_4 || "Créer votre première campagne", path: "/dashboard/campaigns", icon: Send },
  ];

  const [tooltipOpen, setTooltipOpen] = useState<string | null>(null);

  const statCards = [
    { label: "Clients", value: stats.clients, icon: Users, gradient: "from-primary to-primary/70", trend: getTrend(stats.clients, stats30dAgo.clients), tooltip: "Nombre total de clients enregistrés dans votre programme de fidélité." },
    { label: "Taux de retour", value: totalScans >= 10 ? `${stats.returnRate}%` : "—", icon: TrendingUp, gradient: "from-emerald-500 to-emerald-400", trend: null as number | null, insufficientData: totalScans < 10, tooltip: "Pourcentage de clients qui sont revenus plus d'une fois. Un bon taux est > 30%. Nécessite au moins 10 scans." },
    { label: "Scans aujourd'hui", value: stats.scansToday + todayScans, icon: QrCode, gradient: "from-accent to-amber-400", trend: getTrend(stats.scansToday, stats30dAgo.scansToday), tooltip: "Nombre de passages scannés aujourd'hui. Compare avec la période précédente pour voir la tendance." },
    { label: "Récompenses", value: stats.rewardsGiven, icon: Gift, gradient: "from-rose-500 to-pink-400", trend: getTrend(stats.rewardsGiven, stats30dAgo.rewardsGiven), tooltip: "Nombre total de récompenses distribuées à vos clients fidèles." },
    { label: "Visites moy.", value: stats.avgVisits || "—", icon: BarChart3, gradient: "from-blue-500 to-blue-400", trend: null as number | null, tooltip: "Nombre moyen de visites par client. Plus c'est élevé, plus vos clients sont fidèles." },
    { label: "Note moyenne", value: stats.avgRating ? `${stats.avgRating}/5` : "—", icon: StarIcon, gradient: "from-yellow-500 to-amber-400", trend: null as number | null, tooltip: "Note moyenne laissée par vos clients. Basée sur les avis collectés via votre programme." },
  ];

  return (
    <DashboardLayout title={`Bonjour, ${businessName} 👋`} subtitle="Voici un aperçu de votre activité">
      {/* Onboarding tour — disabled: field not in schema, causes persistent spinner */}

      {/* ── Franchise overview ── */}
      {isFranchiseOwner && <FranchiseOverview />}

      {/* ── Onboarding checklist ── */}
      {!allOnboardingDone && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/15 p-5 space-y-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-base">Configurez votre programme en 4 étapes</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{onboardingSteps.filter(s => s.done).length} sur 4 étapes complétées</p>
            </div>
            <span className="text-sm font-bold text-primary shrink-0">{Math.round((onboardingSteps.filter(s => s.done).length / 4) * 100)}%</span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-border/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-primary rounded-full transition-all duration-500"
              style={{ width: `${(onboardingSteps.filter(s => s.done).length / 4) * 100}%` }}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {onboardingSteps.map((step, i) => {
              const StepIcon = step.icon;
              return (
                <Link
                  key={i}
                  to={step.path}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${step.done ? "bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30" : "bg-card border border-border/50 hover:border-primary/30 hover:shadow-sm"}`}
                >
                  {step.done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-muted-foreground">{i + 1}</span>
                    </div>
                  )}
                  <StepIcon className={`w-4 h-4 shrink-0 ${step.done ? "text-emerald-500" : "text-muted-foreground group-hover:text-primary transition-colors"}`} />
                  <span className={`text-sm flex-1 ${step.done ? "line-through text-muted-foreground" : "font-medium group-hover:text-primary transition-colors"}`}>
                    {step.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Quick Actions + Suggestions ── */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <BusinessResults />
        <div className="space-y-4">
          <QuickActions />
          <SmartSuggestions />
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-8">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          const isTooltipOpen = tooltipOpen === stat.label;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="group relative overflow-hidden rounded-2xl bg-card border border-border/40 p-3 sm:p-5 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
            >
              <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${stat.gradient} opacity-[0.08] group-hover:opacity-[0.15] transition-opacity`} />
              <div className="flex items-center justify-between mb-2 sm:mb-4">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-sm`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="flex items-center gap-1.5">
                  {stat.insufficientData ? (
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">min. 10 scans</span>
                  ) : stat.trend !== null && stat.trend !== 0 ? (
                    <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${stat.trend > 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {stat.trend > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      {Math.abs(stat.trend)}%
                    </span>
                  ) : null}
                  <button
                    onClick={() => setTooltipOpen(isTooltipOpen ? null : stat.label)}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xl sm:text-3xl font-display font-bold tracking-tight">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{stat.label}</p>
              <AnimatePresence>
                {isTooltipOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute inset-x-3 bottom-3 z-10 bg-foreground/90 text-background text-[11px] leading-relaxed rounded-xl p-3 shadow-lg backdrop-blur-sm"
                  >
                    {stat.tooltip}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Permission banner */}
      {!permissionsDismissed && (permissions.notifications !== "granted" || permissions.geolocation !== "granted") && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6"
        >
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Activez les permissions pour une meilleure expérience</p>
            <p className="text-xs text-muted-foreground mt-0.5">Notifications push et géolocalisation pour vos clients</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {permissions.notifications !== "granted" && (
              <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1.5" onClick={requestNotifications}>🔔 Notifications</Button>
            )}
            {permissions.geolocation !== "granted" && (
              <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1.5" onClick={requestGeolocation}>📍 Localisation</Button>
            )}
            <Button size="sm" variant="ghost" className="rounded-xl text-xs" onClick={() => setPermissionsDismissed(true)}>✕</Button>
          </div>
        </motion.div>
      )}

      {/* ── Tabs ── */}
      <Tabs defaultValue="scanner" className="space-y-6">
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <TabsList className="bg-card border border-border/40 rounded-2xl p-1 sm:p-1.5 h-auto shadow-sm w-max sm:w-full flex-nowrap">
            <TabsTrigger value="scanner" className="rounded-xl gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all shrink-0 sm:flex-1">
              <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Scanner
            </TabsTrigger>
            <TabsTrigger value="clients" className="rounded-xl gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all shrink-0 sm:flex-1">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Clients
            </TabsTrigger>
            <TabsTrigger value="stats" className="rounded-xl gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all shrink-0 sm:flex-1">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Stats
            </TabsTrigger>
            <TabsTrigger value="qrcode" className="rounded-xl gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all shrink-0 sm:flex-1">
              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Vitrine
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ═══════════════ SCANNER ═══════════════ */}
        <TabsContent value="scanner">
          <div className="grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 rounded-3xl bg-card border border-border/40 p-6 lg:p-8 space-y-6 shadow-sm">
              <div>
                <h2 className="font-display font-bold text-lg tracking-tight">Scanner une carte</h2>
                <p className="text-sm text-muted-foreground mt-1">Pointez la caméra vers le QR code du client</p>
              </div>
              <QrCameraScanner onScan={(code) => {
                setCardCode(code);
                if (!showAmountInput) {
                  processCardCode(code);
                } else {
                  toast.info("Code scanné ! Entrez le montant puis validez.");
                }
              }} disabled={scanning} paused={scannerPaused} />
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">ou code manuel</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="flex gap-3 max-w-sm mx-auto">
                <Input value={cardCode} onChange={(e) => setCardCode(e.target.value)} placeholder="Entrez le code carte..." className="rounded-xl h-11 text-sm bg-secondary/50 border-border/40" onKeyDown={(e) => e.key === "Enter" && processCardCode(cardCode)} />
                <Button onClick={() => processCardCode(cardCode)} disabled={scanning || !cardCode.trim()} className="bg-gradient-primary text-primary-foreground rounded-xl h-11 px-6 font-semibold shrink-0 shadow-md">Valider</Button>
              </div>
              {showAmountInput && (
                <div className="flex gap-2 items-center max-w-sm mx-auto">
                  <Euro className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={scanAmount}
                    onChange={(e) => setScanAmount(e.target.value)}
                    placeholder={minPurchaseAmount > 0 && !needsAmount ? `Montant de la commande (min. ${minPurchaseAmount}€)` : "Montant de l'achat (€)"}
                    className="rounded-xl h-11 text-sm bg-secondary/50 border-border/40"
                    onKeyDown={(e) => e.key === "Enter" && processCardCode(cardCode)}
                  />
                </div>
              )}
              {!isOnline && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-amber-700 dark:text-amber-400 text-xs font-medium">Mode hors-ligne — les scans seront synchronisés au retour de la connexion</span>
                </div>
              )}
              {pendingScanCount > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm">
                  <span className="text-blue-700 dark:text-blue-400 text-xs font-medium">{pendingScanCount} scan{pendingScanCount > 1 ? "s" : ""} en attente de synchronisation</span>
                </div>
              )}
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl bg-card border border-border/40 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md">
                    <QrCode className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-3xl font-display font-bold tracking-tight">{stats.scansToday + todayScans}</p>
                    <p className="text-xs text-muted-foreground font-medium">Scans aujourd'hui</p>
                  </div>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {lastScan ? (
                  <motion.div key={`scan-${lastScan.customerName}-${lastScan.points}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="rounded-2xl bg-card border border-border/40 p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-accent" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dernier scan</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {(lastScan.customerName || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-semibold text-sm truncate">{lastScan.customerName}</p>
                        <p className="text-xs text-muted-foreground">{lastScan.points}/{lastScan.maxPoints} {lastScan.loyaltyType === "stamps" ? "tampons" : "points"}</p>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                      <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" initial={{ width: 0 }} animate={{ width: `${Math.min((lastScan.points / lastScan.maxPoints) * 100, 100)}%` }} transition={{ duration: 1, ease: "easeOut" }} />
                    </div>
                    {lastScan.rewardEarned && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/10 border border-accent/20">
                        <Gift className="w-4 h-4 text-accent" />
                        <p className="text-xs font-semibold text-accent">Récompense débloquée !</p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div key="empty-scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
                    <QrCode className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Aucun scan pour le moment</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Scannez une carte pour commencer</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="rounded-2xl bg-secondary/30 border border-border/30 p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Astuce</p>
                <p className="text-xs text-muted-foreground leading-relaxed">La caméra détecte automatiquement le QR code. Gardez la carte bien éclairée et stable.</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════ CLIENTS ═══════════════ */}
        <TabsContent value="clients">
          <div className="rounded-3xl bg-card border border-border/40 shadow-sm overflow-hidden">
            <div className="p-5 lg:p-6 border-b border-border/40 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <h2 className="font-display font-bold text-lg tracking-tight">Vos clients</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{filteredCustomers.length} client{filteredCustomers.length > 1 ? "s" : ""}</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Rechercher..." className="pl-10 rounded-xl h-10 text-sm bg-secondary/50 border-border/40" />
              </div>
            </div>

            <div className="divide-y divide-border/30 max-h-[600px] overflow-y-auto">
              {filteredCustomers.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Aucun client trouvé</p>
                </div>
              ) : (
                filteredCustomers.map((c, i) => {
                  const card = c.customer_cards?.[0];
                  const lv = levelConfig[c.level || "bronze"] || levelConfig.bronze;
                  const points = card?.current_points || 0;
                  const maxPts = card?.max_points || 10;
                  const progress = Math.min((points / maxPts) * 100, 100);

                  return (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="flex items-center gap-4 px-5 lg:px-6 py-4 hover:bg-secondary/30 transition-colors cursor-pointer"
                      onClick={() => { setSelectedClient(c); fetchClientHistory(c.id); }}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {(c.full_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{c.full_name || "Sans nom"}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {c.email && (
                            <button onClick={(e) => { e.stopPropagation(); copyToClipboard(c.email, "Email"); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors" title="Copier l'email">
                              <Mail className="w-3 h-3" />
                              <span className="truncate max-w-[120px]">{c.email}</span>
                            </button>
                          )}
                          {c.phone && (
                            <button onClick={(e) => { e.stopPropagation(); copyToClipboard(c.phone, "Téléphone"); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors" title="Copier">
                              <Phone className="w-3 h-3" />
                              <span>{c.phone}</span>
                            </button>
                          )}
                          {!c.email && !c.phone && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </div>
                      <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${lv.bg} ${lv.text}`}>
                        {lv.emoji} {lv.label}
                      </div>
                      {card && (
                        <div className="hidden sm:flex items-center gap-2 w-40">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground">Fidélité</span>
                              <span className="text-[11px] font-mono font-semibold text-primary">{points}/{maxPts}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="hidden lg:flex flex-col items-center min-w-[48px]">
                        <span className="text-sm font-bold">{c.total_visits || 0}</span>
                        <span className="text-[10px] text-muted-foreground">visites</span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>

          {/* Client detail dialog */}
          <Dialog open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
            <DialogContent className="max-w-md">
              {selectedClient && (() => {
                const c = selectedClient;
                const card = c.customer_cards?.[0];
                const lv = levelConfig[c.level || "bronze"] || levelConfig.bronze;
                const points = card?.current_points || 0;
                const maxPts = card?.max_points || 10;
                const progress = Math.min((points / maxPts) * 100, 100);
                const history = clientHistory[c.id] || [];

                return (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                          {(c.full_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-base">{c.full_name || "Sans nom"}</p>
                          <div className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${lv.bg} ${lv.text}`}>
                            {lv.emoji} {lv.label}
                          </div>
                        </div>
                      </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 mt-2">
                      <div className="flex gap-2">
                        {c.email && <Button variant="outline" size="sm" className="rounded-xl gap-2 text-xs flex-1" onClick={() => copyToClipboard(c.email, "Email")}><Mail className="w-3.5 h-3.5" /> {c.email}</Button>}
                        {c.phone && <Button variant="outline" size="sm" className="rounded-xl gap-2 text-xs flex-1" onClick={() => copyToClipboard(c.phone, "Téléphone")}><Phone className="w-3.5 h-3.5" /> {c.phone}</Button>}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div className="p-3 rounded-xl bg-secondary/40 text-center">
                          <p className="text-lg font-bold">{c.total_visits || 0}</p>
                          <p className="text-[10px] text-muted-foreground">Visites</p>
                        </div>
                        <div className="p-3 rounded-xl bg-secondary/40 text-center">
                          <p className="text-lg font-bold">{c.current_streak || 0} 🔥</p>
                          <p className="text-[10px] text-muted-foreground">Série</p>
                        </div>
                        <div className="p-3 rounded-xl bg-secondary/40 text-center">
                          <p className="text-lg font-bold">{card?.rewards_earned || 0}</p>
                          <p className="text-[10px] text-muted-foreground">Récompenses</p>
                        </div>
                      </div>

                      {card && (
                        <div className="p-3 rounded-xl border border-border/40 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">Carte de fidélité</span>
                            <span className="text-xs font-mono font-bold text-primary">{points}/{maxPts} points</span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${progress}%` }} />
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {maxPts - points > 0 ? `Encore ${maxPts - points} point${maxPts - points > 1 ? "s" : ""} avant la récompense` : "🎉 Récompense disponible !"}
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <History className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium">Historique des passages</span>
                        </div>
                        <div className="max-h-[200px] overflow-y-auto space-y-1.5 pr-1">
                          {history.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">Aucun passage enregistré</p>
                          ) : (
                            history.map((h) => (
                              <div key={h.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                  <span className="font-medium">+{h.points_added} point{h.points_added > 1 ? "s" : ""}</span>
                                  {h.action && <span className="text-muted-foreground">({h.action})</span>}
                                </div>
                                <span className="text-muted-foreground">
                                  {new Date(h.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {c.last_visit_at && (
                        <p className="text-[10px] text-muted-foreground text-center">
                          Dernière visite : {new Date(c.last_visit_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  </>
                );
              })()}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ═══════════════ STATS ═══════════════ */}
        <TabsContent value="stats">
          {business && (
            <div className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="rounded-3xl bg-card border border-border/40 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><QrCode className="w-4 h-4 text-primary" /></div>
                    <div>
                      <h2 className="text-sm font-display font-semibold">Scans</h2>
                      <p className="text-[11px] text-muted-foreground">14 derniers jours</p>
                    </div>
                  </div>
                  <AnalyticsChart businessId={business.id} type="scans" />
                </div>
                <div className="rounded-3xl bg-card border border-border/40 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Users className="w-4 h-4 text-emerald-600" /></div>
                    <div>
                      <h2 className="text-sm font-display font-semibold">Nouveaux clients</h2>
                      <p className="text-[11px] text-muted-foreground">14 derniers jours</p>
                    </div>
                  </div>
                  <AnalyticsChart businessId={business.id} type="customers" />
                </div>
              </div>
              {/* Widgets: activité récente + score de santé */}
              <div className="grid lg:grid-cols-2 gap-6">
                <RecentActivityWidget businessId={business.id} />
                <ProgramHealthScore
                  totalClients={stats.clients}
                  returnRate={stats.returnRate}
                  rewardsGiven={stats.rewardsGiven}
                  hasCustomized={onboarding.hasCustomized}
                  hasCampaign={onboarding.hasCampaign}
                />
              </div>

              {/* Avis récents */}
              <RecentReviewsWidget businessId={business.id} />
            </div>
          )}
        </TabsContent>

        {/* ═══════════════ QR VITRINE ═══════════════ */}
        <TabsContent value="qrcode">
          {business && <QrVitrineSection business={business} />}
        </TabsContent>
      </Tabs>

      {/* Scan result popup */}
      <ScanResultPopup
        open={popup.open} type={popup.type} title={popup.title} message={popup.message} details={popup.details}
        onClose={() => { setPopup((p) => ({ ...p, open: false })); setScannerPaused(false); }}
      />

      {/* Floating action button */}
      <FloatingActionButton />
    </DashboardLayout>
  );
};

// ── QR Vitrine Section ──────────────────────────────────────────
function QrVitrineSection({ business }: { business: any }) {
  const appBase = import.meta.env.VITE_APP_URL || window.location.origin;
  const publicUrl = `${appBase}/b/${business.id}`;

  const downloadQR = () => {
    const svg = document.getElementById("vitrine-qr-svg");
    if (!svg) return;
    const canvas = document.createElement("canvas");
    canvas.width = 800; canvas.height = 800;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => { ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, 800, 800); ctx.drawImage(img, 0, 0, 800, 800); const a = document.createElement("a"); a.download = `qr-${business.name.replace(/\s+/g, "-")}.png`; a.href = canvas.toDataURL("image/png"); a.click(); };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const copyLink = () => { navigator.clipboard.writeText(publicUrl); toast.success("Lien copié !"); };

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 rounded-3xl bg-card border border-border/40 p-6 lg:p-8 shadow-sm flex flex-col items-center space-y-6">
        <div className="self-start">
          <h2 className="font-display font-bold text-lg tracking-tight">QR Code vitrine</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Imprimez-le ou affichez-le en magasin</p>
        </div>
        <div id="qr-printable" className="relative p-10 rounded-3xl flex flex-col items-center gap-5 w-full max-w-sm" style={{ background: `linear-gradient(145deg, ${business.primary_color}10 0%, ${business.secondary_color || business.primary_color}06 100%)`, border: `1.5px solid ${business.primary_color}15` }}>
          {business.logo_url && <img src={business.logo_url} alt={business.name} className="w-14 h-14 rounded-2xl object-cover shadow-sm" />}
          <div className="p-5 bg-background rounded-2xl shadow-md">
            <QRCodeSVG id="vitrine-qr-svg" value={publicUrl} size={220} level="H" includeMargin={false} fgColor={business.primary_color || "#6B46C1"} />
          </div>
          <div className="text-center">
            <p className="font-display font-bold text-base">{business.name}</p>
            <p className="text-xs text-muted-foreground mt-1">Scannez pour votre carte de fidélité</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button onClick={downloadQR} variant="outline" size="sm" className="rounded-xl gap-2 text-xs h-10 px-4"><Download className="w-4 h-4" /> Télécharger</Button>
          <Button onClick={copyLink} variant="outline" size="sm" className="rounded-xl gap-2 text-xs h-10 px-4"><Copy className="w-4 h-4" /> Copier le lien</Button>
          <Button onClick={() => { const el = document.getElementById("qr-printable"); if (!el) return; const printOverlay = document.createElement("div"); printOverlay.id = "pwa-print-overlay"; printOverlay.innerHTML = `<style>#pwa-print-overlay{position:fixed;inset:0;z-index:99999;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center}#pwa-print-overlay .qr-wrap{text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px}#pwa-print-overlay .qr-wrap img{width:60px;height:60px;border-radius:12px;object-fit:contain}#pwa-print-overlay .qr-wrap svg{width:240px;height:240px}#pwa-print-overlay .qr-wrap>div{background:none!important;box-shadow:none!important;border:none!important;padding:0!important;border-radius:0!important}#pwa-print-overlay .pwa-print-actions{position:fixed;bottom:24px;left:0;right:0;display:flex;gap:10px;justify-content:center}#pwa-print-overlay .pwa-print-actions button{padding:12px 28px;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer}</style><div class="qr-wrap">${el.innerHTML}</div><div class="pwa-print-actions"><button style="background:#333;color:#fff" onclick="window.print()">Imprimer</button><button style="background:#e5e5e5;color:#333" onclick="document.getElementById('pwa-print-overlay')?.remove()">Retour</button></div>`; document.body.appendChild(printOverlay); const cleanup = () => { document.getElementById('pwa-print-overlay')?.remove(); window.removeEventListener('afterprint', cleanup); }; window.addEventListener('afterprint', cleanup); }} variant="outline" size="sm" className="rounded-xl gap-2 text-xs h-10 px-4"><Printer className="w-4 h-4" /> Imprimer</Button>
        </div>
      </div>
      <div className="lg:col-span-2 space-y-5">
        <div className="rounded-2xl bg-card border border-border/40 p-5 shadow-sm space-y-5">
          <h2 className="font-display font-semibold text-sm">Comment ça marche</h2>
          {[{ step: "1", emoji: "🖨️", title: "Imprimez ou affichez", desc: "Vitrine, comptoir, menu, flyer..." }, { step: "2", emoji: "📱", title: "Le client scanne", desc: "Avec son appareil photo" }, { step: "3", emoji: "🎉", title: "Carte créée", desc: "Inscription en 10 secondes" }].map((s) => (
            <div key={s.step} className="flex gap-4 items-center">
              <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-lg shrink-0">{s.emoji}</div>
              <div><p className="text-sm font-medium">{s.title}</p><p className="text-xs text-muted-foreground">{s.desc}</p></div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-card border border-border/40 p-5 shadow-sm space-y-3">
          <h2 className="font-display font-semibold text-sm">Lien direct</h2>
          <p className="text-xs text-muted-foreground">Partagez sur vos réseaux sociaux ou votre site.</p>
          <div className="flex items-center gap-2">
            <code className="text-[11px] bg-secondary/60 px-3 py-2.5 rounded-xl flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{publicUrl}</code>
            <Button size="icon" variant="outline" className="rounded-xl h-9 w-9 shrink-0" onClick={copyLink}><Copy className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="outline" className="rounded-xl h-9 w-9 shrink-0" onClick={() => window.open(publicUrl, "_blank")}><ExternalLink className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Recent Reviews Widget ──────────────────────────────────────
function RecentReviewsWidget({ businessId }: { businessId: string }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("customer_reviews")
        .select("*, customers(full_name)")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (data && data.length > 0) {
        setReviews(data);
        const avg = data.reduce((s: number, r: any) => s + r.rating, 0) / data.length;
        setAvgRating(Math.round(avg * 10) / 10);
      }
    };
    fetch();
  }, [businessId]);

  if (reviews.length === 0) return null;

  return (
    <div className="rounded-2xl bg-card border border-border/40 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-sm">Avis récents</h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          <StarIcon className="w-3 h-3 fill-amber-400 text-amber-400 mr-1" />
          {avgRating}/5
        </Badge>
      </div>
      <div className="space-y-3">
        {reviews.map((r: any) => (
          <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30">
            <div className="flex gap-0.5 shrink-0 mt-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <StarIcon key={s} className={`w-3 h-3 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />
              ))}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium">{(r.customers as any)?.full_name || "Client"}</p>
              {r.comment && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.comment}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
