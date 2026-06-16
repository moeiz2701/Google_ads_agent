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

const ANALYZE_TIMEOUT_MS = 90_000;

/** Best-effort vertical for corpus selection; cached source falls back to med_spa. */
function inferVertical(client: ClientProfile): string {
  const first = client.derived?.offerings?.[0];
  if (first) {
    return first.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }
  return "med_spa";
}

export async function analyzeCompetitors(
  client: ClientProfile,
): Promise<AnalysisObject> {
  const { AI_SERVICE_URL } = serverEnv();
  const payload = {
    client: {
      name: client.name,
      vertical: inferVertical(client),
      geo: client.geo,
      website: client.website,
      competitors: client.competitors ?? null,
      usp: client.usp ?? null,
      offerings: client.derived?.offerings ?? null,
    },
    use_cached_corpus: true,
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

const GENERATE_TIMEOUT_MS = 120_000;

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

export async function generateVariants(
  client: ClientProfile,
  analysis: AnalysisObject,
  opts: { nPerFormat?: number } = {},
): Promise<GenerationResult> {
  const { AI_SERVICE_URL } = serverEnv();
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
    formats: ["search", "display"],
    n_per_format: opts.nPerFormat ?? 3,
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
