import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MarqueeProps = {
  children: ReactNode;
  /** Seconds for one full loop. */
  duration?: number;
  reverse?: boolean;
  className?: string;
};

/** Seamless horizontal loop — content is rendered twice and translated -50%. */
export function Marquee({ children, duration = 40, reverse, className }: MarqueeProps) {
  return (
    <div className={cn("marquee-wrap mask-fade-x overflow-hidden", className)}>
      <div
        className={cn("marquee-track", reverse && "reverse")}
        style={{ "--marquee-duration": `${duration}s` } as React.CSSProperties}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
