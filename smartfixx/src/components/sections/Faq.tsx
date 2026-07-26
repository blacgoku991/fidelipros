import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { SectionHeading } from "../ui/SectionHeading";
import { Reveal } from "../ui/Reveal";
import { cn } from "@/lib/utils";

const ITEMS = [
  {
    q: "Combien de temps prend un site complet ?",
    a: "Entre 2 et 3 semaines pour un site vitrine standard, 4 à 8 semaines pour un projet sur-mesure ou une refonte e-commerce. Le rétroplanning est fixé au devis, et vous suivez l'avancement sur un lien de recette mis à jour en continu.",
  },
  {
    q: "Vous pouvez reprendre un site fait par quelqu'un d'autre ?",
    a: "Oui, c'est même une bonne partie de notre activité. On commence par un audit technique et SEO pour savoir ce qui se récupère et ce qui se refait. Vous recevez le verdict par écrit avant tout engagement.",
  },
  {
    q: "Concrètement, qu'est-ce que vous pouvez automatiser ?",
    a: "Tout échange régulier entre deux systèmes : synchroniser des données entre logiciels métiers, générer et envoyer des rapports, importer des fichiers déposés sur un serveur, créer des alertes sur des seuils, relancer des impayés, alimenter un tableau de bord. Si l'outil expose une API, un export ou une base, on sait le brancher.",
  },
  {
    q: "Et si mon logiciel n'a pas d'API ?",
    a: "Il reste presque toujours un chemin : exports planifiés, dépôts de fichiers, base de données accessible en lecture, ou automatisation de l'interface. On l'évalue pendant le cadrage et on vous dit honnêtement si c'est jouable, à quel coût, et avec quelles limites.",
  },
  {
    q: "Mes données sont sensibles. Comment vous les traitez ?",
    a: "Environnement de test d'abord, jamais de bascule sur des données réelles sans validation. Accès limités au strict nécessaire, chiffrement des échanges, journal de chaque exécution, hébergement en Europe. Un accord de traitement des données est signé quand le contexte le demande.",
  },
  {
    q: "Le site m'appartient vraiment ?",
    a: "Oui. Code, nom de domaine, hébergement, comptes : tout est à votre nom et vous en gardez les accès. Aucun abonnement n'est nécessaire pour que votre site continue de fonctionner — la maintenance est une option, pas une prise d'otage.",
  },
  {
    q: "Vous travaillez à distance ou sur site ?",
    a: "À distance par défaut, avec des points en visio réguliers. Des rendez-vous sur site sont possibles pour le cadrage et la formation des équipes, notamment sur les projets d'automatisation où il faut voir le terrain.",
  },
];

function FaqRow({ item, index }: { item: (typeof ITEMS)[number]; index: number }) {
  const [open, setOpen] = useState(index === 0);

  return (
    <div className="border-b border-white/[0.07]">
      <h3>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="group flex w-full items-center justify-between gap-6 py-6 text-left"
        >
          <span
            className={cn(
              "font-display text-[16.5px] font-medium transition-colors duration-300 sm:text-[18px]",
              open ? "text-white" : "text-fog group-hover:text-white",
            )}
          >
            {item.q}
          </span>
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
              open
                ? "border-mint/40 bg-mint/10 text-mint"
                : "border-white/10 text-fog-dim group-hover:border-white/25",
            )}
          >
            <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.3 }}>
              <Plus className="h-4 w-4" />
            </motion.span>
          </span>
        </button>
      </h3>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="max-w-3xl pb-7 pr-12 text-[14.5px] leading-relaxed text-fog-dim">
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Faq() {
  return (
    <section className="relative py-28 sm:py-36">
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading
              eyebrow="Questions"
              title={
                <>
                  Ce qu&apos;on nous demande <span className="grad-accent">le plus souvent.</span>
                </>
              }
              description="Une question qui n'est pas là ? Écrivez-la dans le formulaire, on répond sous 24 h ouvrées."
            />
          </div>

          <Reveal>
            <div className="border-t border-white/[0.07]">
              {ITEMS.map((item, index) => (
                <FaqRow key={item.q} item={item} index={index} />
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
