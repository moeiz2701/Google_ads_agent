import "server-only";
import { createHash } from "node:crypto";
import type { BrandKit, DisplayRenderSpec } from "@gaa/shared";
import { serverEnv } from "@/lib/env";
import { getServiceClient } from "@/lib/supabase/server";
import { getImageGenerator } from "@/lib/imagegen";
import { resolveStockImage, type StockResult } from "./stock";

/**
 * Resolve the background image for a Display render-spec (§5.6), with an optional
 * AI-generated layer in front of the stock providers.
 *
 * Order: explicit spec.url → AI-generated (cached in Supabase Storage) → Unsplash
 * → Pexels → null (renderer then draws the brand gradient). The AI step is
 * env-gated and entirely best-effort: any failure (no provider, no bucket, API
 * error) quietly falls through to stock, so a render NEVER fails on this path and
 * with no config the behavior is identical to before.
 *
 * Cost control: generated images are cached in object storage keyed by a
 * brand+query+treatment hash, so a given brief is generated once and reused
 * across sizes, re-renders, and campaigns. We hand the renderer a short-lived
 * signed URL — it's fetched server-side during this render only and never
 * embedded in the served PNG, so the bucket can stay private.
 */

const SIGNED_URL_TTL_S = 120;

export interface BackgroundResult {
  url: string | null;
  source: StockResult["source"] | "generated" | "generated_cache";
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** A backdrop prompt grounded in the variant's image query + brand tone. Explicitly
 *  bans baked-in text/logos — those are composited deterministically on top. */
function buildPrompt(query: string, brandKit: BrandKit | null): string {
  const tone = brandKit?.tone ? `${brandKit.tone} mood. ` : "";
  return (
    `${query}. ${tone}` +
    "Professional advertising background photograph, clean composition with generous " +
    "negative space for text overlay, photorealistic, high quality. " +
    "No text, no words, no letters, no logos, no watermarks, no UI."
  );
}

function cacheKey(
  model: string,
  query: string,
  treatment: string,
  brandKit: BrandKit | null,
): string {
  const brand = brandKit?.palette?.primary ?? "";
  return createHash("sha256")
    .update([model, query, treatment, brand].join("|"))
    .digest("hex");
}

export async function resolveBackgroundImage(
  spec: DisplayRenderSpec,
  brandKit: BrandKit | null,
  allowAi = true,
): Promise<BackgroundResult> {
  const image = spec.image;

  // 1. An explicit URL on the spec wins (only if it's a safe scheme).
  if (image?.url && isHttpUrl(image.url)) {
    return { url: image.url, source: "spec" };
  }

  const query = image?.query?.trim();

  // 2. AI generation — gated by env (provider+key) AND the per-client toggle.
  //    Cached in Supabase Storage. Best-effort.
  const generator = query && allowAi ? getImageGenerator() : null;
  if (generator && query) {
    try {
      const env = serverEnv();
      const storage = getServiceClient().storage.from(env.IMAGE_GEN_BUCKET);
      const path = `bg/${cacheKey(env.IMAGE_GEN_MODEL, query, spec.image_treatment, brandKit)}.png`;

      // Cache hit → reuse the stored image (no generation cost).
      const hit = await storage.createSignedUrl(path, SIGNED_URL_TTL_S);
      if (hit.data?.signedUrl) {
        return { url: hit.data.signedUrl, source: "generated_cache" };
      }

      // Miss → generate once, store, then sign.
      const img = await generator.generate({
        prompt: buildPrompt(query, brandKit),
        aspectRatio: "16:9",
      });
      const up = await storage.upload(path, Buffer.from(img.bytes), {
        contentType: img.mimeType,
        upsert: true,
      });
      if (!up.error) {
        const signed = await storage.createSignedUrl(path, SIGNED_URL_TTL_S);
        if (signed.data?.signedUrl) {
          return { url: signed.data.signedUrl, source: "generated" };
        }
      }
    } catch (err) {
      // Never let image-gen break a render — fall through to stock.
      console.warn("[render/background] AI generation unavailable; using stock", err);
    }
  }

  // 3. Stock providers, then null → caller draws the brand gradient.
  const stock = await resolveStockImage(spec, {
    unsplashKey: process.env.UNSPLASH_ACCESS_KEY,
    pexelsKey: process.env.PEXELS_API_KEY,
  });
  return { url: stock.url, source: stock.source };
}
