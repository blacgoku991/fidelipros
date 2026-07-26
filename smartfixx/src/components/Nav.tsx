import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Logo } from "./ui/Logo";
import { Magnetic } from "./ui/Magnetic";
import { scrollToSection } from "@/hooks/useSmoothScroll";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Services", href: "#services" },
  { label: "Automatisation", href: "#automatisation" },
  { label: "Méthode", href: "#methode" },
  { label: "Réalisations", href: "#realisations" },
  { label: "Tarifs", href: "#tarifs" },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export function Nav() {
  const [condensed, setCondensed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>("");
  const { scrollY, scrollYProgress } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => setCondensed(latest > 40));

  // Highlight the section currently occupying the upper third of the viewport.
  useEffect(() => {
    const sections = LINKS.map((link) => document.querySelector(link.href)).filter(
      (el): el is Element => Boolean(el),
    );
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(`#${entry.target.id}`);
        });
      },
      { rootMargin: "-25% 0px -65% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const go = (href: string) => {
    setMenuOpen(false);
    // Let the drawer close before Lenis takes over the scroll.
    window.setTimeout(() => scrollToSection(href), menuOpen ? 260 : 0);
  };

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
        className="fixed inset-x-0 top-0 z-[120]"
      >
        <div
          className={cn(
            "transition-all duration-500",
            condensed
              ? "border-b border-white/[0.07] bg-ink-950/70 backdrop-blur-xl"
              : "border-b border-transparent",
          )}
        >
          <nav className="container-x flex h-[68px] items-center justify-between gap-4">
            <a
              href="#top"
              onClick={(event) => {
                event.preventDefault();
                go("#top");
              }}
              className="shrink-0"
              aria-label="SmartFixx — accueil"
            >
              <Logo />
            </a>

            <div className="hidden items-center gap-1 lg:flex">
              {LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(event) => {
                    event.preventDefault();
                    go(link.href);
                  }}
                  className={cn(
                    "relative rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors duration-300",
                    activeId === link.href ? "text-white" : "text-fog-dim hover:text-white",
                  )}
                >
                  {activeId === link.href && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 -z-10 rounded-full border border-white/10 bg-white/[0.06]"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  {link.label}
                </a>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Magnetic strength={0.22} className="hidden sm:block">
                <a
                  href="#contact"
                  onClick={(event) => {
                    event.preventDefault();
                    go("#contact");
                  }}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/[0.08] px-5 py-2.5 font-display text-[13px] font-semibold text-mint transition-colors duration-300 hover:border-mint/60 hover:bg-mint/[0.14]"
                >
                  Démarrer un projet
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </Magnetic>

              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white lg:hidden"
                aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
                aria-expanded={menuOpen}
              >
                {menuOpen ? (
                  <X className="h-[18px] w-[18px]" />
                ) : (
                  <Menu className="h-[18px] w-[18px]" />
                )}
              </button>
            </div>
          </nav>
        </div>

        {/* Reading progress */}
        <motion.div
          className="h-px origin-left bg-gradient-to-r from-mint via-violet to-coral"
          style={{ scaleX: scrollYProgress }}
        />
      </motion.header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-[110] bg-ink-950/96 backdrop-blur-2xl lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="container-x flex h-full flex-col justify-center gap-2 pt-20">
              {[...LINKS, { label: "Contact", href: "#contact" }].map((link, index) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={(event) => {
                    event.preventDefault();
                    go(link.href);
                  }}
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.5, delay: 0.06 + index * 0.06, ease: EASE }}
                  className="flex items-baseline justify-between border-b border-white/[0.07] py-5 font-display text-[clamp(2rem,9vw,2.8rem)] font-semibold tracking-tightest text-white"
                >
                  {link.label}
                  <span className="font-mono text-xs text-fog-faint">0{index + 1}</span>
                </motion.a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
