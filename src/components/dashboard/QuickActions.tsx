import { Button } from "@/components/ui/button";
import { Send, Clock, Gift } from "lucide-react";
import { Link } from "react-router-dom";

export function QuickActions() {
  const actions = [
    { icon: Send, label: "Envoyer une offre", link: "/dashboard/campaigns", variant: "default" as const },
    { icon: Clock, label: "Relancer les inactifs", link: "/dashboard/automations", variant: "outline" as const },
    { icon: Gift, label: "Récompenser les meilleurs", link: "/dashboard/campaigns", variant: "outline" as const },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button key={a.label} asChild variant={a.variant} size="sm" className="rounded-xl gap-2 text-xs">
          <Link to={a.link}>
            <a.icon className="w-3.5 h-3.5" />
            {a.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}
