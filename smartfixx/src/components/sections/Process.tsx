import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { SectionHeading } from "../ui/SectionHeading";
import { Reveal } from "../ui/Reveal";

const STEPS = [
  {
    n: "01",
    title: "Cadrage",
    duration: "30 min",
    body: "Un appel, sans jargon. On regarde vos outils, vos irritants du quotidien et ce que vous voulez vraiment obtenir. On vous dit franchement si le projet tient debout.",
    deliverable: "Compte-rendu écrit",
  },
  {
    n: "02",
    title: "Proposition",
    duration: "3 jours",
    body: "Périmètre détaillé, planning, prix ferme. Ce qui est inclus, ce qui ne l'est pas, et les options que vous pourrez déclencher plus tard.",
    deliverable: "Devis + rétroplanning",
  },
  {
    n: "03",
    title: "Design & prototype",
    duration: "1 à 2 semaines",
    body: "Maquettes cliquables avant la moindre ligne de code. Vous naviguez dans le futur site, vous commentez, on ajuste jusqu'à ce que ce soit juste.",
    deliverable: "Prototype interactif",
  },
  {
    n: "04",
    title: "Développement",
    duration: "2 à 6 semaines",
    body: "Itérations courtes avec un lien de recette toujours à jour. Pour l'automatisation, on branche d'abord un environnement de test : rien ne touche vos données réelles avant validation.",
    deliverable: "Environnement de recette",
  },
  {
    n: "05",
    title: "Mise en ligne & suivi",
    duration: "En continu",
    body: "Bascule surveillée, formation de vos équipes, documentation. Puis supervision des automatisations et évolutions au fil de l'eau.",
    deliverable: "Formation + supervision",
  },
];

export function Process() {
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start 65%", "end 65%"],
  });
  const lineScale = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });
  const lineOpacity = useTransform(scrollYProgress, [0, 0.02], [0, 1]);

  return (
    <section id="methode" className="relative scroll-mt-24 py-28 sm:py-36">
      <div className="container-x">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
          {/* Sticky intro */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading
              eyebrow="Méthode"
              title={
                <>
                  Cinq étapes, <span className="grad-accent">zéro zone d&apos;ombre.</span>
                </>
              }
              description="Vous savez à chaque instant où en est le projet, ce qui arrive ensuite et ce que ça coûte. C'est le minimum, et pourtant c'est rare."
            />

            <Reveal delay={0.2} className="mt-9">
              <div className="panel p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-fog-faint">
                  Engagement
                </p>
                <p className="mt-3 text-[14.5px] leading-relaxed text-fog">
                  Un interlocuteur unique du premier appel à la mise en ligne. Réponse sous 24 h
                  ouvrées, code et accès qui vous appartiennent.
                </p>
              </div>
            </Reveal>
          </div>

          {/* Steps */}
          <div ref={trackRef} className="relative">
            <div className="absolute left-[19px] top-2 h-[calc(100%-1rem)] w-px bg-white/[0.08]" />
            <motion.div
              className="absolute left-[19px] top-2 h-[calc(100%-1rem)] w-px origin-top bg-gradient-to-b from-mint via-violet to-coral"
              style={{ scaleY: lineScale, opacity: lineOpacity }}
            />

            <ol className="space-y-10">
              {STEPS.map((step, index) => (
                <li key={step.n}>
                  <motion.div
                    className="grid grid-cols-[40px_1fr] gap-5"
                    initial={{ opacity: 0, y: 26 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-18% 0px -12% 0px" }}
                    transition={{ duration: 0.7, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-ink-900 font-mono text-[11px] text-mint">
                      {step.n}
                    </span>

                    <div className="pt-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3 className="text-[21px] font-semibold leading-tight">{step.title}</h3>
                        <span className="rounded-full border border-white/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-fog-faint">
                          {step.duration}
                        </span>
                      </div>
                      <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-fog-dim">
                        {step.body}
                      </p>
                      <p className="mt-3 inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-fog-faint">
                        <span className="h-px w-5 bg-mint/60" />
                        Livrable : {step.deliverable}
                      </p>
                    </div>
                  </motion.div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
