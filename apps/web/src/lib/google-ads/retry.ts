import { GoogleAdsError } from "./types";

/**
 * Bounded retry with exponential backoff + full jitter (mirrors
 * src/lib/llm/retry.ts). Only retries GoogleAdsError marked retryable (429/5xx/
 * network); 4xx auth/validation are terminal and propagate immediately. No
 * unbounded retry loops (production checklist).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseMs?: number; maxMs?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 500;
  const maxMs = opts.maxMs ?? 8000;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof GoogleAdsError && err.opts.retryable;
      if (!retryable || i === attempts - 1) throw err;
      const backoff = Math.min(maxMs, baseMs * 2 ** i);
      const jittered = Math.random() * backoff;
      await new Promise((r) => setTimeout(r, jittered));
    }
  }
  throw lastErr;
}
