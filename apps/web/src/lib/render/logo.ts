import "server-only";

/**
 * Pre-fetch a brand logo and return it as a data URI Satori can embed inline.
 *
 * Satori fetches <img src> during render and THROWS if that fetch fails or the
 * format is unsupported — which would fail the whole creative. So we fetch the
 * bytes here behind a timeout, verify the content type is a raster format Satori
 * handles (PNG/JPEG/WebP), cap the size, and hand templates a data URI. Any
 * problem (timeout, 404, SVG/ICO, oversized, non-image) returns null and the logo
 * slot simply renders nothing. Never throws — a logo never breaks a render.
 */

const FETCH_TIMEOUT_MS = 5_000;
const MAX_BYTES = 2_000_000;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
/** Aspect fallback when intrinsic dims can't be parsed (e.g. WebP) — most logos
 *  are wider than tall, so a 3:1 box is a safe default. */
const DEFAULT_ASPECT = { width: 300, height: 100 };

export interface ResolvedLogo {
  /** base64 data URI Satori can embed inline. */
  uri: string;
  /** intrinsic pixel dimensions (or a 3:1 fallback) — Satori needs explicit dims. */
  width: number;
  height: number;
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Intrinsic size from PNG (IHDR) / JPEG (SOF marker) bytes, else null. */
function imageSize(buf: Uint8Array): { width: number; height: number } | null {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // PNG: \x89PNG, IHDR width@16 height@20 (big-endian uint32)
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    const w = dv.getUint32(16);
    const h = dv.getUint32(20);
    return w > 0 && h > 0 ? { width: w, height: h } : null;
  }
  // JPEG: \xFF\xD8, then scan for an SOF marker carrying height@+5 width@+7
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1]!;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const h = dv.getUint16(i + 5);
        const w = dv.getUint16(i + 7);
        return w > 0 && h > 0 ? { width: w, height: h } : null;
      }
      i += 2 + dv.getUint16(i + 2); // skip this segment
    }
  }
  return null;
}

export async function resolveLogoDataUri(logoUrl: string | null): Promise<ResolvedLogo | null> {
  if (!logoUrl || !isHttpUrl(logoUrl)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(logoUrl, { signal: controller.signal });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "")
      .split(";")[0]!
      .trim()
      .toLowerCase();
    if (!ALLOWED.has(type)) return null; // SVG/ICO/etc. — Satori can't embed reliably
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
    const mime = type === "image/jpg" ? "image/jpeg" : type;
    const dims = imageSize(buf) ?? DEFAULT_ASPECT;
    return {
      uri: `data:${mime};base64,${Buffer.from(buf).toString("base64")}`,
      width: dims.width,
      height: dims.height,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
