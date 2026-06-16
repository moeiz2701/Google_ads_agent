import { z } from "zod";
import { RenderSpec } from "./render-spec";

/**
 * Generation IO (Module 3) — mirrors services/ai/gaa_ai/schemas/generation.py.
 * Used by the Node side to validate the AI service's /generate response before
 * persisting (never trust the service blindly).
 */

export const StyleSpec = z.object({
  palette: z.record(z.string().nullable()).nullable(),
  fonts: z.record(z.string().nullable()).nullable(),
  tone: z.string().nullable(),
  do_not_use: z.array(z.string()).nullable(),
});
export type StyleSpec = z.infer<typeof StyleSpec>;

export const CritiqueScore = z.object({
  single_message: z.number().min(0).max(1),
  cta_strength: z.number().min(0).max(1),
  differentiation: z.number().min(0).max(1),
  policy_safe: z.boolean(),
  notes: z.string().nullable(),
});
export type CritiqueScore = z.infer<typeof CritiqueScore>;

export const Variant = z.object({
  spec: RenderSpec,
  insight_ref: z.string().nullable(),
  axis: z.string().nullable(),
  critique: CritiqueScore.nullable(),
  regenerated: z.boolean().default(false),
});
export type Variant = z.infer<typeof Variant>;

export const GenerationResult = z.object({
  variants: z.array(Variant),
  generated_at: z.string().nullable(),
});
export type GenerationResult = z.infer<typeof GenerationResult>;
