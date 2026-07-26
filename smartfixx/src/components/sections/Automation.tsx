import { motion } from "framer-motion";
import {
  AlarmClock,
  BellRing,
  CalendarClock,
  Database,
  FileSpreadsheet,
  HeartPulse,
  LayoutDashboard,
  Receipt,
  ShieldPlus,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeading } from "../ui/SectionHeading";
import { Reveal } from "../ui/Reveal";
import { LogoMark } from "../ui/Logo";
import { cn } from "@/lib/utils";

/* Diagram lives in a 1000 x 560 space; HTML nodes are placed with the same ratio
   so they stay locked to the SVG connectors at every width. */
const VB_W = 1000;
const VB_H = 560;
const HUB_Y = 260;

type Node = {
  id: string;
  label: string;
  sub: string;
  icon: LucideIcon;
  y: number;
};

const SOURCES: Node[] = [
  { id: "bluekango", label: "BlueKango", sub: "Qualité & risques", icon: ShieldPlus, y: 80 },
  { id: "netsoins", label: "Netsoins", sub: "Dossier de soins", icon: HeartPulse, y: 200 },
  { id: "erp", label: "ERP / CRM", sub: "Sage, Odoo, HubSpot", icon: Database, y: 320 },
  { id: "files", label: "Excel & CSV", sub: "Fichiers, mails, FTP", icon: FileSpreadsheet, y: 440 },
];

const TARGETS: Node[] = [
  {
    id: "dashboard",
    label: "Tableau de bord",
    sub: "Indicateurs temps réel",
    icon: LayoutDashboard,
    y: 80,
  },
  { id: "billing", label: "Facturation", sub: "Devis, factures, relances", icon: Receipt, y: 200 },
  {
    id: "planning",
    label: "Planning & RH",
    sub: "Plannings, absences",
    icon: CalendarClock,
    y: 320,
  },
  { id: "alerts", label: "Alertes", sub: "E-mail, SMS, Teams", icon: BellRing, y: 440 },
];

const sourcePath = (y: number) => `M 238 ${y} C 344 ${y}, 352 ${HUB_Y}, 428 ${HUB_Y}`;
const targetPath = (y: number) => `M 572 ${HUB_Y} C 648 ${HUB_Y}, 656 ${y}, 762 ${y}`;

const pct = (value: number, total: number) => `${(value / total) * 100}%`;

function DiagramNode({ node, side, index }: { node: Node; side: "left" | "right"; index: number }) {
  const x = side === "left" ? 134 : 866;

  return (
    <div
      className="absolute w-[20%] -translate-x-1/2 -translate-y-1/2"
      style={{ left: pct(x, VB_W), top: pct(node.y, VB_H) }}
    >
      <motion.div
        initial={{ opacity: 0, x: side === "left" ? -24 : 24 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-15% 0px" }}
        transition={{ duration: 0.7, delay: 0.25 + index * 0.09, ease: [0.22, 1, 0.36, 1] }}
        className="group flex items-center gap-2.5 rounded-xl border border-white/[0.09] bg-ink-850/85 px-3 py-2.5 backdrop-blur-md transition-colors duration-300 hover:border-mint/35"
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08]",
            side === "left" ? "bg-mint/10 text-mint" : "bg-violet/10 text-violet-400",
          )}
        >
          <node.icon className="h-[15px] w-[15px]" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-semibold text-white">
            {node.label}
          </span>
          <span className="block truncate font-mono text-[9.5px] uppercase tracking-wider text-fog-faint">
            {node.sub}
          </span>
        </span>
      </motion.div>
    </div>
  );
}

function FlowDiagram() {
  return (
    <div className="relative w-full" style={{ aspectRatio: `${VB_W} / ${VB_H}` }}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <filter id="pktGlow" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="hubGlow">
            <stop offset="0%" stopColor="#4FF0D4" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#4FF0D4" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="500" cy={HUB_Y} r="190" fill="url(#hubGlow)" />

        {SOURCES.map((node, index) => (
          <g key={node.id}>
            <path
              id={`path-${node.id}`}
              d={sourcePath(node.y)}
              fill="none"
              stroke="rgba(79,240,212,0.30)"
              strokeWidth="1.4"
            />
            <path
              d={sourcePath(node.y)}
              fill="none"
              stroke="rgba(79,240,212,0.7)"
              strokeWidth="1.4"
              className="flow-dash"
            />
            <circle r="4.5" fill="#6BF5DE" filter="url(#pktGlow)">
              <animateMotion
                dur="3.4s"
                repeatCount="indefinite"
                begin={`${index * 0.85}s`}
                keyPoints="0;1"
                keyTimes="0;1"
                calcMode="spline"
                keySplines="0.45 0 0.55 1"
              >
                <mpath href={`#path-${node.id}`} />
              </animateMotion>
            </circle>
          </g>
        ))}

        {TARGETS.map((node, index) => (
          <g key={node.id}>
            <path
              id={`path-${node.id}`}
              d={targetPath(node.y)}
              fill="none"
              stroke="rgba(139,92,255,0.30)"
              strokeWidth="1.4"
            />
            <path
              d={targetPath(node.y)}
              fill="none"
              stroke="rgba(139,92,255,0.7)"
              strokeWidth="1.4"
              className="flow-dash"
            />
            <circle r="4.5" fill="#A985FF" filter="url(#pktGlow)">
              <animateMotion
                dur="3.4s"
                repeatCount="indefinite"
                begin={`${1.7 + index * 0.85}s`}
                keyPoints="0;1"
                keyTimes="0;1"
                calcMode="spline"
                keySplines="0.45 0 0.55 1"
              >
                <mpath href={`#path-${node.id}`} />
              </animateMotion>
            </circle>
          </g>
        ))}

        {/* Hub rings */}
        <g transform={`translate(500 ${HUB_Y})`}>
          <circle
            r="88"
            fill="none"
            stroke="rgba(79,240,212,0.28)"
            strokeWidth="1"
            strokeDasharray="3 9"
            className="origin-center animate-spin-slow"
          />
          <circle
            r="112"
            fill="none"
            stroke="rgba(139,92,255,0.2)"
            strokeWidth="1"
            strokeDasharray="1 14"
          />
        </g>
      </svg>

      {SOURCES.map((node, index) => (
        <DiagramNode key={node.id} node={node} side="left" index={index} />
      ))}
      {TARGETS.map((node, index) => (
        <DiagramNode key={node.id} node={node} side="right" index={index} />
      ))}

      {/* Hub */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: "50%", top: pct(HUB_Y, VB_H) }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex flex-col items-center gap-2 rounded-2xl border border-mint/25 bg-ink-900/90 px-5 py-4 backdrop-blur-xl"
        >
          <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-mint/25" />
          <LogoMark className="h-8 w-8" />
          <span className="whitespace-nowrap font-display text-[13px] font-semibold text-white">
            Moteur SmartFixx
          </span>
          <span className="whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.16em] text-mint">
            Règles · Contrôles · Journaux
          </span>
        </motion.div>
      </div>
    </div>
  );
}

/** Stacked equivalent for narrow screens where the wide diagram would collapse. */
function FlowStack() {
  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog-faint">Sources</p>
      <div className="grid grid-cols-2 gap-2.5">
        {SOURCES.map((node) => (
          <div
            key={node.id}
            className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"
          >
            <node.icon className="h-4 w-4 shrink-0 text-mint" />
            <span className="min-w-0 text-[12.5px] font-medium text-white">{node.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-2 py-2">
        <span className="h-8 w-px bg-gradient-to-b from-mint/60 to-violet/60" />
        <div className="flex items-center gap-2.5 rounded-xl border border-mint/25 bg-ink-900 px-4 py-3">
          <LogoMark className="h-6 w-6" />
          <span className="font-display text-[13px] font-semibold text-white">
            Moteur SmartFixx
          </span>
        </div>
        <span className="h-8 w-px bg-gradient-to-b from-violet/60 to-violet/20" />
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog-faint">Sorties</p>
      <div className="grid grid-cols-2 gap-2.5">
        {TARGETS.map((node) => (
          <div
            key={node.id}
            className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"
          >
            <node.icon className="h-4 w-4 shrink-0 text-violet-400" />
            <span className="min-w-0 text-[12.5px] font-medium text-white">{node.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SCENARIOS = [
  {
    icon: ShieldPlus,
    title: "BlueKango ↔ Netsoins",
    body: "Résidents, événements indésirables et plans d'action alignés automatiquement chaque nuit. Plus de ressaisie d'un logiciel à l'autre, plus d'écart entre les deux bases.",
    metric: "≈ 6 h",
    metricLabel: "récupérées / semaine",
  },
  {
    icon: FileSpreadsheet,
    title: "Rapports générés seuls",
    body: "Extraction des données, mise en forme aux couleurs de la maison, export PDF et envoi aux bonnes personnes. Le rapport mensuel arrive avant que vous y pensiez.",
    metric: "1 j",
    metricLabel: "économisée / mois",
  },
  {
    icon: AlarmClock,
    title: "Surveillance & alertes",
    body: "Seuils dépassés, échéance qui approche, import qui échoue : une alerte part immédiatement par e-mail, SMS ou Teams, avec le contexte nécessaire pour agir.",
    metric: "24/7",
    metricLabel: "sans intervention",
  },
];

export function Automation() {
  return (
    <section id="automatisation" className="relative scroll-mt-24 overflow-hidden py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(139,92,255,0.08),transparent_65%)] blur-3xl" />

      <div className="container-x relative">
        <SectionHeading
          eyebrow="Automatisation"
          title={
            <>
              Vos logiciels ne se parlent pas ?{" "}
              <span className="grad-accent">On construit le pont.</span>
            </>
          }
          description="La double saisie coûte plus cher qu'un développement. On relie vos outils entre eux, on planifie les échanges, on contrôle chaque transfert et on vous laisse le journal complet de ce qui s'est passé."
        />

        <Reveal delay={0.1} className="mt-14">
          <div className="panel overflow-hidden p-4 sm:p-7">
            <div className="hidden md:block">
              <FlowDiagram />
            </div>
            <div className="md:hidden">
              <FlowStack />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/[0.07] pt-5">
              {[
                { color: "bg-mint", label: "Lecture des sources" },
                { color: "bg-violet", label: "Écriture vers les outils métier" },
                { color: "bg-coral", label: "Contrôle & journalisation" },
              ].map((item) => (
                <span
                  key={item.label}
                  className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-fog-faint"
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", item.color)} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {SCENARIOS.map((scenario, index) => (
            <Reveal key={scenario.title} delay={index * 0.09}>
              <div className="panel panel-hover flex h-full flex-col p-6">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-mint/[0.07] text-mint">
                    <scenario.icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="text-right">
                    <div className="font-display text-2xl font-semibold text-white">
                      {scenario.metric}
                    </div>
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-fog-faint">
                      {scenario.metricLabel}
                    </div>
                  </div>
                </div>
                <h3 className="mt-5 text-[17px] font-semibold">{scenario.title}</h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-fog-dim">{scenario.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
            <Zap className="h-4 w-4 shrink-0 text-mint" />
            <p className="text-[13px] leading-relaxed text-fog-dim">
              Si un outil expose une API, un export ou une base de données, on sait
              l&apos;automatiser. Sinon, on trouve un autre chemin.{" "}
              <span className="text-fog-faint">
                Marques citées à titre d&apos;exemples d&apos;intégrations ; SmartFixx n&apos;est
                affilié à aucun de ces éditeurs.
              </span>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
