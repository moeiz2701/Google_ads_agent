import type { CreativeRecord } from "@/lib/db/creatives";
import { Card } from "@/components/ui/primitives";
import { DisplayPreview } from "./display-preview";

/**
 * One generated variant. Search variants show their RSA assets as text (no
 * canvas); Display variants show the rendered PNG with size + per-variant template
 * controls and the resolved background source.
 */

/** Indicative label for where a Display creative's background comes from — derived
 *  from the spec + client setting (no extra render, so AI isn't re-billed). */
function backgroundSource(
  spec: Extract<CreativeRecord["spec"], { format: "display" }>,
  aiBackgroundsActive: boolean,
): string {
  if (spec.image?.url) return "preset image";
  if (!spec.image?.query) return "brand gradient";
  return aiBackgroundsActive ? "AI-generated" : "stock photo";
}

export function CreativeCard({
  creative,
  aiBackgroundsActive,
}: {
  creative: CreativeRecord;
  aiBackgroundsActive: boolean;
}) {
  const { spec } = creative;
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
          {spec.format}
        </span>
        {creative.insight_ref && (
          <span
            className="truncate font-mono text-[11px] text-accent"
            title="Insight this variant exploits"
          >
            ◆ {creative.insight_ref}
          </span>
        )}
      </div>

      {spec.format === "search" ? (
        <div className="space-y-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
              Headlines
            </p>
            <ul className="mt-1 space-y-0.5 text-sm text-ink-2">
              {spec.headlines.slice(0, 6).map((h, i) => (
                <li key={i} className="truncate">
                  {h.text}
                  {h.pin && <span className="text-ink-3"> · pin {h.pin}</span>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
              Descriptions
            </p>
            <ul className="mt-1 space-y-0.5 text-sm text-ink-3">
              {spec.descriptions.map((d, i) => (
                <li key={i}>{d.text}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <DisplayPreview
            creativeId={creative.id}
            templateId={spec.template_id}
            sourceLabel={backgroundSource(spec, aiBackgroundsActive)}
          />
          <p className="font-mono text-[11px] tracking-[0.05em] text-ink-3">
            {spec.headline} · CTA: {spec.cta}
          </p>
        </div>
      )}
    </Card>
  );
}
