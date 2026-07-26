import { useEffect, useState } from "react";

/** Matches a media query and stays in sync with it. */
export function useMediaQuery(query: string, defaultValue = false) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return defaultValue;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export const usePrefersReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

/** True on devices with a precise pointer — gates the custom cursor and hover-only flourishes. */
export const useFinePointer = () => useMediaQuery("(pointer: fine)", true);

export const useIsMobile = () => useMediaQuery("(max-width: 767px)");

/**
 * Rough capability probe so the WebGL scene can shed particles and post-processing
 * on machines that would otherwise drop frames.
 */
export function useLowPower() {
  const isMobile = useIsMobile();
  const reduced = usePrefersReducedMotion();
  const [weakHardware, setWeakHardware] = useState(false);

  useEffect(() => {
    const cores = navigator.hardwareConcurrency ?? 8;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    setWeakHardware(cores <= 4 || memory <= 4);
  }, []);

  return isMobile || reduced || weakHardware;
}
