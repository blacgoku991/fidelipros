import { motion } from "framer-motion";
import {
  AppWindow,
  ArrowUpRight,
  BarChart3,
  Bot,
  Boxes,
  DatabaseZap,
  Gauge,
  GraduationCap,
  LayoutTemplate,
  RefreshCcw,
  Search,
  ServerCog,
  ShieldCheck,
  Smartphone,
  Sparkle,
  Workflow,
} from "lucide-react";
import { SectionHeading } from "../ui/SectionHeading";
import { TiltCard } from "../ui/TiltCard";
import { Reveal, Stagger, StaggerItem } from "../ui/Reveal";
import { scrollToSection } from "@/hooks/useSmoothScroll";

/* ---------- Miniature visuals, one per pillar ---------- */

function BuildVisual() {
  return (
    <div className="relative h-40 overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-900/70">
      <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-3.5 py-2.5">
        <span className="h-2 w-2 rounded-full bg-coral/70" />
        <span className="h-2 w-2 rounded-full bg-[#FFC46B]/70" />
        <span className="h-2 w-2 rounded-full bg-mint/70" />
        <span className="ml-2 h-3.5 flex-1 rounded-full bg-white/[0.05]" />
      </div>
      <div className="space-y-2.5 p-4">
        {[
          { w: "72%", d: 0 },
          { w: "48%", d: 0.12 },
        ].map((bar) => (
          <motion.span
            key={bar.w}
            className="block h-2.5 rounded-full bg-gradient-to-r from-mint/60 to-violet/40"
            initial={{ width: 0 }}
            whileInView={{ width: bar.w }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.25 + bar.d, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
        <div className="grid grid-cols-3 gap-2 pt-1.5">
          {[0, 1, 2].map((index) => (
            <motion.span
              key={index}
              className="h-11 rounded-lg border border-white/[0.07] bg-white/[0.035]"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 + index * 0.1 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RebuildVisual() {
  return (
    <div className="group/vis relative h-40 overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-900/70">
      {/* "Before" — cramped, grey */}
      <div className="absolute inset-0 space-y-2 p-4 opacity-60">
        <span className="block h-2 w-1/3 rounded bg-white/15" />
        <span className="block h-2 w-3/4 rounded bg-white/10" />
        <span className="block h-2 w-2/3 rounded bg-white/10" />
        <span className="block h-2 w-4/5 rounded bg-white/10" />
        <span className="block h-2 w-1/2 rounded bg-white/10" />
        <span className="mt-3 block h-6 w-24 rounded bg-white/10" />
      </div>

      {/* "After" — wipes across on a loop */}
      <motion.div
        className="absolute inset-0 bg-ink-850"
        initial={{ clipPath: "inset(0 100% 0 0)" }}
        whileInView={{ clipPath: ["inset(0 100% 0 0)", "inset(0 0% 0 0)", "inset(0 0% 0 0)"] }}
        viewport={{ once: true }}
        transition={{ duration: 2.4, times: [0, 0.55, 1], delay: 0.4, ease: [0.65, 0, 0.35, 1] }}
      >
        <div className="space-y-3 p-4">
          <span className="block h-2.5 w-2/5 rounded-full bg-mint/70" />
          <span className="block h-2 w-4/5 rounded-full bg-white/20" />
          <span className="block h-2 w-3/5 rounded-full bg-white/12" />
          <div className="flex gap-2 pt-2">
            <span className="h-7 w-24 rounded-full bg-gradient-to-r from-mint to-violet" />
            <span className="h-7 w-20 rounded-full border border-white/15" />
          </div>
        </div>
      </motion.div>

      <motion.span
        className="absolute inset-y-0 w-px bg-gradient-to-b from-transparent via-mint to-transparent shadow-[0_0_16px_2px_rgba(79,240,212,0.6)]"
        initial={{ left: "0%", opacity: 0 }}
        whileInView={{ left: ["0%", "100%", "100%"], opacity: [0, 1, 0] }}
        viewport={{ once: true }}
        transition={{ duration: 2.4, times: [0, 0.55, 1], delay: 0.4, ease: [0.65, 0, 0.35, 1] }}
      />
    </div>
  );
}

function AutomateVisual() {
  const nodes = [
    { x: 22, y: 26, label: "A" },
    { x: 22, y: 74, label: "B" },
    { x: 78, y: 26, label: "C" },
    { x: 78, y: 74, label: "D" },
  ];

  return (
    <div className="relative h-40 overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-900/70">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        {nodes.map((node) => (
          <path
            key={node.label}
            d={`M ${node.x} ${node.y} L 50 50`}
            stroke="rgba(79,240,212,0.42)"
            strokeWidth="0.6"
            fill="none"
            className="flow-dash"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {nodes.map((node, index) => (
        <motion.span
          key={node.label}
          className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-white/12 bg-ink-800 font-mono text-[10px] text-fog-dim"
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          animate={{
            borderColor: [
              "rgba(255,255,255,0.12)",
              "rgba(79,240,212,0.6)",
              "rgba(255,255,255,0.12)",
            ],
          }}
          transition={{ duration: 3.2, repeat: Infinity, delay: index * 0.5 }}
        >
          {node.label}
        </motion.span>
      ))}

      <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border border-mint/40 bg-mint/10 backdrop-blur-sm">
        <Workflow className="h-5 w-5 text-mint" />
        <span className="absolute inset-0 animate-pulse-ring rounded-xl border border-mint/40" />
      </span>
    </div>
  );
}

/* ---------- Section ---------- */

const PILLARS = [
  {
    icon: LayoutTemplate,
    title: "Création de site web",
    kicker: "Design + dev, de zéro",
    body: "Vitrine, e-commerce, landing page ou application web. Direction artistique unique, animations soignées, contenu structuré pour le référencement — et un back-office que vous maîtrisez vraiment.",
    bullets: ["Design sur-mesure", "Responsive & accessible", "SEO technique inclus"],
    visual: BuildVisual,
    glow: "79 240 212",
  },
  {
    icon: RefreshCcw,
    title: "Refonte complète",
    kicker: "Reprise de l'existant",
    body: "Votre site est lent, daté, ou personne ne sait plus le modifier ? On audite, on récupère le contenu, on redesign et on migre sans perdre votre référencement ni vos données.",
    bullets: ["Audit technique & SEO", "Migration sans perte", "Redirections maîtrisées"],
    visual: RebuildVisual,
    glow: "139 92 255",
  },
  {
    icon: Workflow,
    title: "Automatisation métier",
    kicker: "Vos logiciels, connectés",
    body: "Logiciel métier, ERP, CRM, tableur, boîte mail, serveur de fichiers : on relie ce qui ne se parle pas, quel que soit l'outil. Synchronisations planifiées, imports/exports automatiques, alertes et rapports générés seuls.",
    bullets: ["Fin de la double saisie", "Scripts & API sur-mesure", "Supervision et alertes"],
    visual: AutomateVisual,
    glow: "255 92 138",
  },
];

/* Périmètre élargi : le web n'est qu'une porte d'entrée, l'informatique entière suit. */
const EXTRAS = [
  {
    icon: AppWindow,
    title: "Application métier sur-mesure",
    body: "Un outil interne taillé pour votre process, quand aucun logiciel du marché ne colle.",
  },
  {
    icon: BarChart3,
    title: "Tableaux de bord & reporting",
    body: "Vos chiffres consolidés, à jour, lisibles — sans exports manuels.",
  },
  {
    icon: Bot,
    title: "Robots & scripts (RPA)",
    body: "Une machine qui refait vos manipulations répétitives, à l'heure, sans erreur.",
  },
  {
    icon: Sparkle,
    title: "IA & assistants",
    body: "Chatbot, tri automatique, rédaction assistée, recherche dans vos documents.",
  },
  {
    icon: DatabaseZap,
    title: "Migration & reprise de données",
    body: "Récupération, nettoyage, dédoublonnage, contrôle qualité avant bascule.",
  },
  {
    icon: Boxes,
    title: "Intégrations & API",
    body: "Paiement, facturation, agenda, messagerie, signature électronique, livraison.",
  },
  {
    icon: Gauge,
    title: "Performance & Core Web Vitals",
    body: "Cache, images, budget de chargement, score mesuré avant/après.",
  },
  {
    icon: Search,
    title: "SEO technique",
    body: "Structure, données enrichies, indexation, redirections, maillage interne.",
  },
  {
    icon: Smartphone,
    title: "Mobile & PWA",
    body: "Expérience tactile, installable sur l'écran d'accueil, utilisable hors-ligne.",
  },
  {
    icon: ServerCog,
    title: "Hébergement & sauvegardes",
    body: "Mise en place, nom de domaine, e-mails, certificats, restauration testée.",
  },
  {
    icon: ShieldCheck,
    title: "Maintenance & infogérance",
    body: "Mises à jour, supervision, correctifs, astreinte sur les flux critiques.",
  },
  {
    icon: GraduationCap,
    title: "Formation & documentation",
    body: "Vos équipes autonomes, avec un mode opératoire écrit qui reste.",
  },
];

export function Services() {
  return (
    <section id="services" className="relative scroll-mt-24 py-28 sm:py-36">
      <div className="container-x">
        <SectionHeading
          eyebrow="Ce qu'on fait"
          title={
            <>
              Trois métiers, <span className="grad-accent">une seule équipe</span> qui va au bout.
            </>
          }
          description="Création de site web, refonte complète et automatisation informatique. Du premier pixel jusqu'au script qui tourne à 3 h du matin. Pas de sous-traitance en cascade, pas de projet abandonné à mi-chemin."
        />

        <div className="mt-16 grid gap-5 lg:grid-cols-3">
          {PILLARS.map((pillar, index) => (
            <Reveal key={pillar.title} delay={index * 0.1}>
              <TiltCard className="h-full p-6 sm:p-7" glowColor={pillar.glow} intensity={6}>
                <pillar.visual />

                <div className="mt-6 flex items-center gap-2.5">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10"
                    style={{ background: `rgb(${pillar.glow} / 0.1)` }}
                  >
                    <pillar.icon className="h-4 w-4" style={{ color: `rgb(${pillar.glow})` }} />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fog-faint">
                    {pillar.kicker}
                  </span>
                </div>

                <h3 className="mt-4 text-[22px] font-semibold leading-tight">{pillar.title}</h3>
                <p className="mt-3 text-[14.5px] leading-relaxed text-fog-dim">{pillar.body}</p>

                <ul className="mt-5 space-y-2 border-t border-white/[0.07] pt-5">
                  {pillar.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-2.5 text-[13.5px] text-fog">
                      <span
                        className="h-1 w-1 shrink-0 rounded-full"
                        style={{ background: `rgb(${pillar.glow})` }}
                      />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </TiltCard>
            </Reveal>
          ))}
        </div>

        {/* Supporting capabilities */}
        <Reveal className="mt-20">
          <h3 className="headline text-[clamp(1.5rem,3.4vw,2.2rem)] leading-tight">
            Et tout le reste de votre informatique.
          </h3>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-fog-dim">
            Le site n&apos;est qu&apos;une porte d&apos;entrée. Dès qu&apos;un outil, un fichier ou
            une tâche passe par un ordinateur, il y a probablement moyen de l&apos;améliorer, de le
            relier au reste ou de le faire tourner tout seul.
          </p>
        </Reveal>

        <Stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {EXTRAS.map((extra) => (
            <StaggerItem key={extra.title}>
              <div className="panel panel-hover group flex h-full items-start gap-4 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-fog-dim transition-colors duration-300 group-hover:border-mint/30 group-hover:text-mint">
                  <extra.icon className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <h4 className="text-[15px] font-semibold">{extra.title}</h4>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-fog-dim">{extra.body}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.1} className="mt-12">
          <button
            type="button"
            onClick={() => scrollToSection("#contact")}
            className="group inline-flex items-center gap-2 font-display text-sm font-semibold text-white"
          >
            <span className="link-underline">Un besoin qui n&apos;est pas dans la liste ?</span>
            <ArrowUpRight className="h-4 w-4 text-mint transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </Reveal>
      </div>
    </section>
  );
}
