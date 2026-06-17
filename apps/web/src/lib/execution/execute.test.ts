import { describe, expect, it } from "vitest";
import type {
  CampaignConfig,
  ClientProfile,
  RenderSpec,
} from "@gaa/shared";
import { MockGoogleAdsClient } from "@/lib/google-ads";
import type { LaunchPlan } from "@/lib/google-ads";
import { executeLaunch } from "./execute";
import { postLaunchStatus } from "./status";
import { PolicyError, ValidationError } from "./errors";

const profile: ClientProfile = {
  client_id: "11111111-1111-1111-1111-111111111111",
  name: "GlowSkin Med Spa",
  website: "https://glowskin.example.com",
  destination_url: "https://glowskin.example.com/botox",
  goal: "leads",
  budget: { type: "daily", amount: 50, currency: "USD" },
  geo: ["Los Angeles", "Pasadena"],
  competitors: null,
  usp: "same-week board-certified injector appointments",
  offer: null,
  price_positioning: "mid",
  brand_kit: {
    logo_url: null,
    palette: null,
    fonts: null,
    tone: "clinical-reassuring",
    do_not_use: ["before/after"],
  },
  derived: null,
  created_at: null,
  updated_at: null,
};

const cleanSearch: RenderSpec = {
  format: "search",
  headlines: [
    { text: "Same-Week Botox in LA", pin: null },
    { text: "Board-Certified Injectors", pin: null },
    { text: "Free Consultation", pin: null },
  ],
  descriptions: [
    { text: "See a certified injector this week.", pin: null },
    { text: "Natural results, free consult.", pin: null },
  ],
  paths: ["botox", null],
  angle: "gap:same-week",
};

const cleanDisplay: RenderSpec = {
  format: "display",
  template_id: "bold_centered",
  size: "1200x628",
  headline: "Same-Week Botox",
  subhead: "Board-certified injectors",
  cta: "Book Free Consult",
  palette_ref: null,
  image: null,
  angle: "gap:same-week",
};

/** Deep clone so per-test mutation can never leak into another test. */
function clone<T>(v: T): T {
  return structuredClone(v);
}

function baseConfig(overrides: Partial<CampaignConfig> = {}): CampaignConfig {
  return {
    campaign_id: "22222222-2222-2222-2222-222222222222",
    client_id: profile.client_id,
    name: "GlowSkin — med_spa (leads)",
    status: "draft",
    objective: "leads",
    budget: { type: "daily", amount: 50, currency: "USD" },
    bid_strategy: "maximize_conversions",
    networks: ["search", "display"],
    flight_dates: { start: "2026-06-16", end: null },
    geo: ["Los Angeles"],
    languages: ["en"],
    dayparting: null,
    ad_groups: [
      {
        ad_group_id: "33333333-3333-3333-3333-333333333333",
        name: "Same Week",
        keywords: [{ text: "same week botox", match_type: "phrase" }],
        negative_keywords: ["free", "cheap"],
        ads: [
          { ad_id: "c1", spec: clone(cleanSearch), insight_ref: "gap:same-week", enabled: true },
          { ad_id: "c2", spec: clone(cleanDisplay), insight_ref: "gap:same-week", enabled: true },
        ],
      },
    ],
    analysis_id: "an-1",
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

const CID = "1234567890";

describe("executeLaunch — budget cap (supreme rule)", () => {
  it("caps the launch budget at the client-profile amount, in micros", async () => {
    // Config asks for 500/day; the agreed client cap is 50/day.
    const cfg = baseConfig({ budget: { type: "daily", amount: 500, currency: "USD" } });
    let captured: LaunchPlan | undefined;
    const client = new MockGoogleAdsClient();
    const orig = client.launchCampaign.bind(client);
    client.launchCampaign = async (plan) => {
      captured = plan;
      return orig(plan);
    };

    await executeLaunch(cfg, profile, { client, customerId: CID });

    expect(captured?.budgetMicros).toBe(50 * 1_000_000);
  });

  it("uses the config amount when it is below the cap", async () => {
    const cfg = baseConfig({ budget: { type: "daily", amount: 20, currency: "USD" } });
    let captured: LaunchPlan | undefined;
    const client = new MockGoogleAdsClient();
    const orig = client.launchCampaign.bind(client);
    client.launchCampaign = async (plan) => {
      captured = plan;
      return orig(plan);
    };

    await executeLaunch(cfg, profile, { client, customerId: CID });

    expect(captured?.budgetMicros).toBe(20 * 1_000_000);
  });
});

describe("executeLaunch — policy gate", () => {
  it("blocks a banned superlative with a PolicyError", async () => {
    const badSearch: RenderSpec = {
      ...cleanSearch,
      headlines: [
        { text: "Best Botox Guaranteed", pin: null },
        { text: "Board-Certified Injectors", pin: null },
        { text: "Free Consultation", pin: null },
      ],
    };
    const cfg = baseConfig();
    cfg.ad_groups[0]!.ads[0]!.spec = badSearch;

    await expect(
      executeLaunch(cfg, profile, { client: new MockGoogleAdsClient(), customerId: CID }),
    ).rejects.toBeInstanceOf(PolicyError);
  });

  it("flags a brand do_not_use term", async () => {
    const cfg = baseConfig();
    (cfg.ad_groups[0]!.ads[1]!.spec as { headline: string }).headline =
      "Before/After Results";
    await expect(
      executeLaunch(cfg, profile, { client: new MockGoogleAdsClient(), customerId: CID }),
    ).rejects.toBeInstanceOf(PolicyError);
  });

  it("passes clean ads", async () => {
    const result = await executeLaunch(baseConfig(), profile, {
      client: new MockGoogleAdsClient(),
      customerId: CID,
    });
    expect(result.campaignResourceName).toContain("campaigns/");
  });

  it("ignores disabled ads when scanning for policy violations", async () => {
    const badSearch: RenderSpec = {
      ...cleanSearch,
      headlines: [
        { text: "Cheapest Botox #1", pin: null },
        { text: "Board-Certified", pin: null },
        { text: "Free Consult", pin: null },
      ],
    };
    const cfg = baseConfig();
    // bad ad is DISABLED → should not block; the clean display ad keeps it launchable.
    cfg.ad_groups[0]!.ads[0]! = {
      ad_id: "bad",
      spec: badSearch,
      insight_ref: null,
      enabled: false,
    };
    const result = await executeLaunch(cfg, profile, {
      client: new MockGoogleAdsClient(),
      customerId: CID,
    });
    expect(result.campaignResourceName).toBeTruthy();
  });
});

describe("executeLaunch — enabled-only plan", () => {
  it("drops disabled variants from the plan", async () => {
    const cfg = baseConfig();
    cfg.ad_groups[0]!.ads[1]!.enabled = false; // disable the display ad
    let captured: LaunchPlan | undefined;
    const client = new MockGoogleAdsClient();
    const orig = client.launchCampaign.bind(client);
    client.launchCampaign = async (plan) => {
      captured = plan;
      return orig(plan);
    };

    await executeLaunch(cfg, profile, { client, customerId: CID });

    const group = captured!.adGroups[0]!;
    expect(group.searchAds.length).toBe(1);
    expect(group.displayAds.length).toBe(0);
  });

  it("rejects a campaign with no enabled ads", async () => {
    const cfg = baseConfig();
    cfg.ad_groups[0]!.ads.forEach((a) => (a.enabled = false));
    await expect(
      executeLaunch(cfg, profile, { client: new MockGoogleAdsClient(), customerId: CID }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("executeLaunch — mock result shape", () => {
  it("returns a well-formed LaunchResult", async () => {
    const result = await executeLaunch(baseConfig(), profile, {
      client: new MockGoogleAdsClient(),
      customerId: CID,
    });
    expect(result.customerId).toBe(CID);
    expect(result.campaignResourceName).toBe(`customers/${CID}/campaigns/mock-1`);
    expect(result.budgetResourceName).toContain("campaignBudgets/");
    expect(result.adGroupResourceNames.length).toBe(1);
    expect(result.adResourceNames.length).toBe(1); // one search ad → one adGroupAd
    // display ad present → warning that it needs manual image upload
    expect(result.warnings.some((w) => w.includes("Display"))).toBe(true);
  });
});

describe("postLaunchStatus", () => {
  const now = new Date("2026-06-17T00:00:00Z");
  it("returns scheduled when the flight start is in the future", () => {
    expect(postLaunchStatus({ start: "2026-07-01", end: null }, now)).toBe("scheduled");
  });
  it("returns running when the flight start is in the past or today", () => {
    expect(postLaunchStatus({ start: "2026-06-01", end: null }, now)).toBe("running");
    expect(postLaunchStatus({ start: "2026-06-17", end: null }, now)).toBe("running");
  });
  it("returns running when there is no start date", () => {
    expect(postLaunchStatus(null, now)).toBe("running");
    expect(postLaunchStatus({ start: null, end: null }, now)).toBe("running");
  });
});
