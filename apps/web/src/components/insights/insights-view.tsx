import type { AnalysisObject } from "@gaa/shared";
import { Card } from "@/components/ui/primitives";

/**
 * Renders an AnalysisObject (§9.8 Insights, MVP slice). The gap_opportunities
 * are the strategic payload — surfaced first and prominently.
 */
export function InsightsView({ analysis }: { analysis: AnalysisObject }) {
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-sm font-semibold">Gap opportunities</h3>
        <p className="mb-3 text-xs text-muted">
          Angles no competitor is advertising — what generation will exploit.
        </p>
        {analysis.gap_opportunities.length === 0 ? (
          <p className="text-sm text-muted">None identified.</p>
        ) : (
          <ul className="space-y-1.5">
            {analysis.gap_opportunities.map((g) => (
              <li key={g} className="flex gap-2 text-sm">
                <span className="text-success">◆</span>
                {g}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold">
          Winning angles{" "}
          <span className="font-normal text-muted">(longevity-weighted)</span>
        </h3>
        {analysis.winning_angles.length === 0 ? (
          <p className="text-sm text-muted">No surviving angles ranked.</p>
        ) : (
          <ul className="space-y-2">
            {analysis.winning_angles.map((a) => (
              <li key={a.angle} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{a.angle}</span>
                  <span className="text-xs text-muted">
                    {Math.round(a.longevity_weight * 100)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round(a.longevity_weight * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-sm font-semibold">Saturated angles</h3>
          <TagList items={analysis.saturated_angles} empty="None" />
        </Card>
        <Card>
          <h3 className="mb-2 text-sm font-semibold">Common offers</h3>
          <TagList items={analysis.common_offers} empty="None" />
        </Card>
        <Card>
          <h3 className="mb-2 text-sm font-semibold">CTA patterns</h3>
          <TagList items={analysis.cta_patterns} empty="None" />
        </Card>
        <Card>
          <h3 className="mb-2 text-sm font-semibold">Keyword seed</h3>
          <TagList items={analysis.keyword_seed} empty="None" />
        </Card>
      </div>

      {analysis.persona && (
        <Card>
          <h3 className="mb-1 text-sm font-semibold">Persona</h3>
          <p className="text-sm text-muted">{analysis.persona}</p>
        </Card>
      )}
    </div>
  );
}

function TagList({ items, empty }: { items: string[] | null; empty: string }) {
  if (!items || items.length === 0)
    return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span
          key={it}
          className="rounded-full border border-border px-2.5 py-0.5 text-xs"
        >
          {it}
        </span>
      ))}
    </div>
  );
}
