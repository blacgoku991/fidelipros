import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useFinePointer } from "@/hooks/useEnvironment";

type TiltCardProps = {
  children: ReactNode;
  className?: string;
  /** Max rotation in degrees on each axis. */
  intensity?: number;
  glowColor?: string;
};

/**
 * 3D-tilting glass card with a cursor-tracking spotlight and a gradient border
 * that only lights up near the pointer.
 */
export function TiltCard({
  children,
  className,
  intensity = 8,
  glowColor = "79 240 212",
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const finePointer = useFinePointer();

  const rotateX = useSpring(useMotionValue(0), { stiffness: 200, damping: 22 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 200, damping: 22 });
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);
  const glowOpacity = useSpring(useMotionValue(0), { stiffness: 180, damping: 26 });

  const spotlight = useMotionTemplate`radial-gradient(320px circle at ${glowX}% ${glowY}%, rgb(${glowColor} / 0.16), transparent 68%)`;
  const borderGlow = useMotionTemplate`radial-gradient(240px circle at ${glowX}% ${glowY}%, rgb(${glowColor} / 0.55), transparent 72%)`;

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;

    glowX.set(px * 100);
    glowY.set(py * 100);
    if (finePointer) {
      rotateY.set((px - 0.5) * intensity * 2);
      rotateX.set(-(py - 0.5) * intensity * 2);
    }
  };

  const handleLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
    glowOpacity.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={handleMove}
      onPointerEnter={() => glowOpacity.set(1)}
      onPointerLeave={handleLeave}
      style={{ rotateX, rotateY, transformPerspective: 1100 }}
      className={cn(
        "group relative rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.045] to-white/[0.012]",
        "backdrop-blur-xl transition-colors duration-500 hover:border-white/[0.16]",
        className,
      )}
    >
      {/* Border light following the cursor */}
      <motion.span
        aria-hidden
        style={{ background: borderGlow, opacity: glowOpacity }}
        className="pointer-events-none absolute -inset-px rounded-3xl [mask:linear-gradient(#000,#000)_content-box,linear-gradient(#000,#000)] [mask-composite:exclude] p-px"
      />
      {/* Interior spotlight */}
      <motion.span
        aria-hidden
        style={{ background: spotlight, opacity: glowOpacity }}
        className="pointer-events-none absolute inset-0 rounded-3xl"
      />
      <div className="relative">{children}</div>
    </motion.div>
  );
}
