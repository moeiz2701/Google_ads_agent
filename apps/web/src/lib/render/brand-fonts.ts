import "server-only";
import type { LoadedFont } from "./fonts";

/**
 * Best-effort loader for a brand font (by Google Fonts family name) so Satori can
 * render copy in the client's actual typeface. Satori needs raw TTF/OTF bytes — it
 * cannot reference a system or web font by name — so we resolve the family via the
 * Google Fonts CSS2 API and fetch the TTFs for the weights we render.
 *
 * Any failure (unknown family, non-Google font, network, timeout) returns [] so the
 * caller falls back to the bundled Inter. A brand font NEVER blocks or breaks a
 * render — it's a best-effort enhancement, exactly like the stock-image path.
 * Cached per family for the process lifetime.
 */

const FETCH_TIMEOUT_MS = 5_000;
// A legacy UA so Google Fonts serves TTF `src:` urls; modern UAs get woff2, which
// Satori cannot parse.
const LEGACY_UA =
  "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0 Safari/537.36";

const cache = new Map<string, LoadedFont[]>();

async function timedFetch(url: string, init?: RequestInit): Promise<Response | null> {
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

async function fetchFace(
  family: string,
  url: string,
  weight: 400 | 700,
): Promise<LoadedFont | null> {
  const res = await timedFetch(url);
  if (!res || !res.ok) return null;
  try {
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 1000) return null; // guard against an HTML error page
    return { name: family, data: buf, weight, style: "normal" };
  } catch {
    return null;
  }
}

/**
 * Load a font directly from a TTF/OTF URL (a self-hosted brand font discovered in
 * the site's @font-face) and register it under `family`. Registered at weight 400;
 * Satori synthesizes bold. Rejects non-TTF/OTF (e.g. woff2 → Satori can't parse).
 * Returns [] on any failure so the caller falls back to Google/Inter.
 */
export async function loadBrandFontFromUrl(
  family: string,
  url: string,
): Promise<LoadedFont[]> {
  const key = `url:${family}:${url}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let faces: LoadedFont[] = [];
  if (/\.(?:ttf|otf)(?:[?#]|$)/i.test(url)) {
    const face = await fetchFace(family, url, 400);
    if (face) faces = [face];
  }
  cache.set(key, faces);
  return faces;
}

/** Resolve a Google Fonts family to its 400 + 700 TTFs, or [] if unavailable. */
export async function loadBrandFont(family: string): Promise<LoadedFont[]> {
  const key = family.trim();
  if (!key) return [];
  const hit = cache.get(key);
  if (hit) return hit;

  const api =
    "https://fonts.googleapis.com/css2?family=" +
    encodeURIComponent(key) +
    ":wght@400;700&display=swap";
  const css = await timedFetch(api, { headers: { "User-Agent": LEGACY_UA } });
  let text = "";
  if (css?.ok) {
    try {
      text = await css.text();
    } catch {
      text = "";
    }
  }

  // Pair each @font-face's font-weight with its TTF url; keep one face per weight.
  const faces: LoadedFont[] = [];
  const seen = new Set<number>();
  for (const block of text.matchAll(/@font-face\s*{([^}]*)}/gi)) {
    const body = block[1]!;
    const weight = Number(/font-weight\s*:\s*(\d+)/i.exec(body)?.[1] ?? "400");
    if ((weight !== 400 && weight !== 700) || seen.has(weight)) continue;
    const ttf = /src\s*:[^;]*url\(([^)]+\.ttf)\)/i
      .exec(body)?.[1]
      ?.replace(/["']/g, "");
    if (!ttf) continue;
    const face = await fetchFace(key, ttf, weight as 400 | 700);
    if (face) {
      faces.push(face);
      seen.add(weight);
    }
  }

  cache.set(key, faces);
  return faces;
}
