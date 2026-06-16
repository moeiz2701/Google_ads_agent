import "server-only";
import type { DisplayRenderSpec } from "@gaa/shared";

/**
 * Resolve a background image URL for a Display render-spec (§5.6).
 *
 * Order: an explicit `image.url` (if http/https) → Unsplash → Pexels → null.
 * A null result means "no photo available"; the renderer then draws a
 * deterministic brand-color backdrop instead. This path is designed so that
 * with ZERO stock credentials the renderer still produces a clean creative —
 * stock keys are an enhancement, never a requirement.
 *
 * Every external call is timed out and wrapped; this module NEVER throws. The
 * worst case is a `null` return that triggers the brand fallback.
 */

const FETCH_TIMEOUT_MS = 5_000;
/** Cap how long we'll wait across both providers so a render never hangs. */

export interface StockResult {
  /** Direct image URL, or null → caller draws the brand-color fallback. */
  url: string | null;
  source: "spec" | "unsplash" | "pexels" | "none";
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function timedFetch(url: string, init: RequestInit): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fromUnsplash(query: string, key: string): Promise<string | null> {
  const endpoint =
    "https://api.unsplash.com/photos/random?orientation=landscape&content_filter=high&query=" +
    encodeURIComponent(query);
  const res = await timedFetch(endpoint, {
    headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
  });
  if (!res || !res.ok) return null;
  try {
    const body = (await res.json()) as { urls?: { regular?: unknown } };
    const u = body.urls?.regular;
    return typeof u === "string" && isHttpUrl(u) ? u : null;
  } catch {
    return null;
  }
}

async function fromPexels(query: string, key: string): Promise<string | null> {
  const endpoint =
    "https://api.pexels.com/v1/search?per_page=1&orientation=landscape&query=" +
    encodeURIComponent(query);
  const res = await timedFetch(endpoint, { headers: { Authorization: key } });
  if (!res || !res.ok) return null;
  try {
    const body = (await res.json()) as {
      photos?: Array<{ src?: { large?: unknown; landscape?: unknown } }>;
    };
    const src = body.photos?.[0]?.src;
    const u = src?.landscape ?? src?.large;
    return typeof u === "string" && isHttpUrl(u) ? u : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the image for a spec. `env` is passed in (not read here) so this stays
 * a pure-ish function over its inputs and is trivially testable; the route reads
 * `serverEnv()` and hands the optional keys in.
 */
export async function resolveStockImage(
  spec: DisplayRenderSpec,
  env: { unsplashKey?: string; pexelsKey?: string },
): Promise<StockResult> {
  const image = spec.image;
  if (!image) return { url: null, source: "none" };

  // 1. An explicit URL on the spec wins, but only if it's a safe scheme.
  if (image.url && isHttpUrl(image.url)) {
    return { url: image.url, source: "spec" };
  }

  const query = image.query?.trim();
  if (!query) return { url: null, source: "none" };

  // 2. Stock providers, in order. Each failure quietly falls through.
  if (env.unsplashKey) {
    const url = await fromUnsplash(query, env.unsplashKey);
    if (url) return { url, source: "unsplash" };
  }
  if (env.pexelsKey) {
    const url = await fromPexels(query, env.pexelsKey);
    if (url) return { url, source: "pexels" };
  }

  // 3. No photo → caller draws the deterministic brand backdrop.
  return { url: null, source: "none" };
}
