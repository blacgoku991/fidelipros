import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { SectionHeading } from "../ui/SectionHeading";
import { Reveal } from "../ui/Reveal";
import { Counter } from "../ui/Counter";
import { scrollToSection } from "@/hooks/useSmoothScroll";

/*
 * Représentations de projets types. Remplacez librement par vos références
 * réelles (client, chiffres constatés, lien) une fois les premiers cas livrés.
 */
const PROJECTS = [
  {
    tag: "Création",
    title: "Site vitrine premium",
    context: "PME de services · 8 pages + blog",
    duration: "3 à 4 semaines",
    scope: [
      "Direction artistique dédiée",
      "Rédaction et structuration du contenu",
      "Blog autonome et formulaires qualifiés",
      "Socle SEO technique complet",
    ],
    outcome: "Une image en ligne au niveau réel de la prestation.",
    hue: { from: "#4FF0D4", to: "#1D9C8A" },
  },
  {
    tag: "Refonte",
    title: "Boutique en ligne reprise à zéro",
    context: "E-commerce · catalogue de 400 références",
    duration: "6 à 8 semaines",
    scope: [
      "Audit de l'existant et plan de redirections",
      "Migration catalogue, clients et commandes",
      "Tunnel d'achat repensé",
      "Budget de performance tenu",
    ],
    outcome: "Un site rapide, réparable, et un tunnel qui ne perd plus personne.",
    hue: { from: "#8B5CFF", to: "#4B2BB5" },
  },
  {
    tag: "Automatisation",
    title: "Connecteur entre logiciels métiers",
    context: "Médico-social · plusieurs établissements",
    duration: "4 semaines",
    scope: [
      "Cartographie des données et des règles",
      "Synchronisation planifiée avec contrôles",
      "Rapports générés et diffusés seuls",
      "Journal d'exécution et alertes en cas d'échec",
    ],
    outcome: "La double saisie disparaît, les écarts entre bases aussi.",
    hue: { from: "#FF5C8A", to: "#A32A55" },
  },
];

const COMMITMENTS = [
  { value: 100, suffix: " %", label: "Code livré et documenté" },
  { value: 48, suffix: " h", label: "Première maquette" },
  { value: 24, suffix: " h", label: "Délai de réponse max." },
  { value: 0, suffix: "", label: "Abonnement imposé" },
];

/** Generative cover — no image assets, so it scales and never goes stale. */
function ProjectCover({ from, to, index }: { from: string; to: string; index: number }) {
  return (
    <div className="relative h-44 overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-900">
      <div
        className="absolute inset-0 opacity-70"
        style={{ background: `radial-gradient(120% 90% at 22% 12%, ${from}33, transparent 62%)` }}
      />
      <div
        className="absolute -bottom-16 -right-10 h-52 w-52 rounded-full blur-2xl"
        style={{ background: `radial-gradient(circle, ${to}55, transparent 68%)` }}
      />
      <div className="grid-lines absolute inset-0 opacity-40" />

      <svg viewBox="0 0 200 120" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {[0, 1, 2, 3].map((row) => (
          <motion.path
            key={row}
            d={`M -10 ${34 + row * 20} C 40 ${14 + row * 20}, 100 ${58 + row * 18}, 210 ${26 + row * 21}`}
            fill="none"
            stroke={row % 2 === 0 ? from : to}
            strokeOpacity="0.45"
            strokeWidth="0.7"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, delay: index * 0.12 + row * 0.12, ease: "easeInOut" }}
          />
        ))}
      </svg>

      <span
        className="absolute right-4 top-4 h-2 w-2 rounded-full"
        style={{ background: from, boxShadow: `0 0 14px 3px ${from}88` }}
      />
    </div>
  );
}

export function Work() {
  return (
    <section id="realisations" className="relative scroll-mt-24 py-28 sm:py-36">
      <div className="container-x">
        <SectionHeading
          eyebrow="Réalisations"
          title={
            <>
              Ce qu&apos;on livre, <span className="grad-accent">concrètement.</span>
            </>
          }
          description="Trois formats de projets représentatifs : le périmètre exact, la durée réelle et le résultat visé. Pas de vitrine floue."
        />

        <div className="mt-16 grid gap-5 lg:grid-cols-3">
          {PROJECTS.map((project, index) => (
            <Reveal key={project.title} delay={index * 0.1}>
              <article className="panel panel-hover group flex h-full flex-col p-5 sm:p-6">
                <ProjectCover from={project.hue.from} to={project.hue.to} index={index} />

                <div className="mt-6 flex items-center justify-between gap-3">
                  <span
                    className="rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]"
                    style={{
                      borderColor: `${project.hue.from}44`,
                      color: project.hue.from,
                      background: `${project.hue.from}12`,
                    }}
                  >
                    {project.tag}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-fog-faint">
                    {project.duration}
                  </span>
                </div>

                <h3 className="mt-4 text-[20px] font-semibold leading-tight">{project.title}</h3>
                <p className="mt-1.5 text-[13px] text-fog-faint">{project.context}</p>

                <ul className="mt-5 flex-1 space-y-2.5 border-t border-white/[0.07] pt-5">
                  {project.scope.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[13.5px] text-fog-dim">
                      <span
                        className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
                        style={{ background: project.hue.from }}
                      />
                      {item}
                    </li>
                  ))}
                </ul>

                <p className="mt-5 border-t border-white/[0.07] pt-4 text-[13.5px] italic leading-relaxed text-fog">
                  {project.outcome}
                </p>
              </article>
            </Reveal>
          ))}
        </div>

        {/* Commitments band */}
        <Reveal delay={0.1} className="mt-6">
          <div className="panel grid gap-px overflow-hidden bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
            {COMMITMENTS.map((item) => (
              <div key={item.label} className="bg-ink-950/80 px-6 py-8 text-center">
                <div className="font-display text-[34px] font-semibold leading-none text-white">
                  <Counter to={item.value} suffix={item.suffix} />
                </div>
                <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-fog-faint">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.15} className="mt-10">
          <button
            type="button"
            onClick={() => scrollToSection("#contact")}
            className="group inline-flex items-center gap-2 font-display text-sm font-semibold text-white"
          >
            <span className="link-underline">Décrivez-nous votre projet</span>
            <ArrowUpRight className="h-4 w-4 text-mint transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </Reveal>
      </div>
    </section>
  );
}
