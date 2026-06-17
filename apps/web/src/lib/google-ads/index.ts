import "server-only";
import { serverEnv } from "@/lib/env";
import { MockGoogleAdsClient } from "./mock";
import { RealGoogleAdsClient } from "./real";
import type { GoogleAdsClient } from "./types";

export type {
  GoogleAdsClient,
  LaunchPlan,
  LaunchResult,
  PlanAdGroup,
  PlanKeyword,
  PlanSearchAd,
  PlanDisplayAd,
  AdvertisingChannel,
} from "./types";
export { GoogleAdsError } from "./types";
export { MockGoogleAdsClient } from "./mock";

let cached: GoogleAdsClient | null = null;

/**
 * Returns the configured Google Ads client. The REAL client is used ONLY when
 * all five test-account credentials are present AND GOOGLE_ADS_USE_MOCK is not
 * true; otherwise the MOCK client (so the launch path is fully exercisable
 * without creds, in CI, and in safe demos). Logs which without leaking secrets.
 */
export function getGoogleAdsClient(): GoogleAdsClient {
  if (cached) return cached;
  const env = serverEnv();

  const creds = {
    developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN,
    clientId: env.GOOGLE_ADS_CLIENT_ID,
    clientSecret: env.GOOGLE_ADS_CLIENT_SECRET,
    refreshToken: env.GOOGLE_ADS_REFRESH_TOKEN,
    loginCustomerId: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  };
  const hasAllCreds = Object.values(creds).every(
    (v) => typeof v === "string" && v.length > 0,
  );

  if (env.GOOGLE_ADS_USE_MOCK || !hasAllCreds) {
    const reason = env.GOOGLE_ADS_USE_MOCK
      ? "GOOGLE_ADS_USE_MOCK=true"
      : "Google Ads credentials incomplete";
    console.info(`[google-ads] using MOCK client (${reason})`);
    cached = new MockGoogleAdsClient();
    return cached;
  }

  console.info("[google-ads] using REAL client (test account)");
  cached = new RealGoogleAdsClient({
    developerToken: creds.developerToken!,
    clientId: creds.clientId!,
    clientSecret: creds.clientSecret!,
    refreshToken: creds.refreshToken!,
    loginCustomerId: creds.loginCustomerId!,
  });
  return cached;
}
