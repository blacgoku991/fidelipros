import { supabase } from "@/integrations/supabase/client";

export type RewardInstanceStatus = "unlocked_pending_next_order" | "claimable_now" | "claimed";

export interface RewardInstance {
  id: string;
  customer_id: string;
  card_id: string;
  business_id: string;
  reward_id: string;
  status: RewardInstanceStatus;
  points_at_unlock: number;
  unlocked_at: string;
  claimed_at: string | null;
  claim_scan_id: string | null;
}

export interface RewardWithInstance {
  reward: { id: string; title: string; points_required: number; description?: string };
  instance: RewardInstance | null;
  status: "locked" | RewardInstanceStatus;
}

/**
 * Fetch active (non-claimed) reward instances for a card
 */
export async function getActiveInstances(cardId: string) {
  const { data } = await supabase
    .from("reward_instances")
    .select("*")
    .eq("card_id", cardId)
    .neq("status", "claimed")
    .order("points_at_unlock", { ascending: true });
  return (data || []) as RewardInstance[];
}

/**
 * Fetch ALL instances (including claimed) for a card — used to prevent re-creation
 */
export async function getAllInstances(cardId: string) {
  const { data } = await supabase
    .from("reward_instances")
    .select("*")
    .eq("card_id", cardId)
    .order("points_at_unlock", { ascending: true });
  return (data || []) as RewardInstance[];
}

/**
 * After a scan, process reward unlocking logic:
 * 1. Move existing unlocked_pending_next_order → claimable_now (if min purchase met)
 * 2. Create new instances for newly unlocked rewards as unlocked_pending_next_order
 * Returns { newlyUnlocked, nowClaimable, alreadyClaimable }
 */
export async function processRewardsAfterScan({
  cardId,
  customerId,
  businessId,
  currentPoints,
  purchaseAmount,
  minPurchaseForClaim,
}: {
  cardId: string;
  customerId: string;
  businessId: string;
  currentPoints: number;
  purchaseAmount: number | null;
  minPurchaseForClaim: number;
}) {
  // 1. Fetch all active rewards for this business
  const { data: rewards } = await supabase
    .from("rewards")
    .select("id, title, points_required, description")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("points_required", { ascending: true });

  if (!rewards || rewards.length === 0) return { newlyUnlocked: [], nowClaimable: [], alreadyClaimable: [] };

  // 2. Fetch ALL instances (including claimed) to avoid re-creating claimed rewards
  const allInstances = await getAllInstances(cardId);
  const instanceByRewardId = new Map(allInstances.map((i) => [i.reward_id, i]));

  const newlyUnlocked: Array<{ reward: typeof rewards[0]; instance: RewardInstance }> = [];
  const nowClaimable: Array<{ reward: typeof rewards[0]; instance: RewardInstance }> = [];
  const alreadyClaimable: Array<{ reward: typeof rewards[0]; instance: RewardInstance }> = [];

  const meetsMinPurchase = purchaseAmount === null || purchaseAmount >= minPurchaseForClaim || minPurchaseForClaim <= 0;

  for (const reward of rewards) {
    if (currentPoints < reward.points_required) continue; // not unlocked yet

    const existing = instanceByRewardId.get(reward.id);

    // Skip already claimed rewards — don't re-create them
    if (existing && existing.status === "claimed") continue;

    if (!existing) {
      // Newly unlocked reward → create as pending
      const { data: inserted } = await supabase
        .from("reward_instances")
        .insert({
          customer_id: customerId,
          card_id: cardId,
          business_id: businessId,
          reward_id: reward.id,
          status: "unlocked_pending_next_order" as any,
          points_at_unlock: currentPoints,
        })
        .select()
        .single();

      if (inserted) {
        newlyUnlocked.push({ reward, instance: inserted as RewardInstance });
      }
    } else if (existing.status === "unlocked_pending_next_order") {
      // Was pending from last scan → now claimable if min purchase met
      if (meetsMinPurchase) {
        await supabase
          .from("reward_instances")
          .update({ status: "claimable_now" as any })
          .eq("id", existing.id);
        nowClaimable.push({ reward, instance: { ...existing, status: "claimable_now" } });
      } else {
        // Still pending because min purchase not met
        alreadyClaimable.push({ reward, instance: existing });
      }
    } else if (existing.status === "claimable_now") {
      alreadyClaimable.push({ reward, instance: existing });
    }
  }

  return { newlyUnlocked, nowClaimable, alreadyClaimable };
}

/**
 * Claim a specific reward instance
 */
export async function claimRewardInstance(instanceId: string, scanId?: string) {
  await supabase
    .from("reward_instances")
    .update({
      status: "claimed" as any,
      claimed_at: new Date().toISOString(),
      ...(scanId ? { claim_scan_id: scanId } : {}),
    })
    .eq("id", instanceId);
}

/**
 * Build wallet change message from active reward instances
 */
export function buildWalletMessage(
  instances: Array<{ reward: { title: string }; status: RewardInstanceStatus | "locked" }>
): string {
  const claimable = instances.filter((i) => i.status === "claimable_now");
  const pending = instances.filter((i) => i.status === "unlocked_pending_next_order");

  if (claimable.length > 0 && pending.length > 0) {
    return `🎁 ${claimable[0].reward.title} à récupérer ! + ${pending.length} débloquée(s)`;
  }
  if (claimable.length > 0) {
    return `🎁 ${claimable[0].reward.title} à récupérer !`;
  }
  if (pending.length > 0) {
    return `🎉 ${pending[0].reward.title} débloquée — prochaine commande !`;
  }
  return "";
}
