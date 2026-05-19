import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        sp: {
          "bg-primary":   "#0a0f1e",
          "bg-secondary": "#0d1428",
          "bg-card":      "#111827",
          "bg-elevated":  "#162032",
          cyan:    "#00d4ff",
          teal:    "#00b894",
          purple:  "#7c3aed",
          orange:  "#f59e0b",
          critical: "#dc2626",
          high:     "#ef4444",
          medium:   "#f59e0b",
          low:      "#22c55e",
          info:     "#64748b",
          text:     "#e2e8f0",
          muted:    "#64748b",
          subtle:   "#334155",
          border:   "#1e293b",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        "glow-cyan":   "0 0 20px rgba(0,212,255,0.15)",
        "glow-purple": "0 0 20px rgba(124,58,237,0.15)",
        "glow-teal":   "0 0 20px rgba(0,184,148,0.15)",
        card:          "0 4px 24px rgba(0,0,0,0.4)",
      },
      backgroundImage: {
        "grid-pattern": "url(\"data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 40 0 L 0 0 0 40' fill='none' stroke='%231e293b' stroke-width='0.5'/%3E%3C/svg%3E\")",
      },
      animation: {
        "pulse-cyan": "pulse-cyan 2s ease-in-out infinite",
        "glow":       "glow 2s ease-in-out infinite alternate",
        "shimmer":    "shimmer 2s linear infinite",
      },
      keyframes: {
        "pulse-cyan": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(0,212,255,0.4)" },
          "50%":       { boxShadow: "0 0 0 8px rgba(0,212,255,0)" },
        },
        glow: {
          "0%":   { opacity: "0.5" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
