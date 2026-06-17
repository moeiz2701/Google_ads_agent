import { assertValidPlan, digitsOnly } from "./plan";
import type { GoogleAdsClient, LaunchPlan, LaunchResult } from "./types";

/**
 * In-memory Google Ads client used by tests and credential-less runs. Validates
 * the plan with the SAME guard the real client uses, then fabricates
 * deterministic resource names — no network, no secrets, no side effects.
 *
 * Resource-name shape mirrors the real API (`customers/{cid}/...`) so downstream
 * persistence/UI code is exercised identically in mock and real modes.
 */
export class MockGoogleAdsClient implements GoogleAdsClient {
  readonly name = "mock";

  async launchCampaign(plan: LaunchPlan): Promise<LaunchResult> {
    assertValidPlan(plan);

    const cid = digitsOnly(plan.customerId);
    const base = `customers/${cid}`;
    const warnings: string[] = [];

    const budgetResourceName = `${base}/campaignBudgets/mock-budget-1`;
    const campaignResourceName = `${base}/campaigns/mock-1`;

    const adGroupResourceNames: string[] = [];
    const adResourceNames: string[] = [];
    let agSeq = 0;
    let adSeq = 0;
    for (const group of plan.adGroups) {
      agSeq += 1;
      const agName = `${base}/adGroups/mock-${agSeq}`;
      adGroupResourceNames.push(agName);
      for (let i = 0; i < group.searchAds.length; i += 1) {
        adSeq += 1;
        adResourceNames.push(`${base}/adGroupAds/mock-${agSeq}~${adSeq}`);
      }
      if (group.displayAds.length > 0) {
        warnings.push(
          `Ad group "${group.name}": ${group.displayAds.length} Display creative(s) require uploaded image assets and were not created (add manually).`,
        );
      }
    }

    if (plan.channels.length > 1) {
      warnings.push(
        `Plan spans channels ${plan.channels.join(", ")}; the MVP creates one campaign on ${plan.channels[0]} only.`,
      );
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
}
