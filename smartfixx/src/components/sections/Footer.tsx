import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { LogoMark } from "../ui/Logo";
import { scrollToSection } from "@/hooks/useSmoothScroll";
import { site } from "@/data/site";

/* Le pied de page porte le maillage interne : c'est lui qui relie chaque page
   locale au reste du site sur toutes les pages. */
const COLUMNS = [
  {
    title: "Prestations",
    links: [
      { label: "Création de site internet", href: "/creation-site-internet-asnieres-sur-seine" },
      { label: "Refonte de site internet", href: "/refonte-site-internet" },
      { label: "Automatisation informatique", href: "/automatisation-informatique" },
      { label: "Tarifs", href: "/#tarifs" },
    ],
  },
  {
    title: "Zones desservies",
    links: [
      { label: "Asnières-sur-Seine (92600)", href: "/creation-site-internet-asnieres-sur-seine" },
      { label: "Hauts-de-Seine", href: "/creation-site-internet-ile-de-france" },
      { label: "Île-de-France", href: "/creation-site-internet-ile-de-france" },
      { label: "Contact", href: "/#contact" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-white/[0.07] pt-20">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-[radial-gradient(ellipse_at_bottom,rgba(79,240,212,0.10),transparent_66%)]" />

      <div className="container-x relative">
        <div className="grid gap-12 pb-16 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.7fr))_minmax(0,1fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <LogoMark />
              <span className="font-display text-[19px] font-semibold tracking-tight text-white">
                Smart<span className="grad-accent">Fixx</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-fog-dim">
              Agence web à {site.city} ({site.postalCode}). On conçoit des sites qui marquent, on
              reprend ceux qui patinent et on automatise tout ce qui vous fait perdre du temps.
            </p>
            <p className="mt-4 text-[13.5px] leading-relaxed text-fog-faint">
              {site.city} · {site.region}
              <br />
              {site.responseTime}
            </p>
            <a
              href={`mailto:${site.email}`}
              className="mt-5 inline-block font-display text-[15px] font-medium text-white link-underline"
            >
              {site.email}
            </a>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title}>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog-faint">
                {column.title}
              </h3>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.label}`}>
                    <a
                      href={link.href}
                      className="text-[14px] text-fog-dim transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog-faint">
              Suivre
            </h3>
            <ul className="mt-5 space-y-3">
              {site.social.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[14px] text-fog-dim transition-colors hover:text-white"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => scrollToSection("#top")}
              className="mt-8 flex items-center gap-2 rounded-full border border-white/10 px-4 py-2.5 font-display text-[12.5px] font-medium text-fog transition-colors hover:border-mint/40 hover:text-mint"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              Haut de page
            </button>
          </div>
        </div>

        {/* Oversized wordmark */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-5% 0px" }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="select-none pt-4"
          aria-hidden="true"
        >
          <span className="block bg-gradient-to-b from-white/[0.13] to-white/0 bg-clip-text text-center font-display text-[clamp(3.5rem,17vw,14rem)] font-bold leading-[0.85] tracking-tightest text-transparent">
            SMARTFIXX
          </span>
        </motion.div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/[0.07] py-7 text-center sm:flex-row sm:text-left">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-fog-faint">
            © {year} {site.legal.company} — Tous droits réservés
          </p>
          <p className="flex flex-wrap justify-center gap-x-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-fog-faint">
            <a href="/mentions-legales" className="transition-colors hover:text-fog">
              Mentions légales
            </a>
            <span aria-hidden="true">·</span>
            <a href="/politique-de-confidentialite" className="transition-colors hover:text-fog">
              Confidentialité
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
