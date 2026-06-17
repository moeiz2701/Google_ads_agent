import { describe, expect, it } from "vitest";
import { MockGoogleAdsClient } from "./mock";
import { GoogleAdsError, type LaunchPlan } from "./types";

function plan(overrides: Partial<LaunchPlan> = {}): LaunchPlan {
  return {
    customerId: "123-456-7890",
    campaignName: "Test Campaign",
    channels: ["SEARCH"],
    biddingStrategy: "maximize_conversions",
    budgetMicros: 50_000_000,
    geo: ["Los Angeles"],
    adGroups: [
      {
        name: "Core",
        keywords: [{ text: "botox la", matchType: "phrase" }],
        negativeKeywords: ["free"],
        searchAds: [
          {
            headlines: ["Same-Week Botox", "Board-Certified", "Free Consult"],
            descriptions: ["See a certified injector.", "Free consult."],
            paths: ["botox", null],
          },
        ],
        displayAds: [],
      },
    ],
    ...overrides,
  };
}

describe("MockGoogleAdsClient", () => {
  it("strips dashes from the customer id in resource names", async () => {
    const res = await new MockGoogleAdsClient().launchCampaign(plan());
    expect(res.customerId).toBe("1234567890");
    expect(res.campaignResourceName).toBe("customers/1234567890/campaigns/mock-1");
  });

  it("emits one adGroupAd resource per search ad", async () => {
    const res = await new MockGoogleAdsClient().launchCampaign(plan());
    expect(res.adGroupResourceNames.length).toBe(1);
    expect(res.adResourceNames.length).toBe(1);
  });

  it("warns (does not fail) when display creatives are present", async () => {
    const p = plan();
    p.adGroups[0]!.displayAds = [
      { templateId: "bold_centered", headline: "H", subhead: null, cta: "Book" },
    ];
    const res = await new MockGoogleAdsClient().launchCampaign(p);
    expect(res.warnings.some((w) => w.includes("Display"))).toBe(true);
  });

  it("rejects a plan with a non-positive budget", async () => {
    await expect(
      new MockGoogleAdsClient().launchCampaign(plan({ budgetMicros: 0 })),
    ).rejects.toBeInstanceOf(GoogleAdsError);
  });

  it("rejects a plan with no ads", async () => {
    const p = plan();
    p.adGroups[0]!.searchAds = [];
    await expect(
      new MockGoogleAdsClient().launchCampaign(p),
    ).rejects.toBeInstanceOf(GoogleAdsError);
  });
});
