import "server-only";
import { AnalysisObject, type ClientProfile } from "@gaa/shared";
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
