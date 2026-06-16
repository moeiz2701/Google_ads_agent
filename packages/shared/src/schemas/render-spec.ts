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
