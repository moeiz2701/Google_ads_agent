import {
  type GenerateJsonInput,
  type GenerateTextInput,
  type LlmProvider,
  LlmError,
} from "./types";
import { withRetry } from "./retry";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_TIMEOUT_MS = 30_000;

/** Gemini provider over the REST API (no SDK dependency). */
export class GeminiProvider implements LlmProvider {
  readonly name = "gemini";
  constructor(
    readonly model: string,
    private readonly apiKey: string,
  ) {}

  async generateText(input: GenerateTextInput): Promise<string> {
    const data = await this.call(input, /* json */ false);
    return extractText(data);
  }

  async generateJson<T>(input: GenerateJsonInput<T>): Promise<T> {
    const prompt = input.schemaHint
      ? `${input.prompt}\n\nReturn ONLY JSON matching this shape:\n${input.schemaHint}`
      : input.prompt;
    const data = await this.call({ ...input, prompt }, /* json */ true);
    const raw = extractText(data);
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFence(raw));
    } catch (cause) {
      throw new LlmError("Gemini returned non-JSON output", {
        retryable: true,
        cause,
      });
    }
    const result = input.schema.safeParse(parsed);
    if (!result.success) {
      // Schema mismatch is retryable once: a re-roll often produces valid JSON.
      throw new LlmError(
        `Gemini output failed schema validation: ${result.error.message}`,
        { retryable: true, cause: result.error },
      );
    }
    return result.data;
  }

  private async call(input: GenerateTextInput, json: boolean): Promise<unknown> {
    const url = `${ENDPOINT}/${this.model}:generateContent?key=${this.apiKey}`;
    const body = {
      ...(input.system
        ? { systemInstruction: { parts: [{ text: input.system }] } }
        : {}),
      contents: [{ role: "user", parts: [{ text: input.prompt }] }],
      generationConfig: {
        temperature: input.temperature ?? 0.7,
        maxOutputTokens: input.maxOutputTokens ?? 2048,
        ...(json ? { responseMimeType: "application/json" } : {}),
      },
    };

    return withRetry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          // 429 / 5xx are transient; 4xx (auth/bad request) are terminal.
          const retryable = res.status === 429 || res.status >= 500;
          throw new LlmError(`Gemini HTTP ${res.status}: ${text.slice(0, 300)}`, {
            retryable,
          });
        }
        return (await res.json()) as unknown;
      } catch (err) {
        if (err instanceof LlmError) throw err;
        // network error / abort → retryable
        throw new LlmError("Gemini request failed", {
          retryable: true,
          cause: err,
        });
      } finally {
        clearTimeout(timeout);
      }
    });
  }
}

function stripCodeFence(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractText(data: unknown): string {
  const text = (data as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || text.length === 0) {
    throw new LlmError("Gemini response contained no text", { retryable: true });
  }
  return text;
}
