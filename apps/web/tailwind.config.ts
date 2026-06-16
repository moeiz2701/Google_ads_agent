import type { Config } from "tailwindcss";

/**
 * KodoAI Editorial Brutalism token foundation (Module 7 — see .claude/DesignSystem.md).
 *
 * Color names from old token set are PRESERVED as aliases so existing components
 * don't break. New KodoAI tokens are added alongside them.
 * Border-radius is zeroed out globally — brutalist aesthetic, no exceptions.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      /* ── Fonts ────────────────────────────────────────────────────────── */
      fontFamily: {
        display: ["var(--display)"],
        sans: ["var(--sans)"],
        mono: ["var(--mono)"],
      },

      /* ── Colors — CSS var backed ──────────────────────────────────────── */
      colors: {
        /* Legacy aliases — keep existing components working */
        bg: "var(--bg)",
        surface: "var(--surface)",
        border: "var(--border)",
        fg: "var(--ink)",           // old --fg → new --ink
        muted: "var(--ink-3)",      // old --muted → new --ink-3
        primary: "var(--accent)",   // old --primary → new --accent
        "primary-fg": "var(--bg)",
        danger: "var(--red)",
        success: "var(--green)",

        /* KodoAI tokens */
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        "muted-deep": "var(--muted)",
        accent: "var(--accent)",
        "accent-dim": "var(--accent-dim)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        "border-2": "var(--border-2)",
        amber: "var(--amber)",
        "amber-bg": "var(--amber-bg)",
        "green-bg": "var(--green-bg)",
        "red-bg": "var(--red-bg)",
        blue: "var(--blue)",
        "blue-bg": "var(--blue-bg)",
      },

      /* ── Border radius — zero everywhere (brutalist) ─────────────────── */
      borderRadius: {
        none: "0",
        sm: "0",
        DEFAULT: "0",
        md: "0",
        lg: "0",
        xl: "0",
        "2xl": "0",
        "3xl": "0",
        full: "0",
      },

      /* ── Spacing (4px base unit) ──────────────────────────────────────── */
      spacing: {
        "0.5": "2px",
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "5": "20px",
        "6": "24px",
        "7": "28px",
        "8": "32px",
        "10": "40px",
        "12": "48px",
        "14": "56px",
        "16": "64px",
      },

      /* ── Max widths ───────────────────────────────────────────────────── */
      maxWidth: {
        content: "1280px",
      },
    },
  },
  plugins: [],
};

export default config;
