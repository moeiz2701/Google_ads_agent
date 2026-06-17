/**
 * Provider-abstracted Google Ads client (mirrors the LLM abstraction in
 * src/lib/llm). Every Google Ads mutation in the app goes through this interface
 * so the implementation (mock vs real REST) is a config change, not a rewrite.
 *
 * MVP publishes to a Google Ads TEST account ONLY (CLAUDE.md supreme law). The
 * real client is never wired to production serving.
 *
 * The `LaunchPlan` is the NORMALIZED, already-validated input the deterministic
 * execution layer (src/lib/execution/execute.ts) hands to a client:
 *  - budget is ALREADY in micros and ALREADY capped (the LLM never set it)
 *  - only ENABLED ads are present (disabled variants are dropped upstream)
 *  - customer ids are raw here; the client strips dashes before any API call
 */

import type { BidStrategy, KeywordMatchType } from "@gaa/shared";

/** A keyword as the API needs it. */
export interface PlanKeyword {
  text: string;
  matchType: KeywordMatchType;
}

/** A Responsive Search Ad, already trimmed to Google's asset limits upstream. */
export interface PlanSearchAd {
  headlines: string[];
  descriptions: string[];
  /** Display-path segments shown in the green URL line; null when unset. */
  paths: [string | null, string | null] | null;
}

/** A Display creative spec. Image assets are NOT uploaded by the MVP client. */
export interface PlanDisplayAd {
  templateId: string;
  headline: string;
  subhead: string | null;
  cta: string;
}

export interface PlanAdGroup {
  name: string;
  keywords: PlanKeyword[];
  negativeKeywords: string[];
  searchAds: PlanSearchAd[];
  displayAds: PlanDisplayAd[];
}

/** One of the Google network types a campaign serves on. */
export type AdvertisingChannel = "SEARCH" | "DISPLAY";

export interface LaunchPlan {
  /** Operating account where objects are created (NOT the login/manager id). */
  customerId: string;
  campaignName: string;
  /** Search and/or Display — drives one campaign create per channel is overkill
   *  for the MVP; we create a single campaign on the primary channel and note
   *  the secondary as a warning. The first entry is the primary. */
  channels: AdvertisingChannel[];
  biddingStrategy: BidStrategy;
  /** Already capped + converted to micros by the execution layer. > 0 guaranteed. */
  budgetMicros: number;
  /** Free-form geo target strings (MVP; real geo-id resolution is a TODO). */
  geo: string[];
  adGroups: PlanAdGroup[];
}

export interface LaunchResult {
  customerId: string;
  campaignResourceName: string;
  budgetResourceName: string;
  adGroupResourceNames: string[];
  adResourceNames: string[];
  /** Non-fatal issues (e.g. Display creatives deferred, geo not resolved). */
  warnings: string[];
}

/**
 * Typed Google Ads error so callers distinguish retryable (429/5xx/network) from
 * terminal (4xx auth/validation). Mirrors LlmError.opts.retryable.
 */
export class GoogleAdsError extends Error {
  constructor(
    message: string,
    readonly opts: { retryable: boolean; status?: number; cause?: unknown } = {
      retryable: false,
    },
  ) {
    super(message, { cause: opts.cause });
    this.name = "GoogleAdsError";
  }
}

export interface GoogleAdsClient {
  readonly name: string;
  launchCampaign(plan: LaunchPlan): Promise<LaunchResult>;
}
