import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowUpRight, Sparkles } from "lucide-react";
import { MaskedWords } from "../ui/Reveal";
import { Magnetic } from "../ui/Magnetic";
import { Marquee } from "../ui/Marquee";
import { scrollToSection } from "@/hooks/useSmoothScroll";

const EASE = [0.22, 1, 0.36, 1] as const;

const CAPABILITIES = [
  "Sites vitrines & e-commerce",
  "Refonte complète",
  "Automatisation métier",
  "Interconnexion logicielle",
  "Applications web sur-mesure",
  "Intégrations API",
  "Tableaux de bord temps réel",
  "Migration de données",
];

export function Hero({ ready }: { ready: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  // Progress across the hero itself — a document-wide progress would barely move
  // over a page this long.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  // Content drifts up faster than the page so the 3D core is uncovered on scroll.
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -140]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

  return (
    <section
      ref={sectionRef}
      id="top"
      className="relative flex min-h-[100svh] flex-col overflow-hidden pt-[68px]"
    >
      {/* Ambient wash sitting between the canvas and the copy */}
      <div className="pointer-events-none absolute inset-0 -z-[5]">
        <div className="absolute right-[6%] top-[46%] h-[680px] w-[680px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(79,240,212,0.09),transparent_62%)] blur-3xl" />
        <div className="absolute -right-40 top-16 h-[540px] w-[540px] rounded-full bg-[radial-gradient(circle,rgba(139,92,255,0.13),transparent_66%)] blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-ink-950 to-transparent" />
      </div>
      <div className="grid-lines pointer-events-none absolute inset-0 -z-[4] mask-fade-b opacity-[0.55]" />
      {/* Scrim keeping the headline readable wherever the core drifts */}
      <div className="pointer-events-none absolute inset-0 -z-[3] bg-[linear-gradient(180deg,rgba(4,5,10,0.5)_0%,rgba(4,5,10,0.68)_45%,rgba(4,5,10,0.86)_100%)] lg:bg-[linear-gradient(100deg,rgba(4,5,10,0.92)_0%,rgba(4,5,10,0.72)_30%,rgba(4,5,10,0.12)_52%,transparent_66%)]" />

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="container-x relative flex flex-1 flex-col justify-center py-10"
      >
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: EASE }}
          className="mb-6"
        >
          <span className="eyebrow">
            <Sparkles className="h-3 w-3 text-mint" />
            Agence web · Asnières-sur-Seine (92)
          </span>
        </motion.div>

        {/* Le slogan porte l'impact, la ligne d'appui porte les mots-clés. */}
        <h1 className="headline max-w-[16ch] text-[clamp(2.6rem,7.8vw,5.6rem)] leading-[0.95]">
          {ready && (
            <>
              <MaskedWords text="On conçoit," delay={0.1} />
              <br />
              <MaskedWords text="on refond," delay={0.24} />
              <br />
              <MaskedWords text="on automatise." delay={0.38} wordClassName="grad-text" />
              <motion.span
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.75, ease: EASE }}
                className="mt-4 block max-w-[32ch] font-display text-[clamp(1rem,2vw,1.3rem)] font-medium leading-snug tracking-normal text-fog"
              >
                Sites web sur-mesure et automatisation informatique — à Asnières-sur-Seine et
                partout en Île-de-France.
              </motion.span>
            </>
          )}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, delay: 0.85, ease: EASE }}
          className="mt-6 max-w-xl text-[15px] leading-relaxed text-fog-dim sm:text-[16.5px]"
        >
          <strong className="font-normal text-fog">SmartFixx</strong> crée des sites web sur-mesure,
          reprend les projets qui patinent et automatise tout ce qui se répète dans votre
          informatique — logiciels métiers, ERP, CRM, tableurs, e-mails, API.{" "}
          <span className="text-fog">
            Si une tâche revient chaque semaine, elle peut disparaître.
          </span>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, delay: 1, ease: EASE }}
          className="mt-8 flex flex-wrap items-center gap-3.5"
        >
          <Magnetic strength={0.25}>
            <a
              href="#contact"
              onClick={(event) => {
                event.preventDefault();
                scrollToSection("#contact");
              }}
              className="btn-primary group"
              data-cursor-label="Go"
            >
              Lancer mon projet
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </Magnetic>

          <Magnetic strength={0.18}>
            <a
              href="#automatisation"
              onClick={(event) => {
                event.preventDefault();
                scrollToSection("#automatisation");
              }}
              className="btn-ghost"
            >
              Voir l&apos;automatisation
            </a>
          </Magnetic>
        </motion.div>

        {/* Quick proof row */}
        <motion.dl
          initial={{ opacity: 0 }}
          animate={ready ? { opacity: 1 } : {}}
          transition={{ duration: 1, delay: 1.2 }}
          className="mt-9 grid grid-cols-3 gap-x-4 border-t border-white/[0.07] pt-7 sm:flex sm:flex-wrap sm:gap-x-10"
        >
          {[
            { value: "48 h", label: "Première maquette" },
            { value: "100 %", label: "Sur-mesure, zéro template" },
            { value: "≤ 1,5 s", label: "Temps de chargement visé" },
          ].map((item) => (
            <div key={item.label} className="flex flex-col gap-1">
              <dt className="font-display text-lg font-semibold text-white sm:text-xl">
                {item.value}
              </dt>
              <dd className="font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-fog-faint sm:text-[10.5px] sm:tracking-[0.16em]">
                {item.label}
              </dd>
            </div>
          ))}
        </motion.dl>
      </motion.div>

      {/* Scroll hint */}
      <motion.button
        type="button"
        onClick={() => scrollToSection("#services")}
        initial={{ opacity: 0 }}
        animate={ready ? { opacity: 1 } : {}}
        transition={{ duration: 1, delay: 1.5 }}
        className="absolute bottom-[92px] right-8 z-10 hidden flex-col items-center gap-2 text-fog-faint transition-colors hover:text-mint md:flex"
        aria-label="Défiler vers les services"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.28em]">Défiler</span>
        <motion.span
          animate={{ y: [0, 7, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ArrowDown className="h-4 w-4" />
        </motion.span>
      </motion.button>

      {/* Capability ticker closing the fold */}
      <div className="relative border-y border-white/[0.06] bg-ink-950/45 py-3.5 backdrop-blur-md">
        <Marquee duration={46}>
          {CAPABILITIES.map((item) => (
            <span
              key={item}
              className="flex items-center gap-3 whitespace-nowrap px-6 font-mono text-[11px] uppercase tracking-[0.18em] text-fog-dim"
            >
              <span className="h-1 w-1 rounded-full bg-mint/70" />
              {item}
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
