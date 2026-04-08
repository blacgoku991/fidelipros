import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Trophy, Clock, X, Gift, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RewardLine {
  title: string;
  status: "claimable_now" | "unlocked_pending_next_order" | "claimed";
}

interface ScanResultPopupProps {
  open: boolean;
  onClose: () => void;
  type: "success" | "reward" | "error" | "pending" | "reward_claimable";
  title: string;
  message: string;
  details?: string;
  rewardLines?: RewardLine[];
  onClaimReward?: (index: number) => void;
  claimingIndex?: number | null;
}

export function ScanResultPopup({
  open, onClose, type, title, message, details,
  rewardLines, onClaimReward, claimingIndex,
}: ScanResultPopupProps) {
  const config = {
    success: {
      icon: CheckCircle,
      iconColor: "text-emerald-500",
      bgGlow: "from-emerald-500/20 to-emerald-500/5",
      borderColor: "border-emerald-200 dark:border-emerald-500/30",
    },
    reward: {
      icon: PartyPopper,
      iconColor: "text-amber-500",
      bgGlow: "from-amber-500/20 to-amber-500/5",
      borderColor: "border-amber-200 dark:border-amber-500/30",
    },
    reward_claimable: {
      icon: Gift,
      iconColor: "text-accent",
      bgGlow: "from-accent/20 to-accent/5",
      borderColor: "border-accent/30",
    },
    pending: {
      icon: Clock,
      iconColor: "text-orange-500",
      bgGlow: "from-orange-500/20 to-orange-500/5",
      borderColor: "border-orange-200 dark:border-orange-500/30",
    },
    error: {
      icon: XCircle,
      iconColor: "text-destructive",
      bgGlow: "from-destructive/20 to-destructive/5",
      borderColor: "border-destructive/30",
    },
  }[type];

  const Icon = config.icon;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 30 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className={`relative w-full max-w-sm rounded-3xl bg-card border ${config.borderColor} shadow-2xl overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`absolute inset-0 bg-gradient-to-b ${config.bgGlow} pointer-events-none`} />

            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-secondary/80 flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            <div className="relative z-10 flex flex-col items-center text-center px-8 py-10">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }}
              >
                <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${config.bgGlow} flex items-center justify-center mb-5`}>
                  <Icon className={`w-10 h-10 ${config.iconColor}`} />
                </div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-xl font-display font-bold tracking-tight"
              >
                {title}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-sm text-muted-foreground mt-2"
              >
                {message}
              </motion.p>

              {details && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-xs text-muted-foreground/70 mt-1"
                >
                  {details}
                </motion.p>
              )}

              {/* Reward lines */}
              {rewardLines && rewardLines.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="mt-4 w-full space-y-2"
                >
                  {rewardLines.map((line, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between gap-2 p-3 rounded-2xl border text-left ${
                        line.status === "claimable_now"
                          ? "border-accent/40 bg-accent/10"
                          : "border-border/30 bg-secondary/30"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{line.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {line.status === "claimable_now"
                            ? "🎁 À donner maintenant"
                            : "🔓 Prochaine commande"}
                        </p>
                      </div>
                      {line.status === "claimable_now" && onClaimReward && (
                        <Button
                          size="sm"
                          className="rounded-xl text-xs shrink-0 bg-accent text-accent-foreground"
                          disabled={claimingIndex === idx}
                          onClick={() => onClaimReward(idx)}
                        >
                          {claimingIndex === idx ? "..." : "Récupérer"}
                        </Button>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-6 w-full"
              >
                <Button
                  onClick={onClose}
                  className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold"
                >
                  OK
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
