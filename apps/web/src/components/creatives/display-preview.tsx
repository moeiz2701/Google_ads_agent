"use client";

import { useState } from "react";
import { DISPLAY_SIZES, DISPLAY_TEMPLATE_IDS, type DisplaySize } from "@gaa/shared";

/**
 * Live preview of a Display creative at an actual Google size, rendered on demand
 * by GET /api/creatives/:id/render. The user can switch the size and the template
 * (per-variant control); changing the template PATCHes the creative and re-renders
 * (a `v` cache-bust forces the <img> to reload). A small label states the resolved
 * background source.
 */
const SELECT_CLS =
  "border border-border bg-surface-2 px-2 py-1 font-mono text-[11px] text-ink focus:outline-none focus:border-accent appearance-none";

export function DisplayPreview({
  creativeId,
  templateId,
  sourceLabel,
}: {
  creativeId: string;
  templateId: string;
  sourceLabel?: string;
}) {
  const [size, setSize] = useState<DisplaySize>("1200x628");
  const [tpl, setTpl] = useState(templateId);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [w, h] = size.split("x").map(Number) as [number, number];

  async function changeTemplate(next: string) {
    if (next === tpl || busy) return;
    const prev = tpl;
    setError(null);
    setBusy(true);
    setTpl(next);
    try {
      const res = await fetch(`/api/creatives/${creativeId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template_id: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not change template");
      }
      setVersion((v) => v + 1); // bust the rendered-PNG cache
    } catch (err) {
      setTpl(prev);
      setError(err instanceof Error ? err.message : "Could not change template");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div
        className="flex items-center justify-center overflow-hidden border border-border bg-bg"
        style={{ aspectRatio: `${w} / ${h}`, opacity: busy ? 0.5 : 1 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`${size}-${version}`}
          src={`/api/creatives/${creativeId}/render?size=${size}&v=${version}`}
          alt={`Display creative at ${size}`}
          width={w}
          height={h}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
            Template
          </span>
          <select
            value={tpl}
            disabled={busy}
            onChange={(e) => changeTemplate(e.target.value)}
            className={SELECT_CLS}
            aria-label="Template"
          >
            {DISPLAY_TEMPLATE_IDS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
            Size
          </span>
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as DisplaySize)}
            className={SELECT_CLS}
            aria-label="Size"
          >
            {DISPLAY_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        {sourceLabel && (
          <span className="ml-auto font-mono text-[10px] tracking-[0.05em] text-ink-3">
            {"// bg: "}
            {sourceLabel}
          </span>
        )}
      </div>
      {error && <p className="font-mono text-[11px] text-red">{error}</p>}
    </div>
  );
}
