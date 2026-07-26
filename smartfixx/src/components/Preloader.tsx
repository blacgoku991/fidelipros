import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogoMark } from "./ui/Logo";

const EASE = [0.76, 0, 0.24, 1] as const;
const CONTENT_FADE = 0.34;

/**
 * Intro sequence: a counter runs to 100, the content fades, then five panels
 * sweep upward to uncover the page. `onDone` fires slightly before the reveal
 * completes so the hero headline is already in motion behind the curtain.
 */
export function Preloader({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const start = performance.now();
    const total = 1500;
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / total);
      // Ease-out so the last digits settle rather than snap.
      setProgress(Math.round((1 - Math.pow(1 - t, 3)) * 100));
      if (t < 1) frame = requestAnimationFrame(tick);
      else setLeaving(true);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onDone, 700);
    return () => window.clearTimeout(timer);
  }, [leaving, onDone]);

  return (
    <>
      {/* Curtain — sits under the counter, sweeps away once it has faded. */}
      <div className="pointer-events-none fixed inset-0 z-[299] flex">
        {[0, 1, 2, 3, 4].map((index) => (
          <motion.span
            key={index}
            className="h-full flex-1 bg-ink-950"
            initial={{ y: 0 }}
            animate={leaving ? { y: "-101%" } : { y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: CONTENT_FADE + index * 0.06 }}
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
