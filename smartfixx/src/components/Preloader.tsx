import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogoMark } from "./ui/Logo";
import { usePrefersReducedMotion } from "@/hooks/useEnvironment";

const EASE = [0.76, 0, 0.24, 1] as const;
const CONTENT_FADE = 0.34;
const COUNT_DURATION = 1000;
const SEEN_KEY = "smartfixx:intro-seen";

/** Retire le voile statique posé dans index.html. */
function dismissBootVeil() {
  document.getElementById("boot")?.classList.add("is-gone");
}

/** L'intro ne se joue qu'une fois par session : les visites suivantes sont immédiates. */
function shouldSkipIntro() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // Stockage indisponible (navigation privée stricte) : on joue l'intro.
    return false;
  }
}

function markIntroSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* sans conséquence */
  }
}

/**
 * Intro : un compteur monte à 100, le contenu s'efface, puis cinq panneaux
 * remontent pour découvrir la page. `onDone` part un peu avant la fin du
 * dévoilement pour que le titre soit déjà en mouvement derrière le rideau.
 */
export function Preloader({ onDone }: { onDone: () => void }) {
  const reduced = usePrefersReducedMotion();
  const [skipped] = useState(() => shouldSkipIntro() || reduced);
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);

  // Intro déjà vue, ou animations refusées : on découvre la page tout de suite.
  useEffect(() => {
    if (!skipped) return;
    dismissBootVeil();
    onDone();
  }, [skipped, onDone]);

  useEffect(() => {
    if (skipped) return;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_DURATION);
      // Ease-out : les derniers chiffres se posent au lieu de claquer.
      setProgress(Math.round((1 - Math.pow(1 - t, 3)) * 100));
      if (t < 1) frame = requestAnimationFrame(tick);
      else setLeaving(true);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [skipped]);

  useEffect(() => {
    if (!leaving) return;
    // Le voile statique part avec le rideau, pas avant : sinon il réapparaîtrait.
    dismissBootVeil();
    markIntroSeen();
    const timer = window.setTimeout(onDone, 620);
    return () => window.clearTimeout(timer);
  }, [leaving, onDone]);

  if (skipped) return null;

  return (
    <>
      {/* Rideau — sous le compteur, il se retire dès que celui-ci s'est effacé. */}
      <div className="pointer-events-none fixed inset-0 z-[299] flex">
        {[0, 1, 2, 3, 4].map((index) => (
          <motion.span
            key={index}
            className="h-full flex-1 bg-ink-950"
            initial={{ y: 0 }}
            animate={leaving ? { y: "-101%" } : { y: 0 }}
            transition={{ duration: 0.85, ease: EASE, delay: CONTENT_FADE + index * 0.055 }}
          />
        ))}
      </div>

      <AnimatePresence>
        {!leaving && (
          <motion.div
            key="preloader"
            className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-ink-950"
            exit={{ opacity: 0 }}
            transition={{ duration: CONTENT_FADE, ease: "easeOut" }}
          >
            <div className="flex flex-col items-center gap-7">
              <LogoMark className="h-14 w-14" />

              <div className="flex items-baseline gap-1 font-display text-white">
                <span className="text-5xl font-semibold tabular-nums tracking-tightest">
                  {String(progress).padStart(3, "0")}
                </span>
                <span className="text-lg text-mint">%</span>
              </div>

              <div className="h-px w-56 overflow-hidden bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-mint to-violet"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-fog-faint">
                Initialisation de l&apos;expérience
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
