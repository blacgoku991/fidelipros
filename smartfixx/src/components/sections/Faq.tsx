import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { SectionHeading } from "../ui/SectionHeading";
import { Reveal } from "../ui/Reveal";
import { cn } from "@/lib/utils";
import { FAQ_ITEMS } from "@/data/faq";
import { renderMode } from "@/lib/renderMode";

const ITEMS = FAQ_ITEMS;

function FaqRow({ item, index }: { item: (typeof ITEMS)[number]; index: number }) {
  // Au pré-rendu, tout est déplié pour que les réponses soient dans le HTML livré.
  const [open, setOpen] = useState(index === 0 || renderMode.prerender);

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
