import "server-only";
import { z } from "zod";
import { BrandKit, DerivedProfile } from "@gaa/shared";
import { getLlm } from "@/lib/llm";
import { fetchSiteHtml } from "@/lib/scrape/fetch-site";
import { fetchStylesheets } from "@/lib/scrape/fetch-css";
import { extractHtmlSummary, isNoiseColor } from "@/lib/scrape/extract-html";

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
  // Pull the site's same-origin stylesheets so color/font detection sees the real
  // design tokens (best-effort — "" if unavailable, degrading to HTML-only signal).
  const css = await fetchStylesheets(html, websiteUrl).catch(() => "");
  const summary = extractHtmlSummary(html, websiteUrl, css);

  const prompt = [
    `Website: ${websiteUrl}`,
    summary.title ? `Title: ${summary.title}` : "",
    summary.metaDescription ? `Meta description: ${summary.metaDescription}` : "",
    summary.colorHints.length
      ? `Colors detected on page (most frequent first): ${summary.colorHints.join(", ")}. ` +
        `Base the palette on these. Near-black and off-white ARE valid brand colors — ` +
        `do not output a vivid color that isn't in this list.`
      : "",
    summary.fontHints.length
      ? `Fonts detected on page (heading first if distinguishable): ${summary.fontHints.join(", ")}`
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
  // Reject CMS default-palette swatches the model sometimes invents (the green/blue
  // problem on WordPress sites), then backfill from the detected (denoised) colors.
  for (const role of ["primary", "accent", "neutral", "text"] as const) {
    if (palette[role] && isNoiseColor(palette[role]!)) palette[role] = null;
  }
  palette.primary ??= summary.colorHints[0] ?? null;
  palette.accent ??= summary.colorHints[1] ?? null;
  palette.neutral ??= summary.colorHints[2] ?? null;

  // Backfill fonts from detected font hints when the model left them empty (the
  // page text alone carries no font signal — these come from the markup/CSS).
  const llmFonts = llm.brand_kit.fonts;
  let heading = llmFonts?.heading ?? null;
  let body = llmFonts?.body ?? null;
  let heading_url = llmFonts?.heading_url ?? null;
  let body_url = llmFonts?.body_url ?? null;
  if (!heading && summary.fontHints[0]) heading = summary.fontHints[0];
  if (!body && summary.fontHints.length) body = summary.fontHints[1] ?? summary.fontHints[0]!;
  // Attach a downloadable font-file URL when the chosen family has an @font-face
  // in the site's CSS — lets the renderer use a self-hosted (non-Google) brand font.
  if (heading && !heading_url) heading_url = summary.fontFaces[heading.toLowerCase()] ?? null;
  if (body && !body_url) body_url = summary.fontFaces[body.toLowerCase()] ?? null;
  const fonts = { heading, body, heading_url, body_url };

  return {
    ...llm,
    brand_kit: { ...llm.brand_kit, palette, fonts },
    logo_url: summary.logoUrl,
  };
}
