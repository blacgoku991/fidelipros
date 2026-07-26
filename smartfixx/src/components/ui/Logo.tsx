import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * SmartFixx mark — a rounded aperture holding an "X" built from two wrench-like
 * strokes, with a node orbiting the frame.
 */
export function LogoMark({
  className,
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg viewBox="0 0 44 44" fill="none" className={cn("h-9 w-9", className)} aria-hidden="true">
      <defs>
        <linearGradient id="sfFrame" x1="4" y1="4" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4FF0D4" />
          <stop offset="0.55" stopColor="#8B5CFF" />
          <stop offset="1" stopColor="#FF5C8A" />
        </linearGradient>
        <linearGradient
          id="sfStrokeA"
          x1="13"
          y1="13"
          x2="31"
          y2="31"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#6BF5DE" />
          <stop offset="1" stopColor="#4FF0D4" />
        </linearGradient>
        <linearGradient
          id="sfStrokeB"
          x1="31"
          y1="13"
          x2="13"
          y2="31"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#A985FF" />
          <stop offset="1" stopColor="#6C3BF5" />
        </linearGradient>
      </defs>

      <rect
        x="2.6"
        y="2.6"
        width="38.8"
        height="38.8"
        rx="13"
        stroke="url(#sfFrame)"
        strokeWidth="1.7"
        opacity="0.9"
      />
      <rect x="2.6" y="2.6" width="38.8" height="38.8" rx="13" fill="#4FF0D4" opacity="0.05" />

      {/* X strokes with squared "socket" ends */}
      <path
        d="M14.5 14.5 L29.5 29.5"
        stroke="url(#sfStrokeA)"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        d="M29.5 14.5 L14.5 29.5"
        stroke="url(#sfStrokeB)"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <circle cx="22" cy="22" r="3.1" fill="#04050A" />
      <circle cx="22" cy="22" r="1.5" fill="#4FF0D4" />

      {animated ? (
        <motion.circle
          cx="22"
          cy="5.5"
          r="1.7"
          fill="#FF5C8A"
          style={{ originX: "22px", originY: "22px" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        />
      ) : (
        <circle cx="22" cy="5.5" r="1.7" fill="#FF5C8A" />
      )}
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-[19px] font-semibold tracking-tight text-white">
        Smart<span className="grad-accent">Fixx</span>
      </span>
    </span>
  );
}
