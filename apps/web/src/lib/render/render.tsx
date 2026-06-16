import "server-only";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { BrandKit, DisplayRenderSpec, DisplaySize } from "@gaa/shared";
import { loadFonts } from "./fonts";
import { resolvePalette } from "./palette";
import { getSizeProfile } from "./sizes";
import { resolveStockImage } from "./stock";
import { getTemplate } from "./templates";

/**
 * Deterministic Display creative renderer (§5.6): one render-spec → a PNG at the
 * requested standard Google size. JSX → SVG via Satori → PNG via resvg.
 *
 * We drive Satori + resvg directly (not `next/og`) because the bundled
 * `@vercel/og` default-font loader is broken on Windows + pnpm. Driving them
 * ourselves also means we control font loading fully — no default-font fallback.
 *
 * Offline-safe: with no stock-image credentials the template draws a brand-color
 * backdrop, so a render always succeeds.
 */
export async function renderDisplayPng(
  spec: DisplayRenderSpec,
  brandKit: BrandKit | null,
  size: DisplaySize,
): Promise<Uint8Array> {
  const profile = getSizeProfile(size);
  const palette = resolvePalette(brandKit);
  const { url: imageUrl } = await resolveStockImage(spec, {
    unsplashKey: process.env.UNSPLASH_ACCESS_KEY,
    pexelsKey: process.env.PEXELS_API_KEY,
  });

  const Template = getTemplate(spec.template_id);
  const fonts = await loadFonts();

  const svg = await satori(Template({ spec, brandKit, profile, palette, imageUrl }), {
    width: profile.width,
    height: profile.height,
    fonts: fonts.map((f) => ({
      name: f.name,
      data: f.data,
      weight: f.weight,
      style: f.style,
    })),
  });

  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: profile.width },
  })
    .render()
    .asPng();
  return png;
}

/** Convenience: render to a PNG HTTP Response with sensible caching. */
export async function renderDisplayResponse(
  spec: DisplayRenderSpec,
  brandKit: BrandKit | null,
  size: DisplaySize,
): Promise<Response> {
  const png = await renderDisplayPng(spec, brandKit, size);
  // Copy into a standalone ArrayBuffer (a clean BodyInit, avoids typed-array
  // generic mismatch and any shared-buffer aliasing).
  const body = png.buffer.slice(
    png.byteOffset,
    png.byteOffset + png.byteLength,
  ) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=300",
    },
  });
}
