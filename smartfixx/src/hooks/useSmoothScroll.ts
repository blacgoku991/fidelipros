import { useEffect } from "react";
import Lenis from "lenis";
import { usePrefersReducedMotion } from "./useEnvironment";

let lenisInstance: Lenis | null = null;

/** Scrolls to a selector through Lenis when it is running, natively otherwise. */
export function scrollToSection(selector: string) {
  const target = document.querySelector(selector);
  if (!target) return;
  if (lenisInstance) {
    lenisInstance.scrollTo(target as HTMLElement, { offset: -12, duration: 1.4 });
  } else {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/** Installs Lenis inertial scrolling for the lifetime of the app. */
export function useSmoothScroll() {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
    });
    lenisInstance = lenis;

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      lenisInstance = null;
    };
  }, [reduced]);
}
