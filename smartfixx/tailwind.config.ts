import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#04050A",
          900: "#070911",
          850: "#0A0D18",
          800: "#0E1220",
          700: "#151A2C",
          600: "#1E2439",
        },
        mint: {
          DEFAULT: "#4FF0D4",
          400: "#6BF5DE",
          600: "#21D3B6",
        },
        violet: {
          DEFAULT: "#8B5CFF",
          400: "#A985FF",
          600: "#6C3BF5",
        },
        coral: "#FF5C8A",
        fog: {
          DEFAULT: "#C3CBDE",
          dim: "#7E88A3",
          faint: "#4B5468",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.045em",
      },
      screens: {
        xs: "460px",
      },
      /* Finer alpha steps than the default scale — the UI leans on subtle hairlines. */
      opacity: {
        2: "0.02",
        3: "0.03",
        4: "0.04",
        6: "0.06",
        7: "0.07",
        8: "0.08",
        12: "0.12",
        15: "0.15",
        18: "0.18",
        22: "0.22",
        35: "0.35",
        45: "0.45",
        55: "0.55",
        65: "0.65",
        85: "0.85",
        96: "0.96",
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.85)", opacity: "0.7" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        marquee: "marquee var(--marquee-duration, 40s) linear infinite",
        "spin-slow": "spin-slow 22s linear infinite",
        float: "float 6s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2.6s cubic-bezier(0.2,0.7,0.3,1) infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
