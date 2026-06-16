import { z } from "zod";
import { TextDensity } from "./enriched-ad";

/**
 * Analysis Object (§4.4) — the aggregated output of the REDUCE step.
 *
 * The whole competitor corpus distilled into one compact object (a few thousand
 * tokens). This is why the system needs NO RAG (§6.3 / CLAUDE.md): the distilled
 * object is included whole in every generation call.
 *
 * `gap_opportunities` is the strategic payload — generation exploits these gaps,
 * it does not copy the crowd.
 */

export const WinningAngle = z.object({
  angle: z.string(),
  /** Longevity-weighted confidence in [0,1] — proxy for "this survives". */
  longevity_weight: z.number().min(0).max(1),
  example_ids: z.array(z.string()).nullable(),
});
export type WinningAngle = z.infer<typeof WinningAngle>;

export const CreativeNorms = z.object({
  /** fraction of competitor display ads featuring faces, etc. */
  faces: z.number().min(0).max(1).nullable(),
  before_after: z.number().min(0).max(1).nullable(),
  text_density: TextDensity.nullable(),
});
export type CreativeNorms = z.infer<typeof CreativeNorms>;

export const AnalysisObject = z.object({
  vertical: z.string(),
  geo: z.string().nullable(),

  winning_angles: z.array(WinningAngle),
  saturated_angles: z.array(z.string()).nullable(),
  /** the strategic payload — angles no competitor is advertising (§4.4). */
  gap_opportunities: z.array(z.string()),

  common_offers: z.array(z.string()).nullable(),
  cta_patterns: z.array(z.string()).nullable(),
  keyword_seed: z.array(z.string()).nullable(),
  creative_norms: CreativeNorms.nullable(),
  persona: z.string().nullable(),

  /** provenance for the Insights view + feedback loop. */
  source_ad_count: z.number().int().nonnegative().nullable(),
  generated_at: z.string().nullable(),
});
export type AnalysisObject = z.infer<typeof AnalysisObject>;
