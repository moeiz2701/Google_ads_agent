import { z } from "zod";
import {
  AdNetwork,
  Budget,
  CampaignGoal,
  FlightDates,
  KeywordMatchType,
} from "./common";
import { RenderSpec } from "./render-spec";
import { CampaignStatus } from "./lifecycle";

/**
 * Campaign Config (§6.2) — the complete, launch-ready, fully-editable campaign.
 *
 * Generated with smart defaults from the analysis (§6.1); presented for
 * configure-by-exception review. Bid strategy recommends Google Smart Bidding
 * aligned to goal. Budget is data here — the deterministic execution layer is the
 * only thing that writes a real budget number to Google Ads (§7.2).
 */

export const BidStrategy = z.enum([
  "maximize_conversions",
  "target_cpa",
  "maximize_clicks",
  "target_roas",
  "manual_cpc",
]);
export type BidStrategy = z.infer<typeof BidStrategy>;

export const Keyword = z.object({
  text: z.string().min(1),
  match_type: KeywordMatchType,
});
export type Keyword = z.infer<typeof Keyword>;

/** An ad inside an ad group — its render-spec plus a live/paused toggle. */
export const CampaignAd = z.object({
  ad_id: z.string(),
  spec: RenderSpec,
  /** which insight/gap this exploits — surfaced in the Insights view (§9.8). */
  insight_ref: z.string().nullable(),
  enabled: z.boolean().default(true),
});
export type CampaignAd = z.infer<typeof CampaignAd>;

export const AdGroup = z.object({
  ad_group_id: z.string(),
  name: z.string().min(1),
  keywords: z.array(Keyword),
  negative_keywords: z.array(z.string()).nullable(),
  ads: z.array(CampaignAd),
});
export type AdGroup = z.infer<typeof AdGroup>;

/** Day-of-week × hour eligibility window (§6.3 dayparting). */
export const DaypartingRule = z.object({
  day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  start_hour: z.number().int().min(0).max(23),
  end_hour: z.number().int().min(0).max(24),
});
export type DaypartingRule = z.infer<typeof DaypartingRule>;

export const CampaignConfig = z.object({
  campaign_id: z.string().uuid(),
  client_id: z.string().uuid(),
  name: z.string().min(1),
  status: CampaignStatus.default("draft"),

  // Campaign level (§6.2)
  objective: CampaignGoal,
  budget: Budget,
  bid_strategy: BidStrategy,
  /** Search + Display in MVP (§6.2). */
  networks: z.array(AdNetwork).min(1),
  flight_dates: FlightDates.nullable(),
  geo: z.array(z.string()),
  languages: z.array(z.string()).nullable(),
  dayparting: z.array(DaypartingRule).nullable(),

  // Ad group level
  ad_groups: z.array(AdGroup),

  // Provenance + audit
  analysis_id: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});
export type CampaignConfig = z.infer<typeof CampaignConfig>;
