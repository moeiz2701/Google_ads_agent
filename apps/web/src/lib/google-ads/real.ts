import { withRetry } from "./retry";
import { assertValidPlan, digitsOnly } from "./plan";
import {
  GoogleAdsError,
  type GoogleAdsClient,
  type LaunchPlan,
  type LaunchResult,
  type PlanAdGroup,
} from "./types";
import type { BidStrategy } from "@gaa/shared";

/**
 * Google Ads REST client (API v17) — TEST account only (CLAUDE.md supreme law).
 *
 * There is no official Node SDK, so this calls the REST surface directly with
 * `fetch`. UNTESTED against a live account in this repo (no creds in CI): the
 * mutate request/response shapes follow the v17 docs but must be verified by the
 * user against their test account — see the launch-route report.
 *
 * Secrets discipline: the developer token, OAuth client secret, refresh token,
 * and access token are NEVER logged or included in thrown error messages. Error
 * bodies from the API are truncated and may contain field paths but not creds.
 */

const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://googleads.googleapis.com/v17";
const REQUEST_TIMEOUT_MS = 30_000;
/** Refresh the access token this many ms before its stated expiry. */
const TOKEN_EXPIRY_SKEW_MS = 60_000;

export interface RealClientCreds {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** Manager (login) account; dashes stripped before use as a header. */
  loginCustomerId: string;
}

const BID_STRATEGY_FIELD: Record<BidStrategy, Record<string, unknown>> = {
  maximize_conversions: { maximizeConversions: {} },
  target_cpa: { maximizeConversions: {} },
  maximize_clicks: { maximizeConversionValue: {} },
  target_roas: { maximizeConversionValue: {} },
  manual_cpc: { manualCpc: {} },
};

const MATCH_TYPE: Record<string, string> = {
  broad: "BROAD",
  phrase: "PHRASE",
  exact: "EXACT",
};

export class RealGoogleAdsClient implements GoogleAdsClient {
  readonly name = "google-ads";
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  constructor(private readonly creds: RealClientCreds) {}

  async launchCampaign(plan: LaunchPlan): Promise<LaunchResult> {
    assertValidPlan(plan);
    const cid = digitsOnly(plan.customerId);
    const warnings: string[] = [];

    if (plan.channels.length > 1) {
      warnings.push(
        `Plan spans channels ${plan.channels.join(", ")}; created one campaign on ${plan.channels[0]} only.`,
      );
    }
    const channel = plan.channels[0]!;

    // 1. Budget — its own resource, referenced by the campaign.
    const budgetResourceName = await this.mutate(cid, "campaignBudgets", [
      {
        create: {
          name: `${plan.campaignName} budget ${Date.now()}`,
          amountMicros: String(plan.budgetMicros),
          deliveryMethod: "STANDARD",
          explicitlyShared: false,
        },
      },
    ]).then(firstResourceName);

    // 2. Campaign — PAUSED on create so nothing can serve before the human
    //    approval gate has fully resolved upstream; status is managed by us.
    const campaignResourceName = await this.mutate(cid, "campaigns", [
      {
        create: {
          name: plan.campaignName,
          status: "PAUSED",
          advertisingChannelType: channel,
          campaignBudget: budgetResourceName,
          ...BID_STRATEGY_FIELD[plan.biddingStrategy],
          networkSettings:
            channel === "SEARCH"
              ? { targetGoogleSearch: true, targetSearchNetwork: true }
              : { targetContentNetwork: true },
        },
      },
    ]).then(firstResourceName);

    // 3. Ad groups, then their criteria + ads (sequential: criteria reference
    //    the ad group resource name returned here).
    const adGroupResourceNames: string[] = [];
    const adResourceNames: string[] = [];

    for (const group of plan.adGroups) {
      const adGroupResourceName = await this.mutate(cid, "adGroups", [
        {
          create: {
            name: group.name,
            campaign: campaignResourceName,
            status: "ENABLED",
            type: channel === "SEARCH" ? "SEARCH_STANDARD" : "DISPLAY_STANDARD",
          },
        },
      ]).then(firstResourceName);
      adGroupResourceNames.push(adGroupResourceName);

      await this.createCriteria(cid, adGroupResourceName, group, warnings);
      const ids = await this.createAds(
        cid,
        adGroupResourceName,
        group,
        warnings,
      );
      adResourceNames.push(...ids);
    }

    return {
      customerId: cid,
      campaignResourceName,
      budgetResourceName,
      adGroupResourceNames,
      adResourceNames,
      warnings,
    };
  }

  /** Keyword + negative-keyword criteria for one ad group. */
  private async createCriteria(
    cid: string,
    adGroup: string,
    group: PlanAdGroup,
    warnings: string[],
  ): Promise<void> {
    const ops = [
      ...group.keywords.map((k) => ({
        create: {
          adGroup,
          status: "ENABLED",
          keyword: { text: k.text, matchType: MATCH_TYPE[k.matchType] ?? "PHRASE" },
        },
      })),
      ...group.negativeKeywords.map((text) => ({
        create: {
          adGroup,
          negative: true,
          keyword: { text, matchType: "BROAD" },
        },
      })),
    ];
    if (ops.length === 0) return;
    try {
      await this.mutate(cid, "adGroupCriteria", ops);
    } catch (err) {
      // Criteria failure shouldn't sink the whole launch — the campaign + ads
      // are the valuable artifacts. Surface as a warning, keep terminal auth
      // errors fatal.
      if (err instanceof GoogleAdsError && err.opts.retryable) throw err;
      warnings.push(
        `Ad group "${group.name}": keyword criteria failed (${truncate(String((err as Error)?.message ?? err))}).`,
      );
    }
  }

  /**
   * Responsive Search Ads from the plan's searchAds. Display ads are best-effort
   * deferred: responsive display ads require uploaded image assets (a separate
   * AssetService upload flow), out of MVP scope — we add a warning rather than
   * failing the launch.
   */
  private async createAds(
    cid: string,
    adGroup: string,
    group: PlanAdGroup,
    warnings: string[],
  ): Promise<string[]> {
    if (group.displayAds.length > 0) {
      warnings.push(
        `Ad group "${group.name}": ${group.displayAds.length} Display creative(s) need uploaded image assets and were not created (add manually in the test account).`,
      );
    }
    if (group.searchAds.length === 0) return [];

    const ops = group.searchAds.map((ad) => ({
      create: {
        adGroup,
        status: "ENABLED",
        ad: {
          responsiveSearchAd: {
            headlines: ad.headlines.map((text) => ({ text })),
            descriptions: ad.descriptions.map((text) => ({ text })),
            ...(ad.paths
              ? {
                  ...(ad.paths[0] ? { path1: ad.paths[0] } : {}),
                  ...(ad.paths[1] ? { path2: ad.paths[1] } : {}),
                }
              : {}),
          },
        },
      },
    }));
    const res = await this.mutate(cid, "adGroupAds", ops);
    return resourceNames(res);
  }

  // --- transport ------------------------------------------------------------

  /** POST a mutate request to {service}:mutate and parse the results array. */
  private async mutate(
    cid: string,
    service: string,
    operations: unknown[],
  ): Promise<unknown> {
    const url = `${API_BASE}/customers/${cid}/${service}:mutate`;
    const token = await this.getAccessToken();
    return withRetry(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
            "developer-token": this.creds.developerToken,
            "login-customer-id": digitsOnly(this.creds.loginCustomerId),
          },
          body: JSON.stringify({ operations, partialFailure: false }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          const retryable = res.status === 429 || res.status >= 500;
          throw new GoogleAdsError(
            `Google Ads ${service}:mutate HTTP ${res.status}: ${truncate(body)}`,
            { retryable, status: res.status },
          );
        }
        return (await res.json()) as unknown;
      } catch (err) {
        if (err instanceof GoogleAdsError) throw err;
        // network error / abort → retryable
        throw new GoogleAdsError(`Google Ads ${service}:mutate request failed`, {
          retryable: true,
          cause: err,
        });
      } finally {
        clearTimeout(timer);
      }
    });
  }

  /** Exchange the refresh token for an access token; cache until near expiry. */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt) {
      return this.accessToken;
    }
    const body = new URLSearchParams({
      client_id: this.creds.clientId,
      client_secret: this.creds.clientSecret,
      refresh_token: this.creds.refreshToken,
      grant_type: "refresh_token",
    });
    const token = await withRetry(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(OAUTH_TOKEN_URL, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body,
          signal: controller.signal,
        });
        if (!res.ok) {
          // Don't echo the response body — OAuth error bodies can reflect creds.
          const retryable = res.status === 429 || res.status >= 500;
          throw new GoogleAdsError(`OAuth token exchange HTTP ${res.status}`, {
            retryable,
            status: res.status,
          });
        }
        return (await res.json()) as { access_token?: string; expires_in?: number };
      } catch (err) {
        if (err instanceof GoogleAdsError) throw err;
        throw new GoogleAdsError("OAuth token exchange request failed", {
          retryable: true,
          cause: err,
        });
      } finally {
        clearTimeout(timer);
      }
    });

    if (!token.access_token) {
      throw new GoogleAdsError("OAuth token exchange returned no access_token", {
        retryable: false,
      });
    }
    const ttlMs = (token.expires_in ?? 3600) * 1000;
    this.accessToken = token.access_token;
    this.accessTokenExpiresAt = Date.now() + ttlMs - TOKEN_EXPIRY_SKEW_MS;
    return this.accessToken;
  }
}

function resourceNames(res: unknown): string[] {
  const results = (res as { results?: { resourceName?: string }[] })?.results;
  if (!Array.isArray(results)) return [];
  return results
    .map((r) => r.resourceName)
    .filter((n): n is string => typeof n === "string" && n.length > 0);
}

function firstResourceName(res: unknown): string {
  const [name] = resourceNames(res);
  if (!name) {
    throw new GoogleAdsError("mutate response contained no resourceName", {
      retryable: false,
    });
  }
  return name;
}

function truncate(s: string): string {
  return s.length > 300 ? `${s.slice(0, 300)}…` : s;
}
