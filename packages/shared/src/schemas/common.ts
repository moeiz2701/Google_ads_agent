import { z } from "zod";

/**
 * Shared enums and value objects used across the five core schemas.
 * Spec: docs/IMPLEMENTATION.md §3, §6.
 */

export const CampaignGoal = z.enum([
  "leads",
  "calls",
  "sales",
  "traffic",
  "awareness",
]);
export type CampaignGoal = z.infer<typeof CampaignGoal>;

export const PricePositioning = z.enum(["premium", "mid", "budget"]);
export type PricePositioning = z.infer<typeof PricePositioning>;

export const AdNetwork = z.enum(["search", "display", "youtube"]);
export type AdNetwork = z.infer<typeof AdNetwork>;

export const AdFormat = z.enum(["search", "display"]);
export type AdFormat = z.infer<typeof AdFormat>;

/**
 * Budget value object.
 *
 * IMPORTANT (project supreme law): the LLM NEVER sets or writes a budget value.
 * Budgets are set and hard-capped by deterministic code only (§7.2). This type
 * is data-only; enforcement lives in the execution layer, not here.
 */
export const Budget = z.object({
  type: z.enum(["daily", "total"]),
  amount: z.number().positive(),
  currency: z.string().length(3).default("USD"),
});
export type Budget = z.infer<typeof Budget>;

/** ISO date string (YYYY-MM-DD) or full ISO timestamp. */
export const IsoDate = z.string().min(1);

export const FlightDates = z.object({
  start: IsoDate.nullable(),
  end: IsoDate.nullable(),
});
export type FlightDates = z.infer<typeof FlightDates>;

/** Standard Google Display ad sizes (Module 3 rendering, §5.6). */
export const DISPLAY_SIZES = [
  "300x250",
  "336x280",
  "728x90",
  "160x600",
  "320x50",
  "300x600",
  "1200x628",
] as const;
export const DisplaySize = z.enum(DISPLAY_SIZES);
export type DisplaySize = z.infer<typeof DisplaySize>;

export const KeywordMatchType = z.enum(["broad", "phrase", "exact"]);
export type KeywordMatchType = z.infer<typeof KeywordMatchType>;
