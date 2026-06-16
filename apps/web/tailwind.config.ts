import type { Config } from "tailwindcss";

/**
 * Minimal token foundation. The frontend-stylist agent will formalize this into a
 * full STYLE.md design system when we build Module 7 (the dashboard). Until then,
 * components reference these CSS-variable-backed tokens, never raw hex.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg))",
        surface: "hsl(var(--surface))",
        border: "hsl(var(--border))",
        fg: "hsl(var(--fg))",
        muted: "hsl(var(--muted))",
        primary: "hsl(var(--primary))",
        "primary-fg": "hsl(var(--primary-fg))",
        danger: "hsl(var(--danger))",
        success: "hsl(var(--success))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
