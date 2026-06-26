"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DISPLAY_TEMPLATE_IDS } from "@gaa/shared";
import { Button } from "@/components/ui/primitives";

/**
 * Generate variants with pre-generation control: how many per format, which
 * formats, and which Display templates the batch may use (a subset of the
 * registry — the generator still selects per variant, this just bounds the set).
 */
type Format = "search" | "display";

export function GeneratePanel({
  clientId,
  disabled,
  hasCreatives,
}: {
  clientId: string;
  disabled: boolean;
  hasCreatives: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nPerFormat, setNPerFormat] = useState(3);
  const [formats, setFormats] = useState<Format[]>(["search", "display"]);
  const [templates, setTemplates] = useState<string[]>([...DISPLAY_TEMPLATE_IDS]);

  const toggle = <T,>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const displayOn = formats.includes("display");

  async function run() {
    setError(null);
    setRunning(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nPerFormat,
          formats: formats.length ? formats : ["search", "display"],
          // Only send an allowlist when it's a real subset (empty handled as "all").
          allowedTemplates:
            displayOn && templates.length && templates.length < DISPLAY_TEMPLATE_IDS.length
              ? templates
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3">
        {!disabled && (
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide options" : "Options"}
          </Button>
        )}
        <Button
          onClick={run}
          disabled={running || disabled || formats.length === 0}
          variant={hasCreatives ? "secondary" : "primary"}
          title={disabled ? "Run competitor analysis first" : undefined}
        >
          {running ? "Generating…" : hasCreatives ? "Generate more" : "Generate variants"}
        </Button>
      </div>

      {open && !disabled && (
        <div className="w-full max-w-md border border-border bg-surface p-4 space-y-4 text-left">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              Per format
            </span>
            <input
              type="number"
              min={1}
              max={10}
              value={nPerFormat}
              onChange={(e) => setNPerFormat(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
              className="w-16 border border-border bg-surface-2 px-2 py-1 font-mono text-sm text-ink focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              {"// Formats"}
            </p>
            <div className="flex gap-4">
              {(["search", "display"] as Format[]).map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm text-ink-2">
                  <input
                    type="checkbox"
                    checked={formats.includes(f)}
                    onChange={() => setFormats((l) => toggle(l, f))}
                  />
                  {f}
                </label>
              ))}
            </div>
          </div>

          <div className={displayOn ? "" : "opacity-40"}>
            <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              {"// Display templates"}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {DISPLAY_TEMPLATE_IDS.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm text-ink-2">
                  <input
                    type="checkbox"
                    checked={templates.includes(t)}
                    disabled={!displayOn}
                    onChange={() => setTemplates((l) => toggle(l, t))}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <span className="font-mono text-[11px] text-red">{error}</span>}
    </div>
  );
}
