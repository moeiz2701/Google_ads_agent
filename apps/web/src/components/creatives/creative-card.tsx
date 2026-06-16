import type { CreativeRecord } from "@/lib/db/creatives";
import { Card } from "@/components/ui/primitives";

/**
 * Text preview of a generated render-spec. Actual pixel rendering (Satori
 * templates / RSA preview) lands in Phase 4 — for now we show the structured
 * content and which insight/gap it exploits (§9.8 traceability).
 */
export function CreativeCard({ creative }: { creative: CreativeRecord }) {
  const { spec } = creative;
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="rounded-full border border-border px-2 py-0.5 text-xs uppercase tracking-wide text-muted">
          {spec.format}
        </span>
        {creative.insight_ref && (
          <span className="text-xs text-success" title="Insight this variant exploits">
            ◆ {creative.insight_ref}
          </span>
        )}
      </div>

      {spec.format === "search" ? (
        <div className="space-y-2">
          <div>
            <p className="text-xs font-medium text-muted">Headlines</p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {spec.headlines.slice(0, 6).map((h, i) => (
                <li key={i} className="truncate">
                  {h.text}
                  {h.pin && <span className="text-muted"> · pin {h.pin}</span>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted">Descriptions</p>
            <ul className="mt-1 space-y-0.5 text-sm text-muted">
              {spec.descriptions.map((d, i) => (
                <li key={i}>{d.text}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex aspect-[1200/628] items-center justify-center rounded-md border border-dashed border-border bg-bg text-xs text-muted">
            {spec.template_id} · {spec.size}
          </div>
          <p className="text-sm font-medium">{spec.headline}</p>
          {spec.subhead && <p className="text-sm text-muted">{spec.subhead}</p>}
          <span className="inline-block rounded-md bg-primary px-3 py-1 text-xs text-primary-fg">
            {spec.cta}
          </span>
        </div>
      )}
    </Card>
  );
}
