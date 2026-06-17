import {
  CampaignConfig,
  type AdGroup,
  type CampaignAd,
  type ClientProfile,
  type AdNetwork,
} from "@gaa/shared";
import { getGoogleAdsClient } from "@/lib/google-ads";
import type {
  AdvertisingChannel,
  GoogleAdsClient,
  LaunchPlan,
  LaunchResult,
  PlanAdGroup,
  PlanDisplayAd,
  PlanSearchAd,
} from "@/lib/google-ads";
import { policyCheck } from "./policy";
import { PolicyError, ValidationError } from "./errors";

/**
 * Module 5 — deterministic execution layer (§7.2). NON-LLM code that turns an
 * (already human-approved) CampaignConfig into a live (test-account) campaign.
 *
 * Supreme rules enforced HERE, deterministically:
 *  1. budget cap — the launch budget is min(config, profile); the LLM never set
 *     it and cannot exceed the agreed client budget.
 *  2. policy gate — the final pre-publish text check (policy.ts) BLOCKS bad copy.
 *  3. enabled-only — disabled variants are dropped from the plan entirely.
 *
 * The Google Ads client is injectable so tests run against MockGoogleAdsClient
 * with no network and no credentials.
 */

const MICROS_PER_UNIT = 1_000_000;
/** Network → Google advertising channel. youtube is out of MVP scope. */
const CHANNEL: Record<Exclude<AdNetwork, "youtube">, AdvertisingChannel> = {
  search: "SEARCH",
  display: "DISPLAY",
};

export interface ExecuteOptions {
  /**
   * Operating Google Ads account (test CLIENT account) where objects are
   * created — NOT the login/manager id. Supplied at launch time by the route
   * (UI input, or the env login-customer-id fallback). The client strips dashes.
   * Defaults to a digits-of-campaign-id placeholder so direct/test calls still
   * validate; production callers always pass this explicitly.
   */
  customerId?: string;
  /** Injectable client for tests (no network, no creds). */
  client?: GoogleAdsClient;
}

export async function executeLaunch(
  config: CampaignConfig,
  profile: ClientProfile,
  opts: ExecuteOptions = {},
): Promise<LaunchResult> {
  const client = opts.client ?? getGoogleAdsClient();
  // 1. Structural validation. Re-parse so a row that drifted from the schema
  //    can't reach the API; never trust persisted JSON blindly.
  const cfg = CampaignConfig.parse(config);

  if (cfg.ad_groups.length === 0) {
    throw new ValidationError("Campaign has no ad groups");
  }
  const enabledAdCount = cfg.ad_groups.reduce(
    (n, g) => n + g.ads.filter((a) => a.enabled).length,
    0,
  );
  if (enabledAdCount === 0) {
    throw new ValidationError(
      "Campaign has no enabled ads — toggle at least one variant on before launching",
    );
  }

  // 2. Budget cap — the supreme rule. min(config, profile), converted to micros.
  //    The LLM is not involved at any point; this is pure arithmetic.
  const amount = Math.min(cfg.budget.amount, profile.budget.amount);
  const budgetMicros = Math.round(amount * MICROS_PER_UNIT);
  if (!(budgetMicros > 0)) {
    throw new ValidationError(
      `Resolved budget is not positive (config=${cfg.budget.amount}, cap=${profile.budget.amount})`,
    );
  }

  // 3. Policy pre-check on enabled ads only — final deterministic gate.
  const violations = policyCheck(cfg, profile);
  if (violations.length > 0) {
    throw new PolicyError(
      `Launch blocked: ${violations.length} ad-policy violation(s) must be fixed`,
      violations,
    );
  }

  // 4. Build the plan from ENABLED ads only.
  const customerId =
    opts.customerId ?? cfg.campaign_id.replace(/\D/g, "").slice(0, 10).padEnd(10, "0");
  const channels = mapChannels(cfg.networks);
  const plan: LaunchPlan = {
    customerId,
    campaignName: cfg.name,
    channels,
    biddingStrategy: cfg.bid_strategy,
    budgetMicros,
    geo: cfg.geo,
    adGroups: cfg.ad_groups
      .map((g) => buildPlanAdGroup(g))
      .filter((g) => g.searchAds.length + g.displayAds.length > 0),
  };

  // 5. Hand off to the client. Typed GoogleAdsError propagates to the route.
  return client.launchCampaign(plan);
}

function mapChannels(networks: AdNetwork[]): AdvertisingChannel[] {
  const out: AdvertisingChannel[] = [];
  for (const n of networks) {
    if (n === "youtube") continue;
    const c = CHANNEL[n];
    if (!out.includes(c)) out.push(c);
  }
  // Default to SEARCH if a config somehow had only youtube.
  return out.length > 0 ? out : ["SEARCH"];
}

function buildPlanAdGroup(group: AdGroup): PlanAdGroup {
  const enabled = group.ads.filter((a) => a.enabled);
  const searchAds: PlanSearchAd[] = [];
  const displayAds: PlanDisplayAd[] = [];

  for (const ad of enabled) {
    if (ad.spec.format === "search") {
      searchAds.push(toSearchAd(ad));
    } else {
      displayAds.push({
        templateId: ad.spec.template_id,
        headline: ad.spec.headline,
        subhead: ad.spec.subhead,
        cta: ad.spec.cta,
      });
    }
  }

  return {
    name: group.name,
    keywords: group.keywords.map((k) => ({ text: k.text, matchType: k.match_type })),
    negativeKeywords: group.negative_keywords ?? [],
    searchAds,
    displayAds,
  };
}

function toSearchAd(ad: CampaignAd): PlanSearchAd {
  if (ad.spec.format !== "search") {
    throw new ValidationError("toSearchAd called on a non-search ad");
  }
  return {
    headlines: ad.spec.headlines.map((h) => h.text),
    descriptions: ad.spec.descriptions.map((d) => d.text),
    paths: ad.spec.paths,
  };
}
