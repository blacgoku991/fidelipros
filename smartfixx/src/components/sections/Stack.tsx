import { Marquee } from "../ui/Marquee";
import { Reveal } from "../ui/Reveal";

const ROW_A = [
  "React",
  "TypeScript",
  "Next.js",
  "Node.js",
  "Python",
  "PostgreSQL",
  "Supabase",
  "Tailwind CSS",
  "Three.js / WebGL",
  "GraphQL",
];

const ROW_B = [
  "WordPress",
  "Shopify",
  "n8n",
  "Make",
  "Power Automate",
  "REST & Webhooks",
  "Docker",
  "Stripe",
  "Playwright",
  "GitHub Actions",
];

function Pill({ label }: { label: string }) {
  return (
    <span className="mx-2 flex items-center gap-2.5 whitespace-nowrap rounded-full border border-white/[0.08] bg-white/[0.025] px-5 py-2.5 font-display text-[13.5px] font-medium text-fog transition-colors duration-300 hover:border-mint/30 hover:text-white">
      <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-mint to-violet" />
      {label}
    </span>
  );
}

export function Stack() {
  return (
    <section className="relative border-y border-white/[0.06] bg-ink-900/40 py-16">
      <div className="container-x mb-8">
        <Reveal>
          <p className="text-center font-mono text-[10.5px] uppercase tracking-[0.28em] text-fog-faint">
            Outils et technologies que l&apos;on manipule au quotidien
          </p>
        </Reveal>
      </div>

      <div className="space-y-3.5">
        <Marquee duration={44}>
          {ROW_A.map((label) => (
            <Pill key={label} label={label} />
          ))}
        </Marquee>
        <Marquee duration={52} reverse>
          {ROW_B.map((label) => (
            <Pill key={label} label={label} />
          ))}
        </Marquee>
      </div>
    </section>
  );
}
