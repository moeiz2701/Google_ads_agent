import "server-only";
import { z } from "zod";
import { BrandKit, DerivedProfile } from "@gaa/shared";
import { getLlm } from "@/lib/llm";
import { fetchSiteHtml } from "@/lib/scrape/fetch-site";
import { extractHtmlSummary } from "@/lib/scrape/extract-html";

/**
 * Tier-3 auto-derivation (§3.1, §3.2): the website URL does ~70% of the work.
 * Fetch → summarize the page → LLM extracts offerings, voice/tone, palette,
 * personas. The user CONFIRMS these in the UI; nothing here is authoritative.
 */

/** What the LLM returns (logo is sourced from HTML, not the model). */
const LlmExtraction = z.object({
  suggested_name: z.string().nullable(),
  derived: DerivedProfile,
  brand_kit: BrandKit.pick({ palette: true, fonts: true, tone: true }),
});

export const ExtractedProfile = LlmExtraction.extend({
  logo_url: z.string().nullable(),
});
export type ExtractedProfile = z.infer<typeof ExtractedProfile>;

const SCHEMA_HINT = `{
  "suggested_name": string | null,                       // the business name
  "derived": {
    "offerings": string[],                               // products/services offered
    "value_props": string[],                             // concrete benefits, not fluff
    "personas": string[]                                 // implied target customers
  },
  "brand_kit": {
    "palette": { "primary": "#RRGGBB"|null, "accent": "#RRGGBB"|null, "neutral": "#RRGGBB"|null, "text": "#RRGGBB"|null },
    "fonts": { "heading": string|null, "body": string|null },
    "tone": string | null                                // e.g. "clinical-reassuring"
  }
}`;

const SYSTEM =
  "You analyze a business website and extract a structured brand/offering profile " +
  "for building Google Ads. Be concrete and specific; prefer the company's own words. " +
  "If a field cannot be determined from the page, use null (or an empty array). " +
  "Never invent offerings, prices, or claims that are not supported by the page.";

export async function extractProfileFromUrl(
  websiteUrl: string,
): Promise<ExtractedProfile> {
  const html = await fetchSiteHtml(websiteUrl);
  const summary = extractHtmlSummary(html, websiteUrl);

  const prompt = [
    `Website: ${websiteUrl}`,
    summary.title ? `Title: ${summary.title}` : "",
    summary.metaDescription ? `Meta description: ${summary.metaDescription}` : "",
    summary.colorHints.length
      ? `Colors detected on page: ${summary.colorHints.join(", ")}`
      : "",
    "",
    "Page text:",
    summary.text,
  ]
    .filter(Boolean)
    .join("\n");

  const llm = await getLlm().generateJson({
    system: SYSTEM,
    prompt,
    schema: LlmExtraction,
    schemaHint: SCHEMA_HINT,
    temperature: 0.3,
    maxOutputTokens: 1500,
  });

  // Backfill palette from HTML color hints when the model left it empty.
  const palette = llm.brand_kit.palette ?? {
    primary: null,
    accent: null,
    neutral: null,
    text: null,
  };
  if (!palette.primary && summary.colorHints[0]) {
    palette.primary = summary.colorHints[0];
    palette.accent ??= summary.colorHints[1] ?? null;
    palette.neutral ??= summary.colorHints[2] ?? null;
  }

  return {
    ...llm,
    brand_kit: { ...llm.brand_kit, palette },
    logo_url: summary.logoUrl,
  };
}
