import "server-only";
import {
  AnalysisObject,
  type ClientProfile,
  GenerationResult,
  type StyleSpec,
} from "@gaa/shared";
import { serverEnv } from "@/lib/env";

/**
 * Thin client for the Python AI service (Module 2 analysis). Response is
 * validated against the shared Zod schema — never trust the service blindly.
 */

export class AiServiceError extends Error {}

/**
 * Live competitor discovery reached the Transparency Center but the country +
 * relevance filters left too few usable ads. Actionable (the user should change
 * the category or location), so it is surfaced rather than silently degraded —
 * distinct from a generic AiServiceError, which is an infra/transport failure.
 */
export class NoRelevantAdsError extends AiServiceError {}

// Natural Gemini (thinking on) enriches the corpus per-ad sequentially, so a
// real cached-corpus run is ~75s; give generous headroom over that before abort.
const ANALYZE_TIMEOUT_MS = 180_000;

/** Extract FastAPI's {"detail": "..."} message from a response body, else echo. */
function parseDetail(body: string): string {
  try {
    const j = JSON.parse(body);
    if (j && typeof j.detail === "string") return j.detail;
  } catch {
    /* not JSON — fall through */
  }
  return body.slice(0, 300) || "No relevant ads found. Try a different category or location.";
}

/**
 * Vertical for corpus selection + analysis. Prefer the confirmed business
 * `category` (clean label like "Medical Spa" — best for advertiser-name discovery;
 * the Python side normalizes spaces/case for both live discovery and cached lookup).
 * Fall back to the first offering slugified, then the med_spa demo corpus.
 */
function inferVertical(client: ClientProfile): string {
  const category = client.category?.trim();
  if (category) return category;
  const first = client.derived?.offerings?.[0];
  if (first) {
    return first.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }
  return "med_spa";
}

export async function analyzeCompetitors(
  client: ClientProfile,
): Promise<AnalysisObject> {
  const { AI_SERVICE_URL, ANALYSIS_USE_CACHED_CORPUS, ANALYSIS_MAX_ADS } = serverEnv();
  const payload = {
    client: {
      name: client.name,
      vertical: inferVertical(client),
      geo: client.geo,
      website: client.website,
      // ISO-2 market for the discovery country filter; default US (the MVP demo).
      country: client.country ?? "US",
      competitors: client.competitors ?? null,
      usp: client.usp ?? null,
      offerings: client.derived?.offerings ?? null,
    },
    // Live Transparency Center fetch by default; the AI service falls back to the
    // cached corpus on an infra failure, but surfaces a 422 when discovery reached
    // the source yet the country + relevance filters left too few usable ads.
    use_cached_corpus: ANALYSIS_USE_CACHED_CORPUS,
    max_ads: ANALYSIS_MAX_ADS,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${AI_SERVICE_URL}/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    throw new AiServiceError(
      err instanceof Error && err.name === "AbortError"
        ? "Analysis timed out"
        : "AI service is unreachable (is it running on AI_SERVICE_URL?)",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // 422 = discovery reached the source but filters emptied the corpus. The
    // FastAPI body is {"detail": "<clean, user-facing message>"}; surface it as-is.
    if (res.status === 422) {
      throw new NoRelevantAdsError(parseDetail(detail));
    }
    throw new AiServiceError(`AI service returned ${res.status}: ${detail.slice(0, 300)}`);
  }

  const json = await res.json();
  const parsed = AnalysisObject.safeParse(json);
  if (!parsed.success) {
    throw new AiServiceError(
      `AI service returned an invalid analysis object: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

// Generation does more LLM work than analysis (N variants x generate+critique,
// plus regenerations and transient 503 retries), so give it the full route budget.
const GENERATE_TIMEOUT_MS = 180_000;

/** Derive the compact StyleSpec the generator consumes from the client brand kit. */
function styleFromClient(client: ClientProfile): StyleSpec {
  const bk = client.brand_kit;
  return {
    palette: bk?.palette ?? null,
    fonts: bk?.fonts ?? null,
    tone: bk?.tone ?? null,
    do_not_use: bk?.do_not_use ?? null,
  };
}

export interface GenerateOptions {
  nPerFormat?: number;
  formats?: Array<"search" | "display">;
  /** Display template allowlist (subset of DISPLAY_TEMPLATE_IDS); empty = all. */
  allowedTemplates?: string[];
}

export async function generateVariants(
  client: ClientProfile,
  analysis: AnalysisObject,
  opts: GenerateOptions = {},
): Promise<GenerationResult> {
  const { AI_SERVICE_URL } = serverEnv();
  const formats = opts.formats?.length ? opts.formats : ["search", "display"];
  const payload = {
    client: {
      name: client.name,
      vertical: analysis.vertical,
      geo: client.geo,
      website: client.website,
      competitors: client.competitors ?? null,
      usp: client.usp ?? null,
      offerings: client.derived?.offerings ?? null,
    },
    analysis,
    style: styleFromClient(client),
    formats,
    n_per_format: opts.nPerFormat ?? 3,
    allowed_templates: opts.allowedTemplates?.length ? opts.allowedTemplates : null,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${AI_SERVICE_URL}/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    throw new AiServiceError(
      err instanceof Error && err.name === "AbortError"
        ? "Generation timed out"
        : "AI service is unreachable (is it running on AI_SERVICE_URL?)",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new AiServiceError(`AI service returned ${res.status}: ${detail.slice(0, 300)}`);
  }

  const parsed = GenerationResult.safeParse(await res.json());
  if (!parsed.success) {
    throw new AiServiceError(
      `AI service returned invalid generation output: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}
