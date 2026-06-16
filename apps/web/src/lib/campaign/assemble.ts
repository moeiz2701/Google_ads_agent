import {
  type AdGroup,
  type AnalysisObject,
  type BidStrategy,
  type CampaignAd,
  type CampaignConfig,
  type ClientProfile,
  type Keyword,
  type RenderSpec,
} from "@gaa/shared";

/**
 * Module 4 — smart-default campaign assembly (§6).
 *
 * Deterministic (NON-LLM) code that turns a client profile + analysis + the
 * generated creatives into a complete, launch-ready, fully-editable
 * `campaign_config`. The user then configures by exception in the review UI.
 *
 * SUPREME LAW: the budget is copied verbatim from the client profile — the LLM
 * never sets or influences it, and assembly never invents a number. The hard cap
 * (= the agreed profile budget) is enforced in the execution layer (Module 5).
 */

export interface CreativeForAssembly {
  id: string;
  format: "search" | "display";
  spec: RenderSpec;
  insight_ref: string | null;
}

/** Goal → Google Smart Bidding strategy (§6.2). Deterministic mapping. */
export function bidStrategyForGoal(goal: ClientProfile["goal"]): BidStrategy {
  switch (goal) {
    case "leads":
    case "calls":
    case "sales":
      return "maximize_conversions";
    case "traffic":
      return "maximize_clicks";
    case "awareness":
      return "maximize_clicks";
  }
}

const DEFAULT_NEGATIVES = ["free", "cheap", "jobs", "careers", "diy"];

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
  for (const t of a) if (b.has(t)) return true;
  return false;
}

/** Group label cleaned for display, e.g. "gap:same-week" → "Same Week". */
function labelFromInsight(insight: string | null, fallback: string): string {
  if (!insight) return fallback;
  const cleaned = insight.replace(/^(gap|proven|usp)[:\-]?\s*/i, "").trim();
  const words = cleaned.replace(/[_-]+/g, " ").trim();
  if (!words) return fallback;
  return words.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 60);
}

interface DraftGroup {
  name: string;
  insightKey: string;
  ads: CampaignAd[];
  keywords: Keyword[];
}

/**
 * Build ad groups themed by the insight each creative exploits (§6.2). Creatives
 * are grouped by `insight_ref`; if there are none yet, themes come from the
 * analysis (winning angles + gaps) with empty ad slots.
 */
function buildGroups(
  analysis: AnalysisObject,
  creatives: CreativeForAssembly[],
): DraftGroup[] {
  const byInsight = new Map<string, DraftGroup>();

  for (const c of creatives) {
    const key = c.insight_ref ?? "general";
    let g = byInsight.get(key);
    if (!g) {
      g = {
        name: labelFromInsight(c.insight_ref, "Core"),
        insightKey: key,
        ads: [],
        keywords: [],
      };
      byInsight.set(key, g);
    }
    g.ads.push({
      ad_id: c.id,
      spec: c.spec,
      insight_ref: c.insight_ref,
      enabled: true,
    });
  }

  if (byInsight.size === 0) {
    const themes = [
      ...analysis.winning_angles.slice(0, 3).map((a) => a.angle),
      ...analysis.gap_opportunities.slice(0, 2),
    ];
    const seen = new Set<string>();
    for (const t of themes) {
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      byInsight.set(key, {
        name: labelFromInsight(t, "Core"),
        insightKey: key,
        ads: [],
        keywords: [],
      });
    }
  }

  const groups = [...byInsight.values()];
  if (groups.length === 0) {
    groups.push({ name: "Core", insightKey: "general", ads: [], keywords: [] });
  }
  return groups;
}

/**
 * Distribute the analysis keyword seed across groups: assign each seed to the
 * first group whose theme shares a word with it; leftovers are spread
 * round-robin so every seed is used and no seed is duplicated.
 */
function distributeKeywords(groups: DraftGroup[], seed: string[]): void {
  const groupTokens = groups.map((g) => tokens(g.name));
  const leftovers: string[] = [];

  for (const kw of seed) {
    const kwTokens = tokens(kw);
    const idx = groupTokens.findIndex((gt) => overlaps(gt, kwTokens));
    if (idx >= 0) {
      groups[idx]!.keywords.push({ text: kw, match_type: "phrase" });
    } else {
      leftovers.push(kw);
    }
  }

  let i = 0;
  for (const kw of leftovers) {
    const g = groups[i % groups.length]!;
    g.keywords.push({ text: kw, match_type: "phrase" });
    i++;
  }
}

export function assembleCampaign(
  profile: ClientProfile,
  analysis: AnalysisObject,
  creatives: CreativeForAssembly[],
  opts: { now?: Date; analysisId?: string | null } = {},
): CampaignConfig {
  const groups = buildGroups(analysis, creatives);
  distributeKeywords(groups, analysis.keyword_seed ?? []);

  const start = (opts.now ?? new Date()).toISOString().slice(0, 10);

  const ad_groups: AdGroup[] = groups.map((g) => ({
    ad_group_id: crypto.randomUUID(),
    name: g.name,
    keywords: g.keywords,
    negative_keywords: [...DEFAULT_NEGATIVES],
    ads: g.ads,
  }));

  return {
    campaign_id: crypto.randomUUID(),
    client_id: profile.client_id,
    name: `${profile.name} — ${analysis.vertical} (${profile.goal})`,
    status: "draft",
    objective: profile.goal,
    // Budget copied verbatim from the profile — never set by the LLM.
    budget: profile.budget,
    bid_strategy: bidStrategyForGoal(profile.goal),
    networks: ["search", "display"],
    flight_dates: { start, end: null },
    geo: profile.geo,
    languages: ["en"],
    dayparting: null,
    ad_groups,
    analysis_id: opts.analysisId ?? null,
    created_at: null,
    updated_at: null,
  };
}
