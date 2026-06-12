import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Crown, Zap, Building2, MessageCircle, Mail, ShieldCheck, Calendar } from "lucide-react";

const planIcons: Record<string, React.ElementType> = { starter: Zap, pro: Crown, franchise: Building2 };
const planLabels: Record<string, string> = { starter: "Starter", pro: "Pro", franchise: "Franchise" };

const CONTACT_WHATSAPP = "33600000000";
const CONTACT_EMAIL = "contact@fidelipro.com";

const AbonnementPage = () => {
  const { business } = useAuth();
  const plan = (business as any)?.subscription_plan as string | null;
  const PlanIcon = plan ? planIcons[plan] ?? Zap : Zap;
  const expiresAt = (business as any)?.subscription_expires_at;
  const activatedAt = (business as any)?.activated_at;

  const whatsappText = encodeURIComponent(
    `Bonjour, concernant mon compte FidéliPro (${business?.name ?? ""}) je souhaite modifier mon plan.`,
  );

  return (
    <DashboardLayout title="Abonnement" subtitle="Votre formule actuelle">
      <div className="max-w-3xl space-y-6">
        {/* Current plan */}
        <Card className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-card to-card/40 border-border/60">
          <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <PlanIcon className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Formule active
                </p>
                <h2 className="text-2xl font-display font-bold">
                  {plan ? planLabels[plan] : "—"}
                </h2>
              </div>
            </div>
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1.5">
              <ShieldCheck className="w-3 h-3" /> Actif
            </Badge>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            {activatedAt && (
              <div className="rounded-xl bg-secondary/40 p-4">
                <p className="text-xs text-muted-foreground mb-1">Activé le</p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {new Date(activatedAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
            {expiresAt && (
              <div className="rounded-xl bg-secondary/40 p-4">
                <p className="text-xs text-muted-foreground mb-1">Expire le</p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {new Date(expiresAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Contact for changes */}
        <Card className="p-6 sm:p-8 rounded-2xl">
          <h3 className="font-display font-bold text-lg mb-2">
            Besoin de changer de formule ou renouveler ?
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            La gestion des abonnements est assurée directement par notre équipe.
            Contactez-nous pour toute modification, renouvellement ou résiliation.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <a
                href={`https://wa.me/${CONTACT_WHATSAPP}?text=${whatsappText}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </a>
            </Button>
            <Button asChild variant="outline" className="rounded-xl gap-2">
              <a href={`mailto:${CONTACT_EMAIL}?subject=Modification%20de%20mon%20abonnement%20FidéliPro`}>
                <Mail className="w-4 h-4" />
                Email
              </a>
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AbonnementPage;
