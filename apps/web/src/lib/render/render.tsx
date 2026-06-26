import "server-only";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { BrandKit, DisplayRenderSpec, DisplaySize } from "@gaa/shared";
import { loadFonts, FONT_FAMILY, type LoadedFont } from "./fonts";
import { loadBrandFont, loadBrandFontFromUrl } from "./brand-fonts";
import { resolveLogoDataUri } from "./logo";
import { resolvePalette } from "./palette";
import { getSizeProfile } from "./sizes";
import { resolveBackgroundImage } from "./background";
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
  allowAi = true,
): Promise<Uint8Array> {
  const profile = getSizeProfile(size);
  const palette = resolvePalette(brandKit);

  // Background, logo, and brand fonts are independent best-effort lookups — fetch
  // in parallel. Inter is always loaded as the guaranteed fallback face.
  const headingReq = brandKit?.fonts?.heading?.trim() || null;
  const bodyReq = brandKit?.fonts?.body?.trim() || null;
  // One resolve per distinct family: prefer the site's own font file (URL) when
  // we have one, else Google Fonts by name, else []. Reuses cached loads.
  const urlFor = (fam: string | null): string | null => {
    if (!fam) return null;
    if (fam === headingReq) return brandKit?.fonts?.heading_url?.trim() || null;
    if (fam === bodyReq) return brandKit?.fonts?.body_url?.trim() || null;
    return null;
  };
  const brandFamilies = [...new Set([headingReq, bodyReq].filter((f): f is string => !!f))];
  const resolveFamily = async (fam: string): Promise<LoadedFont[]> => {
    const url = urlFor(fam);
    if (url) {
      const faces = await loadBrandFontFromUrl(fam, url);
      if (faces.length) return faces;
    }
    return loadBrandFont(fam);
  };

  const [{ url: imageUrl }, logo, inter, brandFaceGroups] = await Promise.all([
    resolveBackgroundImage(spec, brandKit, allowAi),
    profile.showLogo ? resolveLogoDataUri(brandKit?.logo_url ?? null) : Promise.resolve(null),
    loadFonts(),
    Promise.all(brandFamilies.map(resolveFamily)),
  ]);

  const brandFaces = brandFaceGroups.flat();
  const loaded = new Set(brandFaces.map((f) => f.name));
  // Use a brand family only if its faces actually loaded; otherwise fall back to Inter.
  const headingFamily = headingReq && loaded.has(headingReq) ? headingReq : FONT_FAMILY;
  const bodyFamily = bodyReq && loaded.has(bodyReq) ? bodyReq : FONT_FAMILY;
  const fonts = [...inter, ...brandFaces];

  const Template = getTemplate(spec.template_id);

  const svg = await satori(
    Template({ spec, brandKit, profile, palette, imageUrl, logo, headingFamily, bodyFamily }),
    {
      width: profile.width,
      height: profile.height,
      fonts: fonts.map((f) => ({
        name: f.name,
        data: f.data,
        weight: f.weight,
        style: f.style,
      })),
    },
  );

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
  allowAi = true,
): Promise<Response> {
  const png = await renderDisplayPng(spec, brandKit, size, allowAi);
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
