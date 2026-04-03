import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  CreditCard, ExternalLink, AlertTriangle, RefreshCw, Zap, Crown, Check, Loader2,
  Shield, Receipt, ArrowRight, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { STRIPE_PLANS, type PlanKey } from "@/lib/stripePlans";
import { motion } from "framer-motion";

const planIcons: Record<string, React.ElementType> = { starter: Zap, pro: Crown, franchise: Building2 };
const planGradients: Record<string, string> = {
  starter: "from-violet-500 to-purple-600",
  pro: "from-amber-400 to-orange-500",
  franchise: "from-emerald-500 to-teal-600",
};

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  active:   { label: "Actif",     color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", dot: "bg-emerald-500" },
  inactive: { label: "Inactif",   color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", dot: "bg-red-500" },
  past_due: { label: "Impayé",    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", dot: "bg-orange-500" },
  canceled: { label: "Annulé",    color: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  trialing: { label: "Essai",     color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", dot: "bg-blue-500" },
};

const AbonnementPage = () => {
  const { business } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Refresh business data when returning from Stripe portal or on focus
  const refreshSubscription = useCallback(async () => {
    setRefreshing(true);
    try {
      await supabase.functions.invoke("check-subscription");
      // Force page reload to get fresh business data from useAuth
      window.location.reload();
    } catch {
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh when returning from Stripe portal (detected via visibility change)
  useEffect(() => {
    let wasHidden = false;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        wasHidden = true;
      }
      if (document.visibilityState === "visible" && wasHidden) {
        wasHidden = false;
        setPortalLoading(false);
        refreshSubscription();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [refreshSubscription]);

  // Also check URL param for portal return
  useEffect(() => {
    if (searchParams.get("portal_return") === "true") {
      refreshSubscription();
    }
  }, [searchParams, refreshSubscription]);

  const plan = business?.subscription_plan as PlanKey | null;
  const status = business?.subscription_status as string | null;
  const planData = plan ? STRIPE_PLANS[plan] : null;
  const statusInfo = status ? (statusConfig[status] || statusConfig.inactive) : statusConfig.inactive;
  const Icon = plan ? (planIcons[plan] || CreditCard) : CreditCard;
  const gradient = plan ? (planGradients[plan] || "from-primary to-primary/70") : "from-primary to-primary/70";

  const openPortal = async () => {
    setPortalLoading(true);
    const { data, error } = await supabase.functions.invoke("customer-portal");
    setPortalLoading(false);
    if (error || !data?.url) {
      toast.error("Impossible d'accéder au portail de facturation");
      return;
    }
    window.open(data.url, "_blank");
  };

  const cancelSubscription = async () => {
    setCanceling(true);
    const { data, error } = await supabase.functions.invoke("customer-portal");
    setCanceling(false);
    setCancelDialogOpen(false);
    if (error || !data?.url) {
      toast.error("Erreur lors de l'annulation");
      return;
    }
    // Validate redirect URL is from trusted Stripe domain
    try {
      const parsed = new URL(data.url);
      if (!parsed.hostname.endsWith("stripe.com")) {
        toast.error("URL de redirection non autorisée");
        return;
      }
    } catch {
      toast.error("URL invalide");
      return;
    }
    window.location.href = data.url;
  };

  return (
    <DashboardLayout title="Abonnement" subtitle="Gérez votre plan et vos paiements">
      <div className="max-w-2xl space-y-5">

        {/* Current plan card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card border border-border/40 overflow-hidden shadow-sm">
          {/* Plan header with gradient */}
          <div className={`bg-gradient-to-r ${gradient} p-5 sm:p-6`}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <Icon className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-xl font-display font-bold text-white">{planData?.name ?? "Aucun plan"}</h3>
                  <Badge className={`${statusInfo.color} text-[10px] font-semibold`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot} mr-1.5 inline-block`} />
                    {statusInfo.label}
                  </Badge>
                </div>
                <p className="text-sm text-white/70 mt-0.5">
                  {planData ? `${planData.price}€/mois · Renouvelé automatiquement` : "Aucun abonnement actif"}
                </p>
              </div>
              {planData && (
                <p className="text-3xl font-display font-bold text-white hidden sm:block">
                  {planData.price}€<span className="text-sm font-normal text-white/60">/mois</span>
                </p>
              )}
            </div>
          </div>

          {/* Features */}
          {planData && (
            <div className="p-5 sm:p-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Inclus dans votre plan</p>
              <div className="grid grid-cols-2 gap-2">
                {planData.features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Actions */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-2xl bg-card border border-border/40 p-5 sm:p-6 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Actions rapides</h2>

          <div className="grid sm:grid-cols-2 gap-3">
            <Button
              onClick={openPortal}
              disabled={portalLoading}
              className="h-14 rounded-xl bg-gradient-primary text-primary-foreground gap-3 justify-start px-5"
            >
              {portalLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Receipt className="w-5 h-5" />}
              <div className="text-left">
                <p className="text-sm font-semibold">Portail de facturation</p>
                <p className="text-[10px] opacity-70">Factures, méthode de paiement</p>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate(`/dashboard/checkout?plan=${plan || "pro"}`)}
              className="h-14 rounded-xl gap-3 justify-start px-5"
            >
              <RefreshCw className="w-5 h-5 text-primary" />
              <div className="text-left">
                <p className="text-sm font-semibold">Changer de plan</p>
                <p className="text-[10px] text-muted-foreground">Upgrader ou downgrader</p>
              </div>
            </Button>
          </div>

          {(status === "inactive" || status === "canceled" || status === "past_due") && (
            <Button
              onClick={() => navigate(`/dashboard/checkout?plan=${plan || "pro"}`)}
              className="w-full h-12 rounded-xl gap-3 bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <CreditCard className="w-4 h-4" />
              Réactiver mon abonnement
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
          )}

          {status === "active" && (
            <Button
              variant="ghost"
              onClick={() => setCancelDialogOpen(true)}
              className="w-full justify-start h-11 rounded-xl gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 text-sm"
            >
              <AlertTriangle className="w-4 h-4" />
              Annuler mon abonnement
            </Button>
          )}
        </motion.div>

        {/* Security note */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="flex items-center gap-3 p-4 rounded-2xl bg-secondary/30 border border-border/30">
          <Shield className="w-5 h-5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Tous les paiements sont sécurisés et traités par Stripe. Vos données bancaires ne sont jamais stockées sur nos serveurs.
          </p>
        </motion.div>
      </div>

      {/* Cancel confirmation dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">Annuler l'abonnement ?</DialogTitle>
            <DialogDescription className="text-center">
              Vous serez redirigé vers le portail de facturation pour confirmer l'annulation.
              Votre accès restera actif jusqu'à la fin de la période en cours.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            <Button
              variant="destructive"
              onClick={cancelSubscription}
              disabled={canceling}
              className="rounded-xl h-11 gap-2"
            >
              {canceling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Confirmer l'annulation
            </Button>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} className="rounded-xl h-11">
              Garder mon abonnement
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AbonnementPage;
