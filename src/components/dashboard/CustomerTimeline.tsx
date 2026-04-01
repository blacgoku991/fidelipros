import { Badge } from "@/components/ui/badge";
import { ScanLine, Gift, Send, Calendar, Star } from "lucide-react";

interface TimelineEvent {
  type: "scan" | "reward" | "campaign" | "joined" | "level_up";
  date: string;
  label: string;
  detail?: string;
}

interface CustomerTimelineProps {
  history: any[];
  customer: any;
}

export function CustomerTimeline({ history, customer }: CustomerTimelineProps) {
  const events: TimelineEvent[] = [];

  // First visit
  if (customer?.created_at) {
    events.push({ type: "joined", date: customer.created_at, label: "Client inscrit" });
  }

  // Scans from history
  (history || []).forEach((h: any) => {
    if (h.action === "reward") {
      events.push({ type: "reward", date: h.created_at, label: "Récompense débloquée", detail: h.note });
    } else {
      events.push({ type: "scan", date: h.created_at, label: `+${h.points_added} point${h.points_added > 1 ? "s" : ""}`, detail: h.note });
    }
  });

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const iconMap = {
    scan: ScanLine,
    reward: Gift,
    campaign: Send,
    joined: Calendar,
    level_up: Star,
  };

  const colorMap = {
    scan: "bg-primary/10 text-primary",
    reward: "bg-amber-500/10 text-amber-600",
    campaign: "bg-blue-500/10 text-blue-600",
    joined: "bg-emerald-500/10 text-emerald-600",
    level_up: "bg-purple-500/10 text-purple-600",
  };

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Aucun historique</p>;
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border/50" />
      <div className="space-y-3">
        {events.slice(0, 20).map((event, i) => {
          const Icon = iconMap[event.type];
          return (
            <div key={i} className="flex items-start gap-3 relative">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 -ml-6 z-10 ${colorMap[event.type]}`}>
                <Icon className="w-3 h-3" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm font-medium">{event.label}</p>
                {event.detail && <p className="text-xs text-muted-foreground">{event.detail}</p>}
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {new Date(event.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
