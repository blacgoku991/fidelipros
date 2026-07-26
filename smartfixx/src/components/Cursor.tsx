import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useFinePointer, usePrefersReducedMotion } from "@/hooks/useEnvironment";

/**
 * Two-part cursor: a hard dot that tracks 1:1 and a soft ring that lags behind.
 * Elements can opt into a larger state with `data-cursor="grow"` or supply a
 * label with `data-cursor-label="Voir"`.
 */
export function Cursor() {
  const finePointer = useFinePointer();
  const reduced = usePrefersReducedMotion();
  const enabled = finePointer && !reduced;

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { stiffness: 320, damping: 30, mass: 0.5 });
  const ringY = useSpring(y, { stiffness: 320, damping: 30, mass: 0.5 });

  const [grow, setGrow] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const onMove = (event: PointerEvent) => {
      x.set(event.clientX);
      y.set(event.clientY);

      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        "a, button, [data-cursor], [data-cursor-label]",
      );
      setGrow(Boolean(target));
      setLabel(target?.dataset.cursorLabel ?? null);
    };

    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, [enabled, x, y]);

  useEffect(() => {
    if (!enabled) return;
    document.body.style.cursor = "none";
    return () => {
      document.body.style.cursor = "";
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <motion.div
        style={{ x, y }}
        className="pointer-events-none fixed left-0 top-0 z-[200] -ml-[3px] -mt-[3px]"
      >
        <motion.span
          className="block h-1.5 w-1.5 rounded-full bg-mint"
          animate={{ scale: pressed ? 0.5 : grow ? 0 : 1 }}
          transition={{ duration: 0.2 }}
        />
      </motion.div>

      <motion.div
        style={{ x: ringX, y: ringY }}
        className="pointer-events-none fixed left-0 top-0 z-[200] flex items-center justify-center"
      >
        <motion.span
          className="flex items-center justify-center rounded-full border border-mint/60 bg-mint/[0.07] backdrop-blur-[1px]"
          animate={{
            width: label ? 76 : grow ? 44 : 26,
            height: label ? 76 : grow ? 44 : 26,
            marginLeft: label ? -38 : grow ? -22 : -13,
            marginTop: label ? -38 : grow ? -22 : -13,
            opacity: pressed ? 0.6 : 1,
            scale: pressed ? 0.9 : 1,
          }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
        >
          {label && (
            <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-mint">
              {label}
            </span>
          )}
        </motion.span>
      </motion.div>
    </>
  );
}
