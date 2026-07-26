import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import { Reveal } from "../ui/Reveal";
import { Magnetic } from "../ui/Magnetic";
import type { Landing } from "@/data/landings";
import { site } from "@/data/site";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Gabarit des pages d'atterrissage. La mise en page est partagée, le contenu
 * vient entièrement de `landings.ts` — c'est le texte qui doit être unique par
 * page, pas la structure.
 */
export function LandingPage({ landing }: { landing: Landing }) {
  return (
    <>
      <article className="pt-[68px]">
        {/* En-tête */}
        <header className="relative overflow-hidden py-20 sm:py-28">
          <div className="pointer-events-none absolute -right-32 -top-24 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(139,92,255,0.13),transparent_66%)] blur-3xl" />
          <div className="pointer-events-none absolute -left-40 top-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(79,240,212,0.09),transparent_66%)] blur-3xl" />
          <div className="grid-lines pointer-events-none absolute inset-0 mask-fade-b opacity-40" />

          <div className="container-x relative">
            {/* Fil d'Ariane — repris en données structurées côté <Seo />. */}
            <nav aria-label="Fil d'Ariane" className="mb-7">
              <ol className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fog-faint">
                <li>
                  <a href="/" className="transition-colors hover:text-mint">
                    Accueil
                  </a>
                </li>
                <li aria-hidden="true">/</li>
                <li className="text-fog-dim">{landing.eyebrow}</li>
              </ol>
            </nav>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE }}
              className="headline max-w-[22ch] text-[clamp(2.2rem,6vw,4.2rem)] leading-[1.02]"
            >
              {landing.h1} <span className="grad-text">{landing.h1Accent}</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.12, ease: EASE }}
              className="mt-7 max-w-2xl text-[15.5px] leading-relaxed text-fog-dim sm:text-[17px]"
            >
              {landing.intro}
            </motion.p>

            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.28 }}
              className="mt-11 grid grid-cols-3 gap-x-4 border-t border-white/[0.07] pt-7 sm:flex sm:flex-wrap sm:gap-x-12"
            >
              {landing.facts.map((fact) => (
                <div key={fact.label} className="flex flex-col gap-1">
                  <dt className="font-display text-lg font-semibold text-white sm:text-2xl">
                    {fact.value}
                  </dt>
                  <dd className="font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-fog-faint sm:text-[10.5px] sm:tracking-[0.16em]">
                    {fact.label}
                  </dd>
                </div>
              ))}
            </motion.dl>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.36, ease: EASE }}
              className="mt-10 flex flex-wrap items-center gap-3.5"
            >
              <Magnetic strength={0.22}>
                <a href="/#contact" className="btn-primary group">
                  Demander un devis
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </Magnetic>
              <a href="/#tarifs" className="btn-ghost">
                Voir les tarifs
              </a>
            </motion.div>
          </div>
        </header>

        {/* Corps */}
        <div className="container-x pb-8">
          <div className="mx-auto max-w-3xl space-y-16">
            {landing.blocks.map((block) => (
              <Reveal key={block.h2}>
                <section>
                  <h2 className="headline text-[clamp(1.5rem,3.6vw,2.15rem)] leading-tight">
                    {block.h2}
                  </h2>
                  <div className="mt-5 space-y-4">
                    {block.paragraphs.map((paragraph) => (
                      <p
                        key={paragraph.slice(0, 40)}
                        className="text-[15.5px] leading-[1.75] text-fog-dim"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  {block.bullets && (
                    <ul className="mt-7 space-y-3 border-t border-white/[0.07] pt-7">
                      {block.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-3 text-[15px] text-fog">
                          <Check className="mt-1 h-4 w-4 shrink-0 text-mint" />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Appel à l'action + maillage interne */}
        <div className="container-x py-20 sm:py-28">
          <Reveal>
            <div className="panel mx-auto max-w-3xl overflow-hidden p-8 sm:p-10">
              <h2 className="headline text-[clamp(1.5rem,3.6vw,2.15rem)] leading-tight">
                {landing.ctaTitle}
              </h2>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-fog-dim">
                {landing.ctaBody}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3.5">
                <a href="/#contact" className="btn-primary group">
                  Décrire mon projet
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
                <a
                  href={`mailto:${site.email}`}
                  className="font-display text-sm font-semibold text-white"
                >
                  <span className="link-underline">{site.email}</span>
                </a>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mx-auto mt-14 max-w-3xl">
              <h2 className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-fog-faint">
                À lire aussi
              </h2>
              <ul className="mt-5 divide-y divide-white/[0.07] border-y border-white/[0.07]">
                {landing.related.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="group flex items-center justify-between gap-4 py-4 font-display text-[16px] font-medium text-fog transition-colors hover:text-white"
                    >
                      {item.label}
                      <ArrowRight className="h-4 w-4 shrink-0 text-fog-faint transition-all duration-300 group-hover:translate-x-1 group-hover:text-mint" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </article>
    </>
  );
}
