import type { ZodType } from "zod";

/**
 * Provider-abstracted LLM interface (CLAUDE.md supreme law).
 *
 * Every model call in the app goes through this interface so the provider is a
 * config change, not a rewrite. Default provider is Gemini for the MVP.
 */

export interface GenerateTextInput {
  system?: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** per-call timeout in ms (default applied by provider). */
  timeoutMs?: number;
}

export interface GenerateJsonInput<T> extends GenerateTextInput {
  /** Output is validated against this schema before return — never trust raw LLM output. */
  schema: ZodType<T>;
  /** Human description of the schema, injected into the prompt to steer the model. */
  schemaHint?: string;
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  generateText(input: GenerateTextInput): Promise<string>;
  generateJson<T>(input: GenerateJsonInput<T>): Promise<T>;
}

/** Typed error so callers can distinguish retryable vs terminal failures. */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly opts: { retryable: boolean; cause?: unknown } = { retryable: false },
  ) {
    super(message, { cause: opts.cause });
    this.name = "LlmError";
  }
}
