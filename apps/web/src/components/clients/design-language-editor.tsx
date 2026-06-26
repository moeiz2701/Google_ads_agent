"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type BrandKit, emptyBrandKit } from "@gaa/shared";
import { Button, Card, Field, Input, SectionTitle } from "@/components/ui/primitives";

/**
 * Editable design language (brand kit) + the AI-background toggle. Saved via
 * PATCH /api/clients/:id and read live at render time, so edits here immediately
 * change creative previews and the next generation's brief. Edit BEFORE generating.
 */
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

type PaletteKey = "primary" | "accent" | "neutral" | "text";
const PALETTE_KEYS: PaletteKey[] = ["primary", "accent", "neutral", "text"];

export function DesignLanguageEditor({
  clientId,
  initial,
  initialUseAi,
  aiConfigured,
}: {
  clientId: string;
  initial: BrandKit | null;
  initialUseAi: boolean;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const base = initial ?? emptyBrandKit();
  const [logoUrl, setLogoUrl] = useState(base.logo_url ?? "");
  const [palette, setPalette] = useState({
    primary: base.palette?.primary ?? "",
    accent: base.palette?.accent ?? "",
    neutral: base.palette?.neutral ?? "",
    text: base.palette?.text ?? "",
  });
  const [heading, setHeading] = useState(base.fonts?.heading ?? "");
  const [body, setBody] = useState(base.fonts?.body ?? "");
  const [tone, setTone] = useState(base.tone ?? "");
  const [doNotUse, setDoNotUse] = useState((base.do_not_use ?? []).join(", "));
  const [useAi, setUseAi] = useState(initialUseAi);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const hexOrNull = (v: string) => (HEX_RE.test(v.trim()) ? v.trim() : null);

  async function save() {
    setError(null);
    setSaved(false);
    setSaving(true);
    // Preserve any discovered self-hosted font URLs; the form edits the family names.
    const brand_kit: BrandKit = {
      logo_url: logoUrl.trim() || null,
      palette: {
        primary: hexOrNull(palette.primary),
        accent: hexOrNull(palette.accent),
        neutral: hexOrNull(palette.neutral),
        text: hexOrNull(palette.text),
      },
      fonts: {
        heading: heading.trim() || null,
        body: body.trim() || null,
        heading_url: base.fonts?.heading_url ?? null,
        body_url: base.fonts?.body_url ?? null,
      },
      tone: tone.trim() || null,
      do_not_use: doNotUse.split(",").map((s) => s.trim()).filter(Boolean),
    };
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brand_kit, use_ai_backgrounds: useAi }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <SectionTitle description="Colors, fonts, logo & tone applied to every creative. Edit before generating.">
          Design Language
        </SectionTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : "Edit"}
        </Button>
      </div>

      {open && (
        <div className="space-y-5 pt-2">
          {/* Palette */}
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-3">
              {"// Palette"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {PALETTE_KEYS.map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={`${k} color`}
                    value={HEX_RE.test(palette[k]) ? palette[k] : "#000000"}
                    onChange={(e) => setPalette((p) => ({ ...p, [k]: e.target.value }))}
                    className="h-9 w-10 shrink-0 border border-border bg-surface-2"
                  />
                  <Input
                    aria-label={`${k} hex`}
                    placeholder={`${k} (#RRGGBB)`}
                    value={palette[k]}
                    onChange={(e) => setPalette((p) => ({ ...p, [k]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Heading font" htmlFor="dl-heading" hint="Google Fonts family, or a self-hosted family detected from the site.">
              <Input id="dl-heading" value={heading} onChange={(e) => setHeading(e.target.value)} placeholder="e.g. Poppins" />
            </Field>
            <Field label="Body font" htmlFor="dl-body">
              <Input id="dl-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="e.g. Inter" />
            </Field>
            <Field label="Logo URL" htmlFor="dl-logo" hint="PNG/JPEG renders in creatives; SVG shows here only.">
              <Input id="dl-logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" />
            </Field>
            <Field label="Tone" htmlFor="dl-tone">
              <Input id="dl-tone" value={tone} onChange={(e) => setTone(e.target.value)} placeholder="e.g. clinical-reassuring" />
            </Field>
          </div>

          <Field label="Do not use" htmlFor="dl-dnu" hint="Comma-separated brand guardrails the critique also enforces.">
            <Input id="dl-dnu" value={doNotUse} onChange={(e) => setDoNotUse(e.target.value)} placeholder="e.g. before/after imagery, price-led claims" />
          </Field>

          {/* AI backgrounds */}
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={useAi}
              onChange={(e) => setUseAi(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-ink-2">
              Use AI-generated backgrounds
              <span className="block font-mono text-[11px] text-ink-3">
                {aiConfigured
                  ? "// Generates a bespoke backdrop per creative (cached). Off → stock/gradient."
                  : "// IMAGE_GEN not configured — has no effect until a provider + key are set."}
              </span>
            </span>
          </label>

          <div className="flex items-center justify-end gap-3">
            {saved && <span className="font-mono text-[11px] text-green">Saved</span>}
            {error && <span className="font-mono text-[11px] text-red">{error}</span>}
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save design language"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
