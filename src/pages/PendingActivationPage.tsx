import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, MessageCircle, Mail, LogOut, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const CONTACT_WHATSAPP = "33600000000"; // TODO: configure real number
const CONTACT_EMAIL = "contact@fidelipro.com";

export default function PendingActivationPage() {
  const navigate = useNavigate();
  const { user, business, loading, refreshBusiness } = useAuth();

  // Auto-redirect once activated
  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (business && !(business as any).requires_admin_activation) {
      navigate("/dashboard", { replace: true });
    }
  }, [loading, user, business, navigate]);

  // Poll every 10s for activation
  useEffect(() => {
    const t = setInterval(() => {
      refreshBusiness?.();
    }, 10_000);
    return () => clearInterval(t);
  }, [refreshBusiness]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const whatsappText = encodeURIComponent(
    `Bonjour, je viens de créer mon compte FidéliPro (${business?.name ?? ""} – ${user?.email ?? ""}) et je souhaite l'activer.`,
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <Card className="p-8 sm:p-10 bg-gradient-to-br from-card to-card/40 border-border/60 rounded-3xl shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
                <Clock className="w-10 h-10 text-primary" />
              </div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              </motion.div>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-display font-bold text-center mb-2">
            Compte créé avec succès
          </h1>
          <p className="text-center text-muted-foreground mb-6 text-sm">
            <CheckCircle2 className="w-4 h-4 inline-block text-emerald-500 mr-1.5 -mt-0.5" />
            {business?.name ?? "Votre commerce"} — {user?.email}
          </p>

          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5 mb-6">
            <p className="text-sm leading-relaxed text-foreground">
              <strong>Votre compte est en attente d'activation.</strong>
              <br />
              <span className="text-muted-foreground">
                Pour activer votre programme de fidélité, contactez notre équipe.
                Nous configurons votre plan, votre template et débloquons votre
                tableau de bord en moins de 24h.
              </span>
            </p>
          </div>

          <div className="space-y-2.5">
            <Button
              asChild
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
            >
              <a
                href={`https://wa.me/${CONTACT_WHATSAPP}?text=${whatsappText}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="w-4 h-4" />
                Activer via WhatsApp
              </a>
            </Button>

            <Button
              asChild
              variant="outline"
              className="w-full h-12 rounded-xl gap-2"
            >
              <a href={`mailto:${CONTACT_EMAIL}?subject=Activation%20de%20mon%20compte%20FidéliPro`}>
                <Mail className="w-4 h-4" />
                Activer par email
              </a>
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t border-border/40 flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Vérification automatique toutes les 10s
            </span>
            <button
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3 h-3" /> Se déconnecter
            </button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
