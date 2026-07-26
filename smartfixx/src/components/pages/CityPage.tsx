import { ArrowRight, ArrowUpRight, Check, MapPin, Train } from "lucide-react";
import { motion } from "framer-motion";
import { Reveal } from "../ui/Reveal";
import { Magnetic } from "../ui/Magnetic";
import { CITIES, citiesInHub, type City, type Hub } from "@/data/cities";
import { site } from "@/data/site";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ------------------------------------------------------------------ */
/* Page commune                                                        */
/* ------------------------------------------------------------------ */

export function CityPage({ city }: { city: City }) {
  const siblings = citiesInHub(city.hub).filter((c) => c.slug !== city.slug);

  return (
    <article className="pt-[68px]">
      <header className="relative overflow-hidden py-20 sm:py-28">
        <div className="pointer-events-none absolute -right-32 -top-24 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(139,92,255,0.12),transparent_66%)] blur-3xl" />
        <div className="pointer-events-none absolute -left-40 top-40 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(79,240,212,0.08),transparent_66%)] blur-3xl" />
        <div className="grid-lines pointer-events-none absolute inset-0 mask-fade-b opacity-40" />

        <div className="container-x relative">
          <nav aria-label="Fil d'Ariane" className="mb-7">
            <ol className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fog-faint">
              <li>
                <a href="/" className="transition-colors hover:text-mint">
                  Accueil
                </a>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <a href={city.hub} className="transition-colors hover:text-mint">
                  {city.department}
                </a>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-fog-dim">{city.name}</li>
            </ol>
          </nav>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE }}
            className="headline max-w-[24ch] text-[clamp(2.1rem,5.6vw,4rem)] leading-[1.03]"
          >
            Création de site internet à <span className="grad-text">{city.name}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.12, ease: EASE }}
            className="mt-7 max-w-2xl text-[15.5px] leading-relaxed text-fog-dim sm:text-[17px]"
          >
            SmartFixx est une agence web installée à {site.city} ({site.postalCode}) — {city.reach}.
            On conçoit des sites internet sur-mesure, on reprend l&apos;existant et on automatise
            les tâches répétitives pour les entreprises de {city.name} ({city.postalCode}), comme
            partout ailleurs en Île-de-France.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.26 }}
            className="mt-10 flex flex-wrap gap-x-10 gap-y-5 border-t border-white/[0.07] pt-7"
          >
            {[
              { value: city.postalCode, label: city.name },
              { value: "2 à 3 sem.", label: "Site vitrine livré" },
              { value: "1 490 €", label: "À partir de, HT" },
            ].map((fact) => (
              <div key={fact.label} className="flex flex-col gap-1">
                <div className="font-display text-xl font-semibold text-white sm:text-2xl">
                  {fact.value}
                </div>
                <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-fog-faint">
                  {fact.label}
                </div>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.34, ease: EASE }}
            className="mt-9 flex flex-wrap items-center gap-3.5"
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

      <div className="container-x pb-8">
        <div className="mx-auto max-w-3xl space-y-16">
          <Reveal>
            <section>
              <h2 className="headline text-[clamp(1.45rem,3.4vw,2.05rem)] leading-tight">
                Le tissu économique de {city.name}
              </h2>
              <p className="mt-5 text-[15.5px] leading-[1.75] text-fog-dim">{city.fabric}</p>
              <ul className="mt-7 grid gap-3 border-t border-white/[0.07] pt-7 sm:grid-cols-2">
                {city.clients.map((client) => (
                  <li key={client} className="flex items-start gap-3 text-[15px] text-fog">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-mint" />
                    {client}
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>

          <Reveal>
            <section>
              <h2 className="headline text-[clamp(1.45rem,3.4vw,2.05rem)] leading-tight">
                Être trouvé à {city.name}, concrètement
              </h2>
              <p className="mt-5 text-[15.5px] leading-[1.75] text-fog-dim">{city.searchAngle}</p>
              <p className="mt-4 text-[15.5px] leading-[1.75] text-fog-dim">{city.opportunity}</p>
            </section>
          </Reveal>

          <Reveal>
            <section>
              <h2 className="headline text-[clamp(1.45rem,3.4vw,2.05rem)] leading-tight">
                Se rencontrer à {city.name}
              </h2>
              <div className="mt-6 space-y-3">
                <div className="panel flex items-start gap-3.5 p-4">
                  <MapPin className="mt-0.5 h-[18px] w-[18px] shrink-0 text-mint" />
                  <p className="text-[14.5px] leading-relaxed text-fog-dim">
                    Bureaux à {site.city} — {city.reach}. Cadrage sur place possible.
                  </p>
                </div>
                <div className="panel flex items-start gap-3.5 p-4">
                  <Train className="mt-0.5 h-[18px] w-[18px] shrink-0 text-violet-400" />
                  <p className="text-[14.5px] leading-relaxed text-fog-dim">
                    Accès : {city.transport}.
                  </p>
                </div>
              </div>
              <p className="mt-6 text-[15.5px] leading-[1.75] text-fog-dim">
                Nous couvrons aussi les communes limitrophes : {city.neighbours.join(", ")}.
              </p>
            </section>
          </Reveal>

          <Reveal>
            <section>
              <h2 className="headline text-[clamp(1.45rem,3.4vw,2.05rem)] leading-tight">
                {city.faq.q}
              </h2>
              <p className="mt-5 text-[15.5px] leading-[1.75] text-fog-dim">{city.faq.a}</p>
              <p className="mt-6 text-[14.5px] leading-relaxed text-fog-faint">
                Tarifs de départ : 1 490 € HT pour un site vitrine, 3 900 € HT en sur-mesure, 890 €
                HT par automatisation.{" "}
                <a href="/#tarifs" className="text-mint hover:underline">
                  Voir le détail des formules
                </a>
                .
              </p>
            </section>
          </Reveal>
        </div>
      </div>

      <div className="container-x py-20 sm:py-28">
        <Reveal>
          <div className="panel mx-auto max-w-3xl p-8 sm:p-10">
            <h2 className="headline text-[clamp(1.45rem,3.4vw,2.05rem)] leading-tight">
              Un projet à {city.name} ?
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-fog-dim">
              Décrivez votre besoin en quelques lignes. On répond sous 24 h ouvrées, et le premier
              échange ne coûte rien.
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
              Nous intervenons aussi à
            </h2>
            <ul className="mt-5 grid gap-x-8 border-y border-white/[0.07] py-2 sm:grid-cols-2">
              {siblings.map((sibling) => (
                <li key={sibling.slug} className="border-b border-white/[0.05] last:border-0">
                  <a
                    href={`/creation-site-internet-${sibling.slug}`}
                    className="group flex items-center justify-between gap-4 py-3.5 text-[15px] text-fog transition-colors hover:text-white"
                  >
                    {sibling.name}
                    <ArrowRight className="h-4 w-4 shrink-0 text-fog-faint transition-all duration-300 group-hover:translate-x-1 group-hover:text-mint" />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-7 text-[14px] leading-relaxed text-fog-dim">
              Cette liste n&apos;est pas limitative : nous travaillons dans toute
              l&apos;Île-de-France, et à distance partout en France.{" "}
              <a href={city.hub} className="text-mint hover:underline">
                Voir le {city.departmentCode}
              </a>{" "}
              ou{" "}
              <a href="/zones-desservies" className="text-mint hover:underline">
                nos zones d&apos;intervention
              </a>
              .
            </p>
          </div>
        </Reveal>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Page département                                                    */
/* ------------------------------------------------------------------ */

export function HubPage({ hub }: { hub: Hub }) {
  const cities = citiesInHub(hub.slug);

  return (
    <article className="pt-[68px]">
      <header className="relative overflow-hidden py-20 sm:py-28">
        <div className="pointer-events-none absolute -right-32 -top-24 h-[540px] w-[540px] rounded-full bg-[radial-gradient(circle,rgba(79,240,212,0.10),transparent_66%)] blur-3xl" />
        <div className="grid-lines pointer-events-none absolute inset-0 mask-fade-b opacity-40" />

        <div className="container-x relative">
          <nav aria-label="Fil d'Ariane" className="mb-7">
            <ol className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fog-faint">
              <li>
                <a href="/" className="transition-colors hover:text-mint">
                  Accueil
                </a>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-fog-dim">
                {hub.name} ({hub.code})
              </li>
            </ol>
          </nav>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE }}
            className="headline max-w-[22ch] text-[clamp(2.1rem,5.6vw,4rem)] leading-[1.03]"
          >
            Agence web dans{hub.name === "Paris" ? " " : " les "}
            <span className="grad-text">
              {hub.name} ({hub.code})
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.12, ease: EASE }}
            className="mt-7 max-w-2xl text-[15.5px] leading-relaxed text-fog-dim sm:text-[17px]"
          >
            {hub.intro}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.28, ease: EASE }}
            className="mt-9 flex flex-wrap items-center gap-3.5"
          >
            <Magnetic strength={0.22}>
              <a href="/#contact" className="btn-primary group">
                Demander un devis
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            </Magnetic>
          </motion.div>
        </div>
      </header>

      <div className="container-x pb-8">
        <div className="mx-auto max-w-3xl space-y-16">
          <Reveal>
            <section>
              <h2 className="headline text-[clamp(1.45rem,3.4vw,2.05rem)] leading-tight">
                Ce qui distingue {hub.name === "Paris" ? "Paris" : `le ${hub.code}`}
              </h2>
              <p className="mt-5 text-[15.5px] leading-[1.75] text-fog-dim">{hub.angle}</p>
            </section>
          </Reveal>

          {cities.length > 0 && (
            <Reveal>
              <section>
                <h2 className="headline text-[clamp(1.45rem,3.4vw,2.05rem)] leading-tight">
                  Communes couvertes
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-fog-dim">
                  Chaque commune a sa page, avec le tissu économique local et la façon dont les
                  recherches s&apos;y comportent réellement.
                </p>
                <ul className="mt-7 grid gap-x-8 border-t border-white/[0.07] pt-2 sm:grid-cols-2">
                  {cities.map((city) => (
                    <li key={city.slug} className="border-b border-white/[0.05]">
                      <a
                        href={`/creation-site-internet-${city.slug}`}
                        className="group flex items-center justify-between gap-4 py-3.5 text-[15px] text-fog transition-colors hover:text-white"
                      >
                        <span>
                          {city.name}
                          <span className="ml-2 font-mono text-[11px] text-fog-faint">
                            {city.postalCode}
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-fog-faint transition-all duration-300 group-hover:translate-x-1 group-hover:text-mint" />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          )}

          <Reveal>
            <section>
              <h2 className="headline text-[clamp(1.45rem,3.4vw,2.05rem)] leading-tight">
                Nos prestations
              </h2>
              <ul className="mt-6 divide-y divide-white/[0.07] border-y border-white/[0.07]">
                {[
                  {
                    label: "Création de site internet",
                    href: "/creation-site-internet-ile-de-france",
                  },
                  { label: "Refonte sans perte de référencement", href: "/refonte-site-internet" },
                  {
                    label: "Automatisation et interconnexion de logiciels",
                    href: "/automatisation-informatique",
                  },
                ].map((item) => (
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
            </section>
          </Reveal>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Index des zones                                                     */
/* ------------------------------------------------------------------ */

export function ZonesPage({ hubs }: { hubs: Hub[] }) {
  return (
    <article className="pt-[68px]">
      <div className="container-x py-20 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <nav aria-label="Fil d'Ariane" className="mb-7">
              <ol className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fog-faint">
                <li>
                  <a href="/" className="transition-colors hover:text-mint">
                    Accueil
                  </a>
                </li>
                <li aria-hidden="true">/</li>
                <li className="text-fog-dim">Zones desservies</li>
              </ol>
            </nav>

            <h1 className="headline text-[clamp(2rem,5vw,3.2rem)] leading-[1.05]">
              Où nous intervenons en <span className="grad-text">Île-de-France</span>
            </h1>
            <p className="mt-6 text-[15.5px] leading-[1.75] text-fog-dim">
              Nos bureaux sont à {site.city} ({site.postalCode}) et nous intervenons dans toute
              l&apos;Île-de-France. Les communes détaillées ci-dessous sont celles où nous nous
              déplaçons le plus souvent — la liste n&apos;a rien de limitatif. Partout ailleurs en
              France, nous travaillons à distance, avec des points en visio réguliers.
            </p>
          </Reveal>

          <div className="mt-14 space-y-12">
            {hubs.map((hub) => {
              const cities = citiesInHub(hub.slug);
              return (
                <Reveal key={hub.slug}>
                  <section>
                    <h2 className="headline text-[clamp(1.3rem,3vw,1.7rem)] leading-tight">
                      <a href={hub.slug} className="hover:text-mint">
                        {hub.name} ({hub.code})
                      </a>
                    </h2>
                    {cities.length > 0 ? (
                      <ul className="mt-4 grid gap-x-8 border-t border-white/[0.07] pt-2 sm:grid-cols-2">
                        {cities.map((city) => (
                          <li key={city.slug} className="border-b border-white/[0.05]">
                            <a
                              href={`/creation-site-internet-${city.slug}`}
                              className="group flex items-center justify-between gap-4 py-3 text-[15px] text-fog transition-colors hover:text-white"
                            >
                              <span>
                                {city.name}
                                <span className="ml-2 font-mono text-[11px] text-fog-faint">
                                  {city.postalCode}
                                </span>
                              </span>
                              <ArrowRight className="h-4 w-4 shrink-0 text-fog-faint transition-all duration-300 group-hover:translate-x-1 group-hover:text-mint" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-[15px] leading-relaxed text-fog-dim">
                        Interventions par arrondissement — voir la page {hub.name}.
                      </p>
                    )}
                  </section>
                </Reveal>
              );
            })}
          </div>

          <Reveal>
            <p className="mt-14 text-[14px] text-fog-dim">
              Votre commune n&apos;est pas listée ?{" "}
              <a href="/#contact" className="text-mint hover:underline">
                Écrivez-nous
              </a>{" "}
              — on couvre toute l&apos;Île-de-France, et {CITIES.length} communes ont déjà leur
              page.
            </p>
          </Reveal>
        </div>
      </div>
    </article>
  );
}
