import "server-only";
import { serverEnv } from "@/lib/env";
import { GeminiImageGenerator } from "./gemini";
import { type ImageGenerator } from "./types";

export type { ImageGenerator, GeneratedImage, GenerateImageInput } from "./types";
export { ImageGenError } from "./types";

let cached: ImageGenerator | null | undefined;

/**
 * The configured background-image generator, or null when disabled.
 *
 * Env-gated like the stock-image keys: returns null unless IMAGE_GEN_PROVIDER
 * names a provider AND its key is present. With no config the renderer keeps its
 * existing stock-photo / brand-gradient behavior — AI imagery is a pure add-on,
 * never a requirement. Provider is a config change (mirrors `getLlm`).
 */
export function getImageGenerator(): ImageGenerator | null {
  if (cached !== undefined) return cached;
  const env = serverEnv();
  if (env.IMAGE_GEN_PROVIDER === "gemini" && env.GEMINI_API_KEY) {
    cached = new GeminiImageGenerator(env.IMAGE_GEN_MODEL, env.GEMINI_API_KEY);
  } else {
    cached = null;
  }
  return cached;
}

/** Whether AI image generation is configured (provider + key). Used by the UI to
 *  label the resolved background source without performing a render. */
export function imageGenConfigured(): boolean {
  return getImageGenerator() !== null;
}
