import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode, CheckCircle, Sparkles, Euro } from "lucide-react";
import { QrCameraScanner } from "@/components/dashboard/QrCameraScanner";
import { ScanResultPopup } from "@/components/dashboard/ScanResultPopup";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  processRewardsAfterScan,
  claimRewardInstance,
  buildWalletMessage,
} from "@/hooks/useRewardInstances";

const LOYALTY_LABELS: Record<string, { unit: string; unitPlural: string }> = {
  stamps: { unit: "tampon", unitPlural: "tampons" },
  points: { unit: "point", unitPlural: "points" },
  cashback: { unit: "€", unitPlural: "€" },
  subscription: { unit: "point", unitPlural: "points" },
};

const SCAN_COOLDOWN_SECONDS = 30;

const ScannerPage = () => {
  const { user, business, locationId } = useAuth();
  const [cardCode, setCardCode] = useState("");
  const [amount, setAmount] = useState("");
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastScan, setLastScan] = useState<any>(null);
  const [todayScans, setTodayScans] = useState(0);
  const scanLockRef = useRef(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Popup state
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupType, setPopupType] = useState<"success" | "reward" | "reward_claimable" | "pending" | "error">("success");
  const [popupTitle, setPopupTitle] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const [popupDetails, setPopupDetails] = useState<string | undefined>();
  const [popupRewardLines, setPopupRewardLines] = useState<any[]>([]);
  const [popupClaimData, setPopupClaimData] = useState<any[]>([]);
  const [claimingIndex, setClaimingIndex] = useState<number | null>(null);

  const loyaltyType = business?.loyalty_type || "stamps";
  const isCashback = loyaltyType === "cashback";
  const isEuroToPoints = loyaltyType === "points" && (business?.points_per_euro || 0) > 0;
  const needsAmount = isCashback || isEuroToPoints;
  const minPurchaseAmount = parseFloat((business as any)?.reward_min_purchase) || 0;
  const showAmountInput = needsAmount || minPurchaseAmount > 0;
  const labels = LOYALTY_LABELS[loyaltyType] || LOYALTY_LABELS.points;

  const showPopup = (
    type: typeof popupType,
    title: string,
    message: string,
    details?: string,
    rewardLines?: any[],
    claimData?: any[],
  ) => {
    setPopupType(type);
    setPopupTitle(title);
    setPopupMessage(message);
    setPopupDetails(details);
    setPopupRewardLines(rewardLines || []);
    setPopupClaimData(claimData || []);
    setClaimingIndex(null);
    setPopupOpen(true);
  };

  const handleClaimFromPopup = async (index: number) => {
    const data = popupClaimData[index];
    if (!data || !business || !user) return;
    setClaimingIndex(index);

    // Claim the instance
    await claimRewardInstance(data.instanceId, data.scanId);

    // Log in points_history
    await supabase.from("points_history").insert({
      customer_id: data.customerId,
      business_id: business.id,
      card_id: data.cardId,
      points_added: 0,
      action: "reward_claim",
      note: `Récompense récupérée : ${data.rewardTitle}`,
      scanned_by: user.id,
    });

    // Update card
    await supabase.from("customer_cards").update({
      rewards_earned: (data.currentRewardsEarned || 0) + 1,
      wallet_change_message: `✅ Récompense récupérée : ${data.rewardTitle}`,
      updated_at: new Date().toISOString(),
    }).eq("id", data.cardId);

    // Push wallet update
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      await fetch(`${supabaseUrl}/functions/v1/wallet-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          business_id: business.id,
          customer_id: data.customerId,
          action_type: "reward_claimed",
          change_message: `✅ Récompense récupérée : ${data.rewardTitle}`,
        }),
      });
    } catch { /* non-blocking */ }

    toast.success(`✅ ${data.rewardTitle} récupérée !`);

    // Update popup lines - mark this one as claimed
    setPopupRewardLines(prev => prev.map((l, i) =>
      i === index ? { ...l, status: "claimed" as const, title: `✅ ${l.title}` } : l
    ));
    setClaimingIndex(null);
  };

  const handleScan = async (codeOverride?: string) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    const code = codeOverride || cardCode;
    if (!code.trim() || !business || !user) {
      toast.error("Entrez un code de carte");
      scanLockRef.current = false;
      return;
    }
    if (showAmountInput && (!amount || parseFloat(amount) <= 0)) {
      toast.error("Entrez le montant de la commande");
      scanLockRef.current = false;
      return;
    }
    setScanning(true);

    const { data: card, error: cardError } = await supabase
      .from("customer_cards")
      .select("*, customers(*)")
      .eq("card_code", code.trim())
      .eq("business_id", business.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!card || cardError) {
      toast.error("Carte non trouvée ou inactive");
      setScanning(false);
      scanLockRef.current = false;
      return;
    }

    // Anti double-scan cooldown
    const { data: cooldown } = await supabase
      .from("scan_cooldowns")
      .select("last_scan")
      .eq("card_id", card.id)
      .maybeSingle();

    if (cooldown?.last_scan) {
      const elapsed = (Date.now() - new Date(cooldown.last_scan).getTime()) / 1000;
      if (elapsed < SCAN_COOLDOWN_SECONDS) {
        const remaining = Math.ceil(SCAN_COOLDOWN_SECONDS - elapsed);
        toast.warning(`⏱ Scan trop rapide`, {
          description: `Attendez encore ${remaining}s avant de scanner cette carte à nouveau.`,
        });
        setScanning(false);
        scanLockRef.current = false;
        return;
      }
    }

    // Calculate points increment
    let increment = 1;
    const purchaseAmount = parseFloat(amount) || 0;
    if (needsAmount) {
      const pointsPerEuro = (business as any).points_per_euro || 1;
      if (isCashback) {
        increment = Math.floor(purchaseAmount * pointsPerEuro / 100);
      } else {
        increment = Math.floor(purchaseAmount * pointsPerEuro);
      }
      if (increment < 1) increment = 1;
    } else {
      increment = (business as any).points_per_visit || 1;
    }

    const newPoints = card.current_points + increment;
    const customer = card.customers;
    const unitLabel = increment > 1 ? labels.unitPlural : labels.unit;

    // ── Process reward instances ──
    let rewardResult = { newlyUnlocked: [] as any[], nowClaimable: [] as any[], alreadyClaimable: [] as any[] };
    try {
      rewardResult = await processRewardsAfterScan({
        cardId: card.id,
        customerId: customer.id,
        businessId: business.id,
        currentPoints: newPoints,
        purchaseAmount: showAmountInput ? purchaseAmount : null,
        minPurchaseForClaim: minPurchaseAmount,
      });
    } catch (e) {
      console.error("processRewardsAfterScan error:", e);
    }

    const { newlyUnlocked, nowClaimable, alreadyClaimable } = rewardResult;

    // Build wallet change message
    const allActive = [
      ...nowClaimable.map(r => ({ reward: r.reward, status: "claimable_now" as const })),
      ...alreadyClaimable.map(r => ({ reward: r.reward, status: r.instance.status as any })),
      ...newlyUnlocked.map(r => ({ reward: r.reward, status: "unlocked_pending_next_order" as const })),
    ];

    // Wallet message: only reward info goes to latest_offer (triggers its own notif)
    // Points notification is handled separately by the points header field changeMessage
    const rewardMsg = buildWalletMessage(allActive);
    const walletMsg = rewardMsg || null; // null = no latest_offer update, only points change

    // Update card
    await supabase.from("customer_cards").update({
      current_points: newPoints,
      wallet_change_message: walletMsg,
      updated_at: new Date().toISOString(),
    }).eq("id", card.id);

    // Wallet push
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      await fetch(`${supabaseUrl}/functions/v1/wallet-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          business_id: business.id,
          customer_id: customer.id,
          action_type: nowClaimable.length > 0 ? "reward_claimable" : newlyUnlocked.length > 0 ? "reward_unlocked" : "points_increment",
          change_message: walletMsg,
        }),
      });
    } catch { /* non-blocking */ }

    // Update customer stats
    const newStreak = customer.current_streak + 1;
    await supabase.from("customers").update({
      total_points: customer.total_points + increment,
      total_visits: customer.total_visits + 1,
      current_streak: newStreak,
      longest_streak: Math.max(newStreak, customer.longest_streak),
      last_visit_at: new Date().toISOString(),
      level: customer.total_points + increment >= ((business as any).tier_gold_points || 25)
        ? "gold"
        : customer.total_points + increment >= ((business as any).tier_silver_points || 10)
          ? "silver"
          : "bronze",
    }).eq("id", customer.id);

    // Log scan in points_history
    const { data: scanHistory } = await supabase.from("points_history").insert({
      customer_id: customer.id,
      business_id: business.id,
      card_id: card.id,
      points_added: increment,
      action: "scan",
      scanned_by: user.id,
      ...(locationId ? { location_id: locationId } : {}),
    }).select("id").single();

    // Update cooldown
    await supabase.from("scan_cooldowns").upsert(
      { card_id: card.id, last_scan: new Date().toISOString(), scanned_by: user.id },
      { onConflict: "card_id" }
    );

    // ── Build popup ──
    const hasClaimable = nowClaimable.length > 0 || alreadyClaimable.filter(r => r.instance.status === "claimable_now").length > 0;
    const hasNewUnlocked = newlyUnlocked.length > 0;
    const hasRewardPopup = hasClaimable || hasNewUnlocked;

    // Prepare reward popup data (will be shown after success overlay)
    let pendingPopup: (() => void) | null = null;

    if (hasRewardPopup) {
      const rewardLines: any[] = [];
      const claimData: any[] = [];

      for (const r of nowClaimable) {
        rewardLines.push({ title: r.reward.title, status: "claimable_now" });
        claimData.push({
          instanceId: r.instance.id,
          scanId: scanHistory?.id,
          customerId: customer.id,
          cardId: card.id,
          rewardTitle: r.reward.title,
          currentRewardsEarned: card.rewards_earned,
        });
      }
      for (const r of alreadyClaimable.filter(x => x.instance.status === "claimable_now")) {
        rewardLines.push({ title: r.reward.title, status: "claimable_now" });
        claimData.push({
          instanceId: r.instance.id,
          scanId: scanHistory?.id,
          customerId: customer.id,
          cardId: card.id,
          rewardTitle: r.reward.title,
          currentRewardsEarned: card.rewards_earned,
        });
      }

      for (const r of newlyUnlocked) {
        rewardLines.push({ title: r.reward.title, status: "unlocked_pending_next_order" });
        claimData.push(null);
      }

      const popType = nowClaimable.length > 0 ? "reward_claimable" : "reward";
      const popTitle = nowClaimable.length > 0
        ? "🎁 Récompense à donner !"
        : hasNewUnlocked
          ? "🎉 Nouvelle récompense débloquée !"
          : `+${increment} ${unitLabel}`;

      const popMsg = nowClaimable.length > 0
        ? `${customer.full_name} a une récompense disponible sur cette commande.`
        : `${customer.full_name} — Disponible à la prochaine commande éligible.`;

      pendingPopup = () => showPopup(popType, popTitle, popMsg, `${newPoints} ${labels.unitPlural} au total`, rewardLines, claimData);
    } else {
      toast.success(`+${increment} ${unitLabel} pour ${customer.full_name}`, {
        description: `${newPoints} ${labels.unitPlural}`,
      });
    }

    // Fetch highest reward threshold for progress bar
    const { data: rewards } = await supabase
      .from("rewards")
      .select("points_required")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("points_required", { ascending: false })
      .limit(1);

    const maxPts = rewards?.[0]?.points_required || card.max_points;

    setLastScan({
      customerName: customer.full_name,
      points: newPoints,
      maxPoints: maxPts,
      increment,
    });

    // Always show success overlay first, then reward popup after it fades
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      if (pendingPopup) pendingPopup();
    }, 2000);
    setTodayScans((p) => p + 1);
    setCardCode("");
    setAmount("");
    setScanning(false);
    scanLockRef.current = false;
  };

  return (
    <DashboardLayout title="Scanner" subtitle="Scannez ou entrez le code d'une carte client">
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-card border border-border/50 flex flex-col items-center">
          <AnimatePresence>
            {success ? (
              <motion.div
                key="success"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="w-full max-w-[340px] aspect-square rounded-2xl bg-secondary/50 flex flex-col items-center justify-center gap-2 mb-4"
              >
                <CheckCircle className="w-14 h-14 text-emerald-500" />
                <p className="font-display font-bold text-emerald-600 text-sm">
                  +{lastScan?.increment || 1} {labels.unit} !
                </p>
              </motion.div>
            ) : (
              <motion.div key="scanner" className="w-full mb-4">
                <QrCameraScanner
                  onScan={(code) => {
                    if (!showAmountInput) {
                      handleScan(code);
                    } else {
                      setCardCode(code);
                      toast.info("Code scanné ! Entrez le montant puis validez.");
                      setTimeout(() => amountInputRef.current?.focus(), 100);
                    }
                  }}
                  disabled={scanning}
                  paused={success}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-full max-w-xs space-y-3">
            <div className="flex gap-2">
              <Input
                value={cardCode}
                onChange={(e) => setCardCode(e.target.value)}
                placeholder="Code de la carte..."
                className="rounded-xl"
                onKeyDown={(e) => e.key === "Enter" && handleScan(undefined)}
              />
              <Button onClick={() => handleScan()} disabled={scanning} className="bg-gradient-primary text-primary-foreground rounded-xl px-5">
                {scanning ? "..." : "OK"}
              </Button>
            </div>

            {showAmountInput && (
              <div className="flex gap-2 items-center">
                <Euro className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  ref={amountInputRef}
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={minPurchaseAmount > 0 && !needsAmount ? `Montant (min. ${minPurchaseAmount}€)` : "Montant de l'achat (€)"}
                  className="rounded-xl"
                  onKeyDown={(e) => e.key === "Enter" && handleScan(undefined)}
                />
              </div>
            )}

            <p className="text-[11px] text-center text-muted-foreground">
              {showAmountInput
                ? needsAmount
                  ? `Scannez le QR ou entrez le code + montant`
                  : `Entrez le montant pour vérifier le minimum (${minPurchaseAmount}€)`
                : "Scannez le QR code ou entrez le code manuellement"}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <StatsCard label="Scans aujourd'hui" value={todayScans} icon={QrCode} />

          {lastScan && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl bg-card border border-border/50"
            >
              <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-accent" /> Dernier scan
              </h3>
              <p className="font-display font-semibold">{lastScan.customerName}</p>
              <div className="mt-3 w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((lastScan.points / lastScan.maxPoints) * 100, 100)}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {lastScan.points}/{lastScan.maxPoints} {labels.unitPlural}
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Reward popup */}
      <ScanResultPopup
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        type={popupType}
        title={popupTitle}
        message={popupMessage}
        details={popupDetails}
        rewardLines={popupRewardLines}
        onClaimReward={handleClaimFromPopup}
        claimingIndex={claimingIndex}
      />
    </DashboardLayout>
  );
};

export default ScannerPage;
