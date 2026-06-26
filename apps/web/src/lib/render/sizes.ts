import { DISPLAY_SIZES, type DisplaySize } from "@gaa/shared";

/**
 * Standard Google Display sizes (§5.6) + a per-size layout profile so the four
 * templates can adapt one render-spec across very different aspect ratios
 * (a 728×90 leaderboard cannot use the same stacking as a 160×600 skyscraper).
 *
 * Deterministic: the profile is a pure function of the size string — no config,
 * no env, no randomness.
 */

/** Coarse shape class that drives how a template stacks and scales. */
export type SizeClass =
  | "leaderboard" // wide + short (728x90, 320x50)
  | "skyscraper" // tall + narrow (160x600, 300x600)
  | "rectangle" // roughly square-ish blocks (300x250, 336x280)
  | "billboard"; // large landscape hero (1200x628)

export interface SizeProfile {
  size: DisplaySize;
  width: number;
  height: number;
  cls: SizeClass;
  /** Multiplier applied to a template's base type scale for this size. */
  fontScale: number;
  /** Inner padding in px (templates may override per region). */
  pad: number;
  /**
   * Preferred main-axis stacking for image+copy templates. Wide/short banners
   * read horizontally; tall/square blocks read vertically. Templates use this
   * as a hint and may ignore it where their design is fixed (e.g. bold_centered).
   */
  stack: "row" | "column";
  /** Whether there is enough room to show a subhead at all. */
  showSubhead: boolean;
  /** Whether there is room for a brand logo (skip on short banners). */
  showLogo: boolean;
}

const SHORT_EDGE_MIN_FOR_SUBHEAD = 90;

function classOf(w: number, h: number): SizeClass {
  if (w >= 1000) return "billboard";
  const ratio = w / h;
  if (ratio >= 3) return "leaderboard";
  if (ratio <= 0.6) return "skyscraper";
  return "rectangle";
}

function profileFor(size: DisplaySize): SizeProfile {
  const [w, h] = size.split("x").map(Number) as [number, number];
  const cls = classOf(w, h);
  // Scale type to the constraining (short) edge so copy never overflows tiny banners.
  const shortEdge = Math.min(w, h);
  const fontScale =
    cls === "billboard"
      ? 1.6
      : cls === "leaderboard"
        ? shortEdge < 70
          ? 0.55
          : 0.85
        : cls === "skyscraper"
          ? 1.05
          : 1.0;
  const pad = cls === "leaderboard" ? (shortEdge < 70 ? 8 : 12) : Math.round(shortEdge * 0.07);
  const stack: SizeProfile["stack"] = cls === "leaderboard" ? "row" : "column";
  return {
    size,
    width: w,
    height: h,
    cls,
    fontScale,
    pad,
    stack,
    showSubhead: shortEdge >= SHORT_EDGE_MIN_FOR_SUBHEAD,
    // Logos crowd short/wide banners; show only where there's real vertical room.
    showLogo: cls !== "leaderboard" && shortEdge >= SHORT_EDGE_MIN_FOR_SUBHEAD,
  };
}

/** All seven profiles, keyed by size, computed once at module load. */
export const SIZE_PROFILES: Record<DisplaySize, SizeProfile> = Object.fromEntries(
  DISPLAY_SIZES.map((s) => [s, profileFor(s)]),
) as Record<DisplaySize, SizeProfile>;

export function getSizeProfile(size: DisplaySize): SizeProfile {
  return SIZE_PROFILES[size];
}

/** Allowlist check for an untrusted `size` query param. */
export function isDisplaySize(value: string): value is DisplaySize {
  return (DISPLAY_SIZES as readonly string[]).includes(value);
}

export { DISPLAY_SIZES, type DisplaySize };
