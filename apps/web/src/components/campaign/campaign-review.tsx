"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AdNetwork,
  BidStrategy,
  CampaignConfig,
  CampaignGoal,
  KeywordMatchType,
  RenderSpec,
} from "@gaa/shared";
import {
  Button,
  Card,
  Field,
  Input,
  SectionTitle,
  Select,
} from "@/components/ui/primitives";
import { DisplayPreview } from "@/components/creatives/display-preview";

const GOALS: CampaignGoal[] = ["leads", "calls", "sales", "traffic", "awareness"];
const BID_STRATEGIES: BidStrategy[] = [
  "maximize_conversions",
  "target_cpa",
  "maximize_clicks",
  "target_roas",
  "manual_cpc",
];
const MATCH_TYPES: KeywordMatchType[] = ["broad", "phrase", "exact"];
const NETWORKS: AdNetwork[] = ["search", "display"];

function adLabel(spec: RenderSpec): string {
  return spec.format === "display"
    ? `Display · ${spec.template_id} · ${spec.headline}`
    : `Search · ${spec.headlines[0]?.text ?? "RSA"}`;
}

export function CampaignReview({
  initial,
  budgetCap,
}: {
  initial: CampaignConfig;
  budgetCap: number;
}) {
  const router = useRouter();
  const [c, setC] = useState<CampaignConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<CampaignConfig>) =>
    setC((prev) => ({ ...prev, ...patch }));

  const enabledAds = useMemo(
    () => c.ad_groups.reduce((n, g) => n + g.ads.filter((a) => a.enabled).length, 0),
    [c.ad_groups],
  );
  const totalKeywords = useMemo(
    () => c.ad_groups.reduce((n, g) => n + g.keywords.length, 0),
    [c.ad_groups],
  );

  function setGroup(idx: number, patch: Partial<CampaignConfig["ad_groups"][number]>) {
    setC((prev) => {
      const ad_groups = prev.ad_groups.map((g, i) => (i === idx ? { ...g, ...patch } : g));
      return { ...prev, ad_groups };
    });
  }

  async function save() {
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/campaigns/${c.campaign_id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(c),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setC(data.campaign);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Campaign-level settings */}
      <Card>
        <SectionTitle description="Smart defaults from the analysis — edit by exception.">
          Campaign settings
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="cname">
            <Input id="cname" value={c.name} onChange={(e) => update({ name: e.target.value })} />
          </Field>
          <Field label="Objective" htmlFor="obj">
            <Select
              id="obj"
              value={c.objective}
              onChange={(e) => update({ objective: e.target.value as CampaignGoal })}
            >
              {GOALS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bid strategy" htmlFor="bid">
            <Select
              id="bid"
              value={c.bid_strategy}
              onChange={(e) => update({ bid_strategy: e.target.value as BidStrategy })}
            >
              {BID_STRATEGIES.map((b) => (
                <option key={b} value={b}>
                  {b.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Networks" htmlFor="net">
            <div className="flex gap-4 pt-2">
              {NETWORKS.map((n) => (
                <label key={n} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={c.networks.includes(n)}
                    onChange={(e) =>
                      update({
                        networks: e.target.checked
                          ? [...new Set([...c.networks, n])]
                          : c.networks.filter((x) => x !== n),
                      })
                    }
                  />
                  {n}
                </label>
              ))}
            </div>
          </Field>
          <Field
            label={`Daily budget (cap $${budgetCap})`}
            htmlFor="budget"
            hint="The LLM never sets this. Editable up to the agreed cap."
          >
            <div className="flex items-center gap-3">
              <input
                id="budget"
                type="range"
                min={1}
                max={budgetCap}
                step={1}
                value={c.budget.amount}
                onChange={(e) =>
                  update({ budget: { ...c.budget, amount: Number(e.target.value) } })
                }
                className="flex-1"
              />
              <span className="w-20 text-right text-sm tabular-nums">
                ${c.budget.amount}/{c.budget.currency}
              </span>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Flight start" htmlFor="start">
              <Input
                id="start"
                type="date"
                value={c.flight_dates?.start ?? ""}
                onChange={(e) =>
                  update({ flight_dates: { start: e.target.value || null, end: c.flight_dates?.end ?? null } })
                }
              />
            </Field>
            <Field label="Flight end" htmlFor="end">
              <Input
                id="end"
                type="date"
                value={c.flight_dates?.end ?? ""}
                onChange={(e) =>
                  update({ flight_dates: { start: c.flight_dates?.start ?? null, end: e.target.value || null } })
                }
              />
            </Field>
          </div>
          <Field label="Geo" htmlFor="geo" hint="Comma-separated">
            <Input
              id="geo"
              value={c.geo.join(", ")}
              onChange={(e) => update({ geo: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
            />
          </Field>
        </div>
      </Card>

      {/* Ad groups */}
      {c.ad_groups.map((g, gi) => (
        <Card key={g.ad_group_id} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Input
              value={g.name}
              onChange={(e) => setGroup(gi, { name: e.target.value })}
              className="max-w-xs font-medium"
            />
            <span className="text-xs text-muted">
              {g.ads.length} ad{g.ads.length === 1 ? "" : "s"} · {g.keywords.length} keyword
              {g.keywords.length === 1 ? "" : "s"}
            </span>
          </div>

          {/* Keywords */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Keywords</p>
            <div className="space-y-1.5">
              {g.keywords.map((kw, ki) => (
                <div key={ki} className="flex items-center gap-2">
                  <Input
                    value={kw.text}
                    onChange={(e) => {
                      const keywords = g.keywords.map((k, i) =>
                        i === ki ? { ...k, text: e.target.value } : k,
                      );
                      setGroup(gi, { keywords });
                    }}
                  />
                  <Select
                    value={kw.match_type}
                    onChange={(e) => {
                      const keywords = g.keywords.map((k, i) =>
                        i === ki ? { ...k, match_type: e.target.value as KeywordMatchType } : k,
                      );
                      setGroup(gi, { keywords });
                    }}
                    className="w-28"
                  >
                    {MATCH_TYPES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setGroup(gi, { keywords: g.keywords.filter((_, i) => i !== ki) })}
                    className="px-2 text-danger"
                    aria-label="Remove keyword"
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setGroup(gi, { keywords: [...g.keywords, { text: "", match_type: "phrase" }] })
                }
                className="mt-1"
              >
                + Add keyword
              </Button>
            </div>
          </div>

          {/* Negatives */}
          <Field label="Negative keywords" htmlFor={`neg-${gi}`} hint="Comma-separated">
            <Input
              id={`neg-${gi}`}
              value={(g.negative_keywords ?? []).join(", ")}
              onChange={(e) =>
                setGroup(gi, {
                  negative_keywords: e.target.value.split(",").map((x) => x.trim()).filter(Boolean),
                })
              }
            />
          </Field>

          {/* Ads (variant toggles) */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Variants (toggle which launch)</p>
            <div className="space-y-3">
              {g.ads.length === 0 && (
                <p className="text-sm text-muted">No variants in this group yet.</p>
              )}
              {g.ads.map((ad, ai) => {
                const toggle = (enabled: boolean) =>
                  setGroup(gi, {
                    ads: g.ads.map((a, i) => (i === ai ? { ...a, enabled } : a)),
                  });
                return (
                  <div key={ad.ad_id} className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={ad.enabled}
                        onChange={(e) => toggle(e.target.checked)}
                      />
                      <span className={ad.enabled ? "" : "text-muted line-through"}>
                        {adLabel(ad.spec)}
                      </span>
                    </label>
                    {ad.spec.format === "display" && (
                      <div className={`max-w-sm ${ad.enabled ? "" : "opacity-40"}`}>
                        <DisplayPreview creativeId={ad.ad_id} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      ))}

      {/* What will launch */}
      <Card>
        <SectionTitle>What will launch</SectionTitle>
        <ul className="space-y-1 text-sm text-muted">
          <li>Objective: {c.objective} · bid: {c.bid_strategy.replace(/_/g, " ")}</li>
          <li>
            Budget: ${c.budget.amount}/{c.budget.currency} {c.budget.type}{" "}
            {c.budget.amount >= budgetCap && <span className="text-fg">(at cap)</span>}
          </li>
          <li>Networks: {c.networks.join(", ")}</li>
          <li>
            {c.ad_groups.length} ad groups · {totalKeywords} keywords · {enabledAds} variants live
          </li>
          <li>
            Flight: {c.flight_dates?.start ?? "—"} → {c.flight_dates?.end ?? "open"}
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted">
          Approval &amp; launch to the Google Ads test account is wired in Phase 7.
        </p>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-success">Saved</span>}
        {error && <span className="text-sm text-danger">{error}</span>}
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
