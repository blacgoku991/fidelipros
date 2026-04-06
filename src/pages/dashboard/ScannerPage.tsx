import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode, CheckCircle, Sparkles, Euro } from "lucide-react";
import { QrCameraScanner } from "@/components/dashboard/QrCameraScanner";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const LOYALTY_LABELS: Record<string, { unit: string; unitPlural: string }> = {
  stamps: { unit: "tampon", unitPlural: "tampons" },
  points: { unit: "point", unitPlural: "points" },
  cashback: { unit: "€", unitPlural: "€" },
  subscription: { unit: "point", unitPlural: "points" },
};

// Cooldown duration in seconds between two scans of the same card
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

  const loyaltyType = business?.loyalty_type || "stamps";
  const isCashback = loyaltyType === "cashback";
  const isEuroToPoints = loyaltyType === "points" && (business?.points_per_euro || 0) > 0;
  const needsAmount = isCashback || isEuroToPoints;
  const labels = LOYALTY_LABELS[loyaltyType] || LOYALTY_LABELS.points;

  const handleScan = async (codeOverride?: string) => {
    // Prevent concurrent scan executions (double-scan guard)
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    const code = codeOverride || cardCode;
    if (!code.trim() || !business || !user) {
      toast.error("Entrez un code de carte");
      scanLockRef.current = false;
      return;
    }
    if (needsAmount && (!amount || parseFloat(amount) <= 0)) {
      toast.error("Entrez le montant de l'achat");
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

    // ── Anti double-scan: check cooldown ──────────────────────────
    const { data: cooldown } = await supabase
      .from("scan_cooldowns" as any)
      .select("last_scan")
      .eq("card_id", card.id)
      .maybeSingle();

    if ((cooldown as any)?.last_scan) {
      const elapsed = (Date.now() - new Date((cooldown as any).last_scan).getTime()) / 1000;
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

    // Calculate points increment based on loyalty type
    let increment = 1;
    if (needsAmount) {
      const purchaseAmount = parseFloat(amount) || 0;
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

    // Check if a reward was earned — use rewards from DB if available
    let earnedReward: any = null;
    const { data: rewards } = await supabase
      .from("rewards")
      .select("title, points_required")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("points_required", { ascending: true });

    const rewardEarned = newPoints >= card.max_points;

    if (rewards && rewards.length > 0) {
      earnedReward = rewards.filter((r: any) => r.points_required <= newPoints)
        .sort((a: any, b: any) => b.points_required - a.points_required)[0];
    }

    const unitLabel = increment > 1 ? labels.unitPlural : labels.unit;
    const changeMsg = rewardEarned
      ? `🎁 ${earnedReward?.title || "Récompense"} débloquée chez ${business.name} !`
      : isCashback
        ? `+${increment}${labels.unit} de cagnotte chez ${business.name} ! Total : ${newPoints}${labels.unit}`
        : `+${increment} ${unitLabel} chez ${business.name} ! Vous avez ${newPoints} ${labels.unitPlural}.`;

    await supabase
      .from("customer_cards")
      .update({
        current_points: rewardEarned ? 0 : newPoints,
        rewards_earned: rewardEarned ? card.rewards_earned + 1 : card.rewards_earned,
        wallet_change_message: changeMsg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", card.id);

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
          action_type: "points_increment",
          change_message: changeMsg,
        }),
      });
    } catch (walletErr) {
      console.warn("Wallet push failed (non-blocking):", walletErr);
    }

    // Update customer stats
    const newStreak = customer.current_streak + 1;
    await supabase
      .from("customers")
      .update({
        total_points: customer.total_points + increment,
        total_visits: customer.total_visits + 1,
        current_streak: newStreak,
        longest_streak: Math.max(newStreak, customer.longest_streak),
        last_visit_at: new Date().toISOString(),
        level: customer.total_points + increment >= 25 ? "gold" : customer.total_points + increment >= 10 ? "silver" : "bronze",
      })
      .eq("id", customer.id);

    await supabase.from("points_history").insert({
      customer_id: customer.id,
      business_id: business.id,
      card_id: card.id,
      points_added: increment,
      action: "scan",
      scanned_by: user.id,
      ...(locationId ? { location_id: locationId } : {}),
    });

    // ── Update cooldown ──────────────────────────────────────────
    await supabase
      .from("scan_cooldowns" as any)
      .upsert(
        { card_id: card.id, last_scan: new Date().toISOString(), scanned_by: user.id },
        { onConflict: "card_id" }
      );

    setLastScan({
      customerName: customer.full_name,
      points: rewardEarned ? 0 : newPoints,
      maxPoints: card.max_points,
      rewardEarned,
      rewardTitle: earnedReward?.title,
      increment,
    });

    setSuccess(true);
    setTodayScans((p) => p + 1);
    setCardCode("");
    setAmount("");
    setScanning(false);
    scanLockRef.current = false;

    if (rewardEarned) {
      toast.success(`🎉 ${earnedReward?.title || "Récompense"} débloquée !`, {
        description: `${customer.full_name} a gagné sa récompense !`,
      });
    } else {
      toast.success(`+${increment} ${unitLabel} pour ${customer.full_name}`, {
        description: `${newPoints}/${card.max_points} ${labels.unitPlural}`,
      });
    }

    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <DashboardLayout title="Scanner" subtitle="Scannez ou entrez le code d'une carte client">
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-card border border-border/50 flex flex-col items-center">
          {/* QR Camera Scanner */}
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
                  {lastScan?.rewardEarned
                    ? `🎉 ${lastScan.rewardTitle || "Récompense"} !`
                    : `+${lastScan?.increment || 1} ${labels.unit} !`}
                </p>
              </motion.div>
            ) : (
              <motion.div key="scanner" className="w-full mb-4">
                <QrCameraScanner
                  onScan={(code) => {
                    setCardCode(code);
                    if (!isCashback) {
                      handleScan(code);
                    } else {
                      toast.info("Code scanné ! Entrez le montant puis validez.");
                    }
                  }}
                  disabled={scanning}
                  paused={success}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Manual code input + amount */}
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

            {isCashback && (
              <div className="flex gap-2 items-center">
                <Euro className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Montant de l'achat (€)"
                  className="rounded-xl"
                  onKeyDown={(e) => e.key === "Enter" && handleScan(undefined)}
                />
              </div>
            )}

            <p className="text-[11px] text-center text-muted-foreground">
              {isCashback
                ? "Scannez le QR code ou entrez le code + montant"
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
                  animate={{ width: `${(lastScan.points / lastScan.maxPoints) * 100}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {lastScan.points}/{lastScan.maxPoints} {labels.unitPlural}
              </p>
              {lastScan.rewardEarned && (
                <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-2 text-sm font-semibold text-accent">
                  🎉 {lastScan.rewardTitle || "Récompense gagnée"} !
                </motion.p>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ScannerPage;
