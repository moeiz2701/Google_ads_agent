"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BrandKit,
  CampaignGoal,
  ClientProfileInput,
  DerivedProfile,
  PricePositioning,
} from "@gaa/shared";
import { BUSINESS_CATEGORY_GROUPS, COUNTRIES, DEFAULT_COUNTRY } from "@gaa/shared";
import {
  Button,
  Card,
  Field,
  Input,
  SectionTitle,
  Select,
  Textarea,
} from "@/components/ui/primitives";

// Sentinel <Select> value for the "type my own category" path.
const CATEGORY_OTHER = "__other__";

type ExtractResponse = {
  suggested_name: string | null;
  category: string | null;
  derived: DerivedProfile;
  brand_kit: Pick<BrandKit, "palette" | "fonts" | "tone">;
  logo_url: string | null;
};

const GOALS: CampaignGoal[] = ["leads", "calls", "sales", "traffic", "awareness"];
const POSITIONING: PricePositioning[] = ["premium", "mid", "budget"];

const csvToArray = (s: string): string[] =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const arrayToCsv = (a: string[] | null | undefined): string =>
  (a ?? []).join(", ");

export function OnboardingForm() {
  const router = useRouter();

  // Tier 1 (required)
  const [website, setWebsite] = useState("");
  const [name, setName] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [goal, setGoal] = useState<CampaignGoal>("leads");
  // Category: select value is a taxonomy label or CATEGORY_OTHER; the free-text
  // box (categoryCustom) is only used on the "Other…" path.
  const [category, setCategory] = useState("");
  const [categoryCustom, setCategoryCustom] = useState("");
  const [budgetType, setBudgetType] = useState<"daily" | "total">("daily");
  const [budgetAmount, setBudgetAmount] = useState("50");
  const [currency, setCurrency] = useState("USD");
  // Target cities for ad serving; country scopes competitor discovery.
  const [geo, setGeo] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY);

  // Tier 2 (optional, high-leverage)
  const [usp, setUsp] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [offer, setOffer] = useState("");
  const [positioning, setPositioning] = useState<PricePositioning | "">("");

  // Tier 3 (auto-derived, user confirms)
  const [offerings, setOfferings] = useState("");
  const [valueProps, setValueProps] = useState("");
  const [personas, setPersonas] = useState("");
  const [tone, setTone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [palette, setPalette] = useState<Record<string, string>>({});
  const [headingFont, setHeadingFont] = useState("");
  const [bodyFont, setBodyFont] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setError(null);
    if (!website) {
      setError("Enter the client website URL first.");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ website }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      const r = data as ExtractResponse;
      if (r.suggested_name && !name) setName(r.suggested_name);
      // The API only returns a category when it's an exact taxonomy label, so it's
      // safe to select directly. Leave the picker untouched if none was detected.
      if (r.category) setCategory(r.category);
      setOfferings(arrayToCsv(r.derived.offerings));
      setValueProps(arrayToCsv(r.derived.value_props));
      setPersonas(arrayToCsv(r.derived.personas));
      setTone(r.brand_kit.tone ?? "");
      setLogoUrl(r.logo_url ?? "");
      setHeadingFont(r.brand_kit.fonts?.heading ?? "");
      setBodyFont(r.brand_kit.fonts?.body ?? "");
      setPalette({
        primary: r.brand_kit.palette?.primary ?? "",
        accent: r.brand_kit.palette?.accent ?? "",
        neutral: r.brand_kit.palette?.neutral ?? "",
        text: r.brand_kit.palette?.text ?? "",
      });
      if (!destinationUrl) setDestinationUrl(website);
      setAnalyzed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  function buildPayload(): ClientProfileInput {
    const hexOrNull = (v: string) => (/^#[0-9a-fA-F]{3,6}$/.test(v) ? v : null);
    const categoryValue =
      category === CATEGORY_OTHER ? categoryCustom.trim() || null : category || null;
    return {
      name: name.trim(),
      website: website.trim(),
      destination_url: destinationUrl.trim(),
      goal,
      category: categoryValue,
      country: country || DEFAULT_COUNTRY,
      budget: {
        type: budgetType,
        amount: Number(budgetAmount),
        currency: currency.trim().toUpperCase() || "USD",
      },
      geo: csvToArray(geo),
      competitors: competitors ? csvToArray(competitors) : null,
      usp: usp.trim() || null,
      offer: offer.trim() || null,
      price_positioning: positioning || null,
      brand_kit: {
        logo_url: logoUrl.trim() || null,
        palette: {
          primary: hexOrNull(palette.primary ?? ""),
          accent: hexOrNull(palette.accent ?? ""),
          neutral: hexOrNull(palette.neutral ?? ""),
          text: hexOrNull(palette.text ?? ""),
        },
        fonts: {
          heading: headingFont.trim() || null,
          body: bodyFont.trim() || null,
          heading_url: null,
          body_url: null,
        },
        tone: tone.trim() || null,
        do_not_use: [],
      },
      derived: {
        offerings: csvToArray(offerings),
        value_props: csvToArray(valueProps),
        personas: csvToArray(personas),
      },
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // §3.2 rule: if any optional field is filled but the USP is empty, nudge.
    const anyOptional = competitors || offer || positioning;
    if (anyOptional && !usp.trim()) {
      setError(
        "The USP is the single highest-leverage field — please fill it before other optional fields.",
      );
      return;
    }
    if (csvToArray(geo).length === 0) {
      setError("Add at least one target city.");
      return;
    }
    if (!country) {
      setError("Select a country — it scopes competitor ad discovery.");
      return;
    }
    if (!category) {
      setError("Select a business category — it powers competitor ad discovery.");
      return;
    }
    if (category === CATEGORY_OTHER && !categoryCustom.trim()) {
      setError("Type your business category, or pick one from the list.");
      return;
    }
    if (!(Number(budgetAmount) > 0)) {
      setError("Budget amount must be greater than zero.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create client");
      // Invalidate the App Router Cache BEFORE navigating, otherwise the push
      // serves the stale /clients entry (empty list) cached from an earlier
      // visit. refresh() must run while on the route whose cache we're clearing.
      router.refresh();
      router.push("/clients");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create client");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Website → analyze */}
      <Card>
        <SectionTitle description="Paste the client's site and let the system pre-fill the brand kit and offerings.">
          Website
        </SectionTitle>
        <div className="flex gap-2">
          <Input
            id="website"
            type="url"
            placeholder="https://glowskinspa.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            required
          />
          <Button
            type="button"
            variant="secondary"
            onClick={analyze}
            disabled={analyzing}
            className="whitespace-nowrap"
          >
            {analyzing ? "Analyzing…" : "Analyze website"}
          </Button>
        </div>
        {analyzed && (
          <p className="mt-2 text-xs text-success">
            Analyzed. Review the auto-filled fields below and edit anything.
          </p>
        )}
      </Card>

      {/* Tier 1 — required */}
      <Card>
        <SectionTitle description="The irreducible set — required to assemble a campaign.">
          Required
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client name" htmlFor="name" required>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Campaign goal" htmlFor="goal" required>
            <Select id="goal" value={goal} onChange={(e) => setGoal(e.target.value as CampaignGoal)}>
              {GOALS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Business category"
            htmlFor="category"
            required
            hint="Auto-detected from the website — confirm or change. Drives competitor ad discovery."
          >
            <div className="space-y-2">
              <Select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select a category…</option>
                {BUSINESS_CATEGORY_GROUPS.map((grp) => (
                  <optgroup key={grp.group} label={grp.group}>
                    {grp.categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value={CATEGORY_OTHER}>Other…</option>
              </Select>
              {category === CATEGORY_OTHER && (
                <Input
                  aria-label="Custom business category"
                  placeholder="Type the business category"
                  value={categoryCustom}
                  onChange={(e) => setCategoryCustom(e.target.value)}
                />
              )}
            </div>
          </Field>
          <Field
            label="Destination URL"
            htmlFor="dest"
            required
            hint="Where the click lands — the conversion page."
          >
            <Input
              id="dest"
              type="url"
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Target cities"
            htmlFor="geo"
            required
            hint="Comma-separated cities where ads serve, e.g. Los Angeles, Pasadena"
          >
            <Input id="geo" value={geo} onChange={(e) => setGeo(e.target.value)} required />
          </Field>
          <Field
            label="Country"
            htmlFor="country"
            required
            hint="Scopes competitor ad discovery to same-market advertisers."
          >
            <Select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Budget type" htmlFor="budgetType" required>
            <Select
              id="budgetType"
              value={budgetType}
              onChange={(e) => setBudgetType(e.target.value as "daily" | "total")}
            >
              <option value="daily">daily</option>
              <option value="total">total</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amount" htmlFor="amount" required>
              <Input
                id="amount"
                type="number"
                min="1"
                step="1"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                required
              />
            </Field>
            <Field label="Currency" htmlFor="currency" required>
              <Input
                id="currency"
                maxLength={3}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                required
              />
            </Field>
          </div>
        </div>
      </Card>

      {/* Tier 2 — optional, high-leverage */}
      <Card>
        <SectionTitle description="Optional, but this is where effectiveness comes from.">
          High-leverage (optional)
        </SectionTitle>
        <div className="space-y-4">
          <Field
            label="The real differentiator / USP"
            htmlFor="usp"
            hint="The single most important manual field — it can't be scraped and powers gap-angle generation."
          >
            <Textarea
              id="usp"
              rows={2}
              placeholder="e.g. only same-week board-certified injector appointments in the area"
              value={usp}
              onChange={(e) => setUsp(e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Named competitors"
              htmlFor="competitors"
              hint="3–5 names or URLs, comma-separated."
            >
              <Input
                id="competitors"
                value={competitors}
                onChange={(e) => setCompetitors(e.target.value)}
              />
            </Field>
            <Field label="Current offer / promotion" htmlFor="offer">
              <Input id="offer" value={offer} onChange={(e) => setOffer(e.target.value)} />
            </Field>
            <Field label="Price positioning" htmlFor="positioning">
              <Select
                id="positioning"
                value={positioning}
                onChange={(e) => setPositioning(e.target.value as PricePositioning | "")}
              >
                <option value="">—</option>
                {POSITIONING.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </Card>

      {/* Tier 3 — derived, confirm */}
      <Card>
        <SectionTitle description="Auto-derived from the website — confirm or edit.">
          Brand &amp; offerings (confirm)
        </SectionTitle>
        <div className="space-y-4">
          <Field label="Offerings" htmlFor="offerings" hint="Comma-separated.">
            <Input id="offerings" value={offerings} onChange={(e) => setOfferings(e.target.value)} />
          </Field>
          <Field label="Value props" htmlFor="valueProps" hint="Comma-separated.">
            <Input id="valueProps" value={valueProps} onChange={(e) => setValueProps(e.target.value)} />
          </Field>
          <Field label="Implied personas" htmlFor="personas" hint="Comma-separated.">
            <Input id="personas" value={personas} onChange={(e) => setPersonas(e.target.value)} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tone" htmlFor="tone" hint="e.g. clinical-reassuring">
              <Input id="tone" value={tone} onChange={(e) => setTone(e.target.value)} />
            </Field>
            <Field label="Logo URL" htmlFor="logo">
              <Input id="logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            </Field>
            <Field label="Heading font" htmlFor="headingFont">
              <Input id="headingFont" value={headingFont} onChange={(e) => setHeadingFont(e.target.value)} />
            </Field>
            <Field label="Body font" htmlFor="bodyFont">
              <Input id="bodyFont" value={bodyFont} onChange={(e) => setBodyFont(e.target.value)} />
            </Field>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Palette</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["primary", "accent", "neutral", "text"] as const).map((key) => (
                <div key={key} className="space-y-1">
                  <label htmlFor={`color-${key}`} className="block text-xs text-muted">
                    {key}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`color-${key}`}
                      type="color"
                      className="h-9 w-9 shrink-0 rounded border border-border bg-bg"
                      value={palette[key] || "#000000"}
                      onChange={(e) => setPalette((p) => ({ ...p, [key]: e.target.value }))}
                      aria-label={`${key} color`}
                    />
                    <Input
                      value={palette[key] ?? ""}
                      placeholder="#RRGGBB"
                      onChange={(e) => setPalette((p) => ({ ...p, [key]: e.target.value }))}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Create client"}
        </Button>
      </div>
    </form>
  );
}
