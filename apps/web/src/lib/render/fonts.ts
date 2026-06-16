import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Font data for `next/og` (Satori needs raw font bytes; it has no system-font
 * access). We bundle two static Inter weights as a neutral, offline-safe sans
 * and always render with them — brand fonts (Poppins, etc.) are best-effort and
 * deferred; we never block a render on fetching a brand font.
 *
 * Loaded once and cached for the process lifetime (deterministic, no network).
 */

export interface LoadedFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
}

const FONT_DIR = join(process.cwd(), "src", "lib", "render", "fonts");

let cache: LoadedFont[] | null = null;

async function readTtf(file: string): Promise<ArrayBuffer> {
  const buf = await readFile(join(FONT_DIR, file));
  // Return a standalone ArrayBuffer slice (Buffer's underlying pool is shared).
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/**
 * The font set Satori renders with. Family name is always "Inter" regardless of
 * the brand's declared font, so callers reference a single stable family.
 */
export async function loadFonts(): Promise<LoadedFont[]> {
  if (cache) return cache;
  const [regular, bold] = await Promise.all([
    readTtf("Inter-Regular.ttf"),
    readTtf("Inter-Bold.ttf"),
  ]);
  cache = [
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter", data: bold, weight: 700, style: "normal" },
  ];
  return cache;
}

/** The family name templates should set in `fontFamily`. */
export const FONT_FAMILY = "Inter";
