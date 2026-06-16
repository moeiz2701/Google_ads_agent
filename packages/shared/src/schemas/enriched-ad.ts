import { z } from "zod";
import { AdNetwork } from "./common";

/**
 * Enriched Ad Record (§4.3) — the per-ad output of the MAP step.
 *
 * Each scraped competitor ad is enriched: text through the LLM, creatives through
 * the vision model, into this structured record. Many of these are then reduced
 * into a single `analysis_object`.
 *
 * Reliability note (§4.3): text/format/dates are solid; impression ranges are
 * wide buckets (tier signal only). EVERY field nullable — scraped data is
 * frequently incomplete and must degrade gracefully (§10).
 */

export const ScaleTier = z.enum(["low", "medium", "high"]);
export type ScaleTier = z.infer<typeof ScaleTier>;

export const TextDensity = z.enum(["low", "medium", "high"]);
export type TextDensity = z.infer<typeof TextDensity>;

/** Creative / design-language attributes — Display only (§4.3). */
export const CreativeAttributes = z.object({
  faces: z.boolean().nullable(),
  before_after: z.boolean().nullable(),
  product_vs_lifestyle: z.enum(["product", "lifestyle", "mixed"]).nullable(),
  text_density: TextDensity.nullable(),
  tone: z.string().nullable(),
  dominant_colors: z.array(z.string()).nullable(),
});
export type CreativeAttributes = z.infer<typeof CreativeAttributes>;

export const EnrichedAdRecord = z.object({
  ad_id: z.string(),
  advertiser: z.string().nullable(),
  source: z.enum(["google_transparency", "serpapi", "meta", "cached"]).nullable(),

  // raw captured content
  format: z.enum(["search", "display", "video", "unknown"]).nullable(),
  headline: z.string().nullable(),
  body: z.string().nullable(),
  image_url: z.string().nullable(),
  landing_url: z.string().nullable(),

  // Performance-proxy signals (most valuable, all derived) — §4.3
  first_shown: z.string().nullable(),
  last_shown: z.string().nullable(),
  /** last_shown − first_shown; best free proxy for "is it working". */
  days_running: z.number().int().nonnegative().nullable(),
  still_active: z.boolean().nullable(),
  /** conviction/budget signal */
  variant_count: z.number().int().nonnegative().nullable(),
  /** from impression bucket × region spread — tier only, never precise. */
  scale_tier: ScaleTier.nullable(),

  // Offer & pricing
  offer_type: z.string().nullable(),
  price_points: z.array(z.string()).nullable(),
  promotion_cadence: z.string().nullable(),

  // Messaging & angle
  primary_value_prop: z.string().nullable(),
  emotional_hook: z.string().nullable(),
  implied_persona: z.string().nullable(),
  claims: z.array(z.string()).nullable(),
  cta_verb: z.string().nullable(),

  // Keyword & targeting
  repeated_phrases: z.array(z.string()).nullable(),
  regions: z.array(z.string()).nullable(),
  platforms: z.array(AdNetwork).nullable(),

  // Creative / design language (Display)
  creative: CreativeAttributes.nullable(),
});
export type EnrichedAdRecord = z.infer<typeof EnrichedAdRecord>;
