import { GoogleAdsError, type LaunchPlan } from "./types";

/**
 * Strip everything but digits from a customer/manager id. The Google Ads API
 * rejects dashes in `customers/{id}` paths and the `login-customer-id` header
 * (GOOGLE_ADS_SETUP.md). Defensive against the dashed form users paste in.
 */
export function digitsOnly(id: string): string {
  return id.replace(/\D/g, "");
}

/**
 * Last-line structural validation a client runs before touching the network /
 * fabricating resource names. The execution layer already enforces the business
 * rules (budget cap, policy, ≥1 enabled ad); this guards the API contract so a
 * malformed plan fails fast and locally rather than as an opaque 400 mid-mutate.
 */
export function assertValidPlan(plan: LaunchPlan): void {
  const cid = digitsOnly(plan.customerId);
  if (cid.length < 8 || cid.length > 12) {
    throw new GoogleAdsError(
      `customerId must be a 10-digit Google Ads account id (got ${plan.customerId.length} chars)`,
      { retryable: false },
    );
  }
  if (!plan.campaignName.trim()) {
    throw new GoogleAdsError("campaignName is required", { retryable: false });
  }
  if (plan.channels.length === 0) {
    throw new GoogleAdsError("plan has no advertising channels", {
      retryable: false,
    });
  }
  if (!Number.isInteger(plan.budgetMicros) || plan.budgetMicros <= 0) {
    throw new GoogleAdsError(
      `budgetMicros must be a positive integer (got ${plan.budgetMicros})`,
      { retryable: false },
    );
  }
  if (plan.adGroups.length === 0) {
    throw new GoogleAdsError("plan has no ad groups", { retryable: false });
  }
  for (const g of plan.adGroups) {
    if (!g.name.trim()) {
      throw new GoogleAdsError("ad group is missing a name", {
        retryable: false,
      });
    }
  }
  const adCount = plan.adGroups.reduce(
    (n, g) => n + g.searchAds.length + g.displayAds.length,
    0,
  );
  if (adCount === 0) {
    throw new GoogleAdsError("plan has no ads across any ad group", {
      retryable: false,
    });
  }
}
