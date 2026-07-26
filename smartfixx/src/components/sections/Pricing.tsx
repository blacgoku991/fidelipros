import { Check, Minus } from "lucide-react";
import { SectionHeading } from "../ui/SectionHeading";
import { Reveal } from "../ui/Reveal";
import { TiltCard } from "../ui/TiltCard";
import { Magnetic } from "../ui/Magnetic";
import { scrollToSection } from "@/hooks/useSmoothScroll";
import { cn } from "@/lib/utils";

/*
 * Tarifs indicatifs de départ — ajustez les montants à votre grille réelle.
 * Ils servent surtout à filtrer les demandes hors budget avant le premier appel.
 */
const PLANS = [
  {
    name: "Essentiel",
    price: "1 490 €",
    prefix: "à partir de",
    pitch: "Une présence en ligne propre et rapide, livrée en deux à trois semaines.",
    features: [
      "Jusqu'à 5 pages",
      "Design personnalisé (base de composants)",
      "Responsive et accessible",
      "Formulaire de contact",
      "SEO de base + mise en ligne",
    ],
    excluded: ["Animations avancées", "Automatisations"],
    highlighted: false,
  },
  {
    name: "Signature",
    price: "3 900 €",
    prefix: "à partir de",
    pitch:
      "Le site qui vous démarque : direction artistique dédiée, animations, contenu travaillé.",
    features: [
      "Pages illimitées + blog",
      "Direction artistique sur-mesure",
      "Animations et effets 3D",
      "Rédaction et structuration du contenu",
      "SEO technique complet",
      "Back-office autonome",
      "3 mois de suivi inclus",
    ],
    excluded: [],
    highlighted: true,
  },
  {
    name: "Automatisation",
    price: "890 €",
    prefix: "par connecteur, à partir de",
    pitch: "On relie vos logiciels métiers et on supprime les tâches répétitives.",
    features: [
      "Cartographie des données",
      "Connecteur entre deux outils",
      "Synchronisation planifiée",
      "Contrôles, journaux et alertes",
      "Environnement de test avant bascule",
      "Documentation et transfert",
    ],
    excluded: [],
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="tarifs" className="relative scroll-mt-24 overflow-hidden py-28 sm:py-36">
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-[500px] w-[760px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(79,240,212,0.07),transparent_66%)] blur-3xl" />

      <div className="container-x relative">
        <SectionHeading
          align="center"
          eyebrow="Tarifs"
          title={
            <>
              Des prix annoncés, <span className="grad-accent">pas devinés.</span>
            </>
          }
          description="Points de départ indicatifs. Le devis final dépend du périmètre réel — il est ferme, détaillé, et il ne bouge plus une fois signé."
          className="mx-auto"
        />

        <div className="mt-16 grid items-start gap-5 lg:grid-cols-3">
          {PLANS.map((plan, index) => (
            <Reveal key={plan.name} delay={index * 0.1}>
              {/* Badge lives outside the card so it can sit on its top edge. */}
              <div className={cn("relative h-full", plan.highlighted && "lg:-mt-4")}>
                {plan.highlighted && (
                  <span className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-mint to-violet px-3.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-950">
                    Le plus demandé
                  </span>
                )}
                <TiltCard
                  intensity={5}
                  glowColor={plan.highlighted ? "139 92 255" : "79 240 212"}
                  className={cn(
                    "h-full p-6 sm:p-7",
                    plan.highlighted && "border-violet/30 bg-violet/[0.05] lg:pb-10 lg:pt-9",
                  )}
                >
                  <h3 className="font-display text-lg font-semibold text-white">{plan.name}</h3>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fog-faint">
                    {plan.prefix}
                  </p>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-display text-[40px] font-semibold leading-none tracking-tightest text-white">
                      {plan.price}
                    </span>
                    <span className="text-[12px] text-fog-faint">HT</span>
                  </div>

                  <p className="mt-4 min-h-[42px] text-[14px] leading-relaxed text-fog-dim">
                    {plan.pitch}
                  </p>

                  <ul className="mt-6 space-y-2.5 border-t border-white/[0.07] pt-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-[13.5px] text-fog">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint" />
                        {feature}
                      </li>
                    ))}
                    {plan.excluded.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-[13.5px] text-fog-faint"
                      >
                        <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Magnetic strength={0.18} className="mt-7">
                    <button
                      type="button"
                      onClick={() => scrollToSection("#contact")}
                      className={cn("w-full", plan.highlighted ? "btn-primary" : "btn-ghost")}
                    >
                      Demander un devis
                    </button>
                  </Magnetic>
                </TiltCard>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.15}>
          <p className="mt-10 text-center text-[13px] text-fog-faint">
            Maintenance à partir de 79 €/mois · Paiement en 2 ou 3 fois possible · Aucun abonnement
            obligatoire pour conserver votre site.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
