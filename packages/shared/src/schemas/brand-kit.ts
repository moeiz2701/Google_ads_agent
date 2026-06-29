import { z } from "zod";

/**
 * Brand Kit — the MVP design-language input (§3.3).
 *
 * The user provides this (or the system auto-extracts it from the website). It is
 * applied to pre-built, parameterized templates. The LLM never receives the raw
 * asset at generation time — only this compact spec.
 *
 * Every field nullable so partial auto-extraction degrades gracefully (§10).
 */

const HexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "must be a hex color");

export const BrandPalette = z.object({
  primary: HexColor.nullable(),
  accent: HexColor.nullable(),
  neutral: HexColor.nullable(),
  text: HexColor.nullable(),
});
export type BrandPalette = z.infer<typeof BrandPalette>;

export const BrandFonts = z.object({
  heading: z.string().nullable(),
  body: z.string().nullable(),
  /** Downloadable font-file URLs (ttf/otf) when discovered from the site's
   *  @font-face — lets the renderer use a self-hosted (non-Google) brand font. */
  heading_url: z.string().nullable().default(null),
  body_url: z.string().nullable().default(null),
});
export type BrandFonts = z.infer<typeof BrandFonts>;

/** How the logo sits on a creative: on a white chip (safe on any background, the
 *  default) or placed transparently (for logos that already read well untreated). */
export const LogoBackground = z.enum(["white", "transparent"]);
export type LogoBackground = z.infer<typeof LogoBackground>;

export const BrandKit = z.object({
  logo_url: z.string().url().nullable(),
  /** Logo treatment on rendered creatives. Defaults to "white" so legacy kits
   *  (and partial auto-extraction) keep the existing white-chip behavior. */
  logo_background: LogoBackground.default("white"),
  palette: BrandPalette.nullable(),
  fonts: BrandFonts.nullable(),
  /** e.g. "clinical-reassuring" */
  tone: z.string().nullable(),
  /** Optional brand guardrails, e.g. ["before/after imagery", "price-led claims"]. */
  do_not_use: z.array(z.string()).nullable(),
});
export type BrandKit = z.infer<typeof BrandKit>;

export const emptyBrandKit = (): BrandKit => ({
  logo_url: null,
  logo_background: "white",
  palette: { primary: null, accent: null, neutral: null, text: null },
  fonts: { heading: null, body: null, heading_url: null, body_url: null },
  tone: null,
  do_not_use: [],
});
