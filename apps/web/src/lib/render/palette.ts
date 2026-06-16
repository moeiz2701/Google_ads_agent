import type { BrandKit } from "@gaa/shared";

/**
 * Deterministic palette resolution shared by templates and the stock-image
 * fallback. Pulls colors from the brand kit with legible defaults, and derives
 * a readable foreground color via WCAG luminance so copy never sits illegibly
 * on its background. No randomness — same brand kit always yields same colors.
 */

export interface Palette {
  primary: string;
  accent: string;
  neutral: string;
  text: string;
}

/** Tasteful, neutral defaults used when the brand kit omits a color. */
const DEFAULTS: Palette = {
  primary: "#1f3a5f", // deep slate-blue
  accent: "#c9a14a", // muted gold
  neutral: "#f4f1ec", // warm off-white
  text: "#1a1a1a",
};

export function resolvePalette(brandKit: BrandKit | null): Palette {
  const p = brandKit?.palette ?? null;
  return {
    primary: p?.primary ?? DEFAULTS.primary,
    accent: p?.accent ?? DEFAULTS.accent,
    neutral: p?.neutral ?? DEFAULTS.neutral,
    text: p?.text ?? DEFAULTS.text,
  };
}

/** Expand #abc → #aabbcc; returns null for anything not a valid hex. */
function normalizeHex(hex: string): string | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex);
  const h = m?.[1];
  if (!h) return null;
  if (h.length === 3) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  return `#${h}`.toLowerCase();
}

function relativeLuminance(hex: string): number {
  const norm = normalizeHex(hex);
  if (!norm) return 0; // treat unparseable as dark → light text
  const channels = [1, 3, 5].map((i) => parseInt(norm.slice(i, i + 2), 16) / 255);
  const lin = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  const [r, g, b] = lin as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Near-white or near-black foreground, whichever is more legible on `bg`. */
export function readableOn(bg: string): string {
  return relativeLuminance(bg) > 0.45 ? "#15130f" : "#ffffff";
}

/**
 * Deterministic two-stop gradient string for the brand-color image fallback.
 * Derived purely from the palette so the same brand renders the same backdrop.
 */
export function brandGradient(palette: Palette): string {
  return `linear-gradient(135deg, ${palette.primary} 0%, ${palette.accent} 100%)`;
}

/** rgba() form of a hex color at a given alpha (for legibility scrims). */
export function withAlpha(hex: string, alpha: number): string {
  const norm = normalizeHex(hex);
  if (!norm) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(norm.slice(1, 3), 16);
  const g = parseInt(norm.slice(3, 5), 16);
  const b = parseInt(norm.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
