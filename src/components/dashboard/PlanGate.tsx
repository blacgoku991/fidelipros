import { useAuth } from "@/hooks/useAuth";
import { getPlanLimits } from "@/lib/stripePlans";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";
import { Link } from "react-router-dom";

interface PlanGateProps {
  feature: keyof ReturnType<typeof getPlanLimits>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Wraps a page and blocks access if the current plan doesn't include the feature.
 * Shows an upgrade prompt instead.
 */
export function PlanGate({ feature, title, subtitle, children }: PlanGateProps) {
  const { business } = useAuth();
  const plan = (business as any)?.subscription_plan || "starter";
  const limits = getPlanLimits(plan);

  if (!limits[feature]) {
    return (
      <DashboardLayout title={title} subtitle={subtitle}>
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-2 max-w-md">
            <h2 className="text-2xl font-bold">Fonctionnalité Pro</h2>
            <p className="text-muted-foreground">
              Cette fonctionnalité est disponible avec le plan <strong>Pro</strong> ou supérieur.
              Passez au plan Pro pour débloquer {title.toLowerCase()}, les campagnes marketing, les automations, et bien plus.
            </p>
          </div>
          <Link to="/dashboard/checkout?plan=pro">
            <Button className="bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl gap-2 px-6">
              <Crown className="w-4 h-4" /> Passer au Pro
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return <>{children}</>;
}
