import { describe, expect, it } from "vitest";
import {
  CampaignConfig,
  type AnalysisObject,
  type ClientProfile,
  type RenderSpec,
} from "@gaa/shared";
import {
  assembleCampaign,
  bidStrategyForGoal,
  type CreativeForAssembly,
} from "./assemble";

const profile: ClientProfile = {
  client_id: "11111111-1111-1111-1111-111111111111",
  name: "GlowSkin Med Spa",
  website: "https://glowskin.example.com",
  destination_url: "https://glowskin.example.com/botox",
  goal: "leads",
  category: "Medical Spa",
  country: "US",
  budget: { type: "daily", amount: 50, currency: "USD" },
  geo: ["Los Angeles", "Pasadena"],
  competitors: null,
  usp: "same-week board-certified injector appointments",
  offer: null,
  price_positioning: "mid",
  brand_kit: null,
  use_ai_backgrounds: true,
  derived: null,
  created_at: null,
  updated_at: null,
};

const analysis: AnalysisObject = {
  vertical: "med_spa",
  geo: "Los Angeles",
  winning_angles: [{ angle: "board-certified trust", longevity_weight: 1, example_ids: ["a"] }],
  saturated_angles: ["discount %"],
  gap_opportunities: ["same-week availability nobody advertises"],
  common_offers: ["free consult"],
  cta_patterns: ["Book"],
  keyword_seed: ["botox los angeles", "same week botox", "trusted injector la"],
  creative_norms: null,
  persona: "price-aware first-timer",
  source_ad_count: 14,
  generated_at: "2026-06-16T00:00:00Z",
};

const displaySpec: RenderSpec = {
  format: "display",
  template_id: "bold_centered",
  size: "1200x628",
  headline: "Same-Week Botox",
  subhead: null,
  cta: "Book Free Consult",
  palette_ref: null,
  image: null,
  image_treatment: "none",
  angle: "gap:same-week availability nobody advertises",
};

const creatives: CreativeForAssembly[] = [
  { id: "c1", format: "display", spec: displaySpec, insight_ref: "same-week availability nobody advertises" },
  { id: "c2", format: "search", spec: { format: "search", headlines: [{ text: "Same-Week Botox LA", pin: null }, { text: "Board-Certified Care", pin: null }, { text: "Free Consult", pin: null }], descriptions: [{ text: "See a certified injector this week.", pin: null }, { text: "Natural results, free consult.", pin: null }], paths: null, angle: "gap:same-week" }, insight_ref: "same-week availability nobody advertises" },
  { id: "c3", format: "search", spec: { format: "search", headlines: [{ text: "Board-Certified Injectors", pin: null }, { text: "Trusted in LA", pin: null }, { text: "Book Today", pin: null }], descriptions: [{ text: "15+ years experience.", pin: null }, { text: "Free consultation.", pin: null }], paths: null, angle: "proven:trust" }, insight_ref: "board-certified trust" },
];

describe("bidStrategyForGoal", () => {
  it("maps conversion goals to maximize_conversions", () => {
    expect(bidStrategyForGoal("leads")).toBe("maximize_conversions");
    expect(bidStrategyForGoal("calls")).toBe("maximize_conversions");
    expect(bidStrategyForGoal("sales")).toBe("maximize_conversions");
  });
  it("maps traffic/awareness to maximize_clicks", () => {
    expect(bidStrategyForGoal("traffic")).toBe("maximize_clicks");
    expect(bidStrategyForGoal("awareness")).toBe("maximize_clicks");
  });
});

describe("assembleCampaign", () => {
  const cfg = assembleCampaign(profile, analysis, creatives, {
    now: new Date("2026-06-16T12:00:00Z"),
    analysisId: "an-1",
  });

  it("produces a schema-valid draft campaign", () => {
    expect(() => CampaignConfig.parse(cfg)).not.toThrow();
    expect(cfg.status).toBe("draft");
  });

  it("copies the budget verbatim from the profile (LLM never sets it)", () => {
    expect(cfg.budget).toEqual(profile.budget);
  });

  it("derives objective + Smart Bidding from the goal", () => {
    expect(cfg.objective).toBe("leads");
    expect(cfg.bid_strategy).toBe("maximize_conversions");
    expect(cfg.networks).toEqual(["search", "display"]);
  });

  it("groups ads by the insight each creative exploits", () => {
    expect(cfg.ad_groups.length).toBe(2);
    const sameWeek = cfg.ad_groups.find((g) => g.ads.some((a) => a.ad_id === "c1"));
    expect(sameWeek?.ads.map((a) => a.ad_id).sort()).toEqual(["c1", "c2"]);
  });

  it("distributes every keyword seed, none dropped or duplicated", () => {
    const all = cfg.ad_groups.flatMap((g) => g.keywords.map((k) => k.text));
    expect(all.sort()).toEqual([...(analysis.keyword_seed ?? [])].sort());
  });

  it("carries the analysis link and flight start date", () => {
    expect(cfg.analysis_id).toBe("an-1");
    expect(cfg.flight_dates?.start).toBe("2026-06-16");
  });
});
