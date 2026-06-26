import { z } from "zod";
import { DisplaySize } from "./common";

/**
 * Render-Spec (§5.2) — the per-variant artifact the LLM emits.
 *
 * The LLM outputs a STRUCTURED render-spec; deterministic code renders the actual
 * creative (Display → Satori template; Search → direct RSA assembly). The LLM
 * never freehands layout (project supreme law).
 *
 * Two shapes, discriminated by `format`:
 *  - display: template_id + slots → fans out to all standard sizes (§5.6)
 *  - search:  Responsive Search Ad assets (no canvas)
 *
 * Every variant ties back to an `angle` (the insight/gap it exploits) — a variant
 * not tied to an insight is not done (CLAUDE.md).
 */

const ImageSpec = z.object({
  source: z.enum(["stock", "client", "stock_or_client"]),
  query: z.string().nullable(),
  url: z.string().nullable(),
});

/**
 * How the background image is treated before copy is laid over it. The LLM picks
 * from this fixed set (never freehand); deterministic code applies the effect.
 * Makes a generic stock photo read as intentional and on-brand:
 *  - none:        image as-is
 *  - scrim:       dark bottom-up gradient (legibility for overlaid copy)
 *  - brand_wash:  translucent brand-primary wash over the image (on-brand tint)
 */
export const IMAGE_TREATMENTS = ["none", "scrim", "brand_wash"] as const;
export const ImageTreatment = z.enum(IMAGE_TREATMENTS);
export type ImageTreatment = z.infer<typeof ImageTreatment>;

/**
 * The Display template ids — the canonical, client-safe list (no `server-only`
 * deps), so UI dropdowns + PATCH validation share one source of truth. MUST stay
 * in sync with the renderer registry and services/ai `templates.py`.
 */
export const DISPLAY_TEMPLATE_IDS = [
  "split_image_left",
  "image_overlay_bottom",
  "bold_centered",
  "minimal_left_rule",
] as const;
export type DisplayTemplateId = (typeof DISPLAY_TEMPLATE_IDS)[number];

export const DisplayRenderSpec = z.object({
  format: z.literal("display"),
  template_id: z.string(),
  /** primary authoring size; renderer fans out to the rest. */
  size: DisplaySize.default("1200x628"),
  headline: z.string(),
  subhead: z.string().nullable(),
  cta: z.string(),
  /** reference into the brand kit, e.g. "brand_kit.primary". */
  palette_ref: z.string().nullable(),
  image: ImageSpec.nullable(),
  /** Deterministic image treatment; defaults to none for legacy specs. */
  image_treatment: ImageTreatment.default("none"),
  /** the strategy this variant exploits, e.g. "gap:trust+speed". */
  angle: z.string(),
});
export type DisplayRenderSpec = z.infer<typeof DisplayRenderSpec>;

/**
 * Responsive Search Ad asset bundle (§5.2 / §5.6).
 * Google RSA limits: up to 15 headlines (≤30 chars), 4 descriptions (≤90 chars).
 * Pinning is optional; pos 1–3 for headlines, 1–2 for descriptions.
 */
export const RsaHeadline = z.object({
  text: z.string().max(30),
  pin: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
});
export const RsaDescription = z.object({
  text: z.string().max(90),
  pin: z.union([z.literal(1), z.literal(2)]).nullable(),
});

export const SearchRenderSpec = z.object({
  format: z.literal("search"),
  headlines: z.array(RsaHeadline).min(3).max(15),
  descriptions: z.array(RsaDescription).min(2).max(4),
  paths: z.tuple([z.string().max(15).nullable(), z.string().max(15).nullable()])
    .nullable(),
  angle: z.string(),
});
export type SearchRenderSpec = z.infer<typeof SearchRenderSpec>;

export const RenderSpec = z.discriminatedUnion("format", [
  DisplayRenderSpec,
  SearchRenderSpec,
]);
export type RenderSpec = z.infer<typeof RenderSpec>;
