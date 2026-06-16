import "server-only";
import { serverEnv } from "@/lib/env";
import { GeminiProvider } from "./gemini";
import { LlmError, type LlmProvider } from "./types";

export type { LlmProvider } from "./types";
export { LlmError } from "./types";

let cached: LlmProvider | null = null;

/**
 * Returns the configured LLM provider. Provider + model come from env
 * (LLM_PROVIDER / LLM_MODEL), so swapping vendors is a config change.
 * Only Gemini is implemented in the MVP; others fail loudly until added.
 */
export function getLlm(): LlmProvider {
  if (cached) return cached;
  const env = serverEnv();
  switch (env.LLM_PROVIDER) {
    case "gemini": {
      if (!env.GEMINI_API_KEY) {
        throw new LlmError(
          "LLM_PROVIDER=gemini but GEMINI_API_KEY is not set",
          { retryable: false },
        );
      }
      cached = new GeminiProvider(env.LLM_MODEL, env.GEMINI_API_KEY);
      return cached;
    }
    case "anthropic":
    case "openai":
      throw new LlmError(
        `LLM provider "${env.LLM_PROVIDER}" is not implemented in the MVP yet. ` +
          `Add a provider in apps/web/src/lib/llm and register it here.`,
        { retryable: false },
      );
    default:
      throw new LlmError(`Unknown LLM_PROVIDER: ${env.LLM_PROVIDER}`, {
        retryable: false,
      });
  }
}
