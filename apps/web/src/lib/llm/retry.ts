import { LlmError } from "./types";

/**
 * Bounded retry with exponential backoff + full jitter. Only retries errors
 * explicitly marked retryable (LlmError) — never retries terminal failures
 * (validation, auth, 4xx). Production checklist: no unbounded retry loops.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseMs?: number; maxMs?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 400;
  const maxMs = opts.maxMs ?? 5000;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof LlmError && err.opts.retryable;
      if (!retryable || i === attempts - 1) throw err;
      const backoff = Math.min(maxMs, baseMs * 2 ** i);
      const jittered = Math.random() * backoff;
      await new Promise((r) => setTimeout(r, jittered));
    }
  }
  throw lastErr;
}
