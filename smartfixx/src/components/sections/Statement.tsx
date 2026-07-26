import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const LINE_ONE = "On ne livre pas des sites —";
const LINE_TWO = "on livre du temps gagné.";

/** Two oversized lines that slide past each other as the section scrolls by. */
export function Statement() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const xLeft = useTransform(scrollYProgress, [0, 1], ["6%", "-14%"]);
  const xRight = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.28, 0.72, 1], [0.25, 1, 1, 0.25]);

  return (
    <section ref={ref} className="relative overflow-hidden py-24 sm:py-32">
      <motion.div style={{ opacity }} className="space-y-1">
        <motion.p
          style={{ x: xLeft }}
          className="whitespace-nowrap font-display text-[clamp(2.2rem,8vw,6.5rem)] font-semibold leading-[1.02] tracking-tightest text-white"
        >
          {LINE_ONE}
        </motion.p>
        <motion.p
          style={{ x: xRight }}
          className="grad-text whitespace-nowrap font-display text-[clamp(2.2rem,8vw,6.5rem)] font-semibold leading-[1.02] tracking-tightest"
        >
          {LINE_TWO}
        </motion.p>
      </motion.div>

      <div className="container-x mt-14">
        <div className="grid gap-8 border-t border-white/[0.07] pt-10 sm:grid-cols-3">
          {[
            {
              title: "Le design fait vendre",
              body: "Une identité forte, une navigation évidente et des animations qui servent le propos plutôt que de le décorer.",
            },
            {
              title: "La technique tient",
              body: "Code propre, performances mesurées, documentation livrée. Un autre prestataire doit pouvoir reprendre derrière nous.",
            },
            {
              title: "Le temps se récupère",
              body: "Chaque tâche répétitive automatisée, c'est des heures rendues à votre équipe, tous les mois, sans effort.",
            },
          ].map((item) => (
            <div key={item.title}>
              <h3 className="text-[16px] font-semibold">{item.title}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-fog-dim">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
