/**
 * Provider-abstracted background-image generation (mirrors `lib/llm` and
 * `lib/google-ads`). The generator only produces a raw image; deterministic code
 * (the render layer) composites text/logo/CTA on top via Satori. This keeps ad
 * copy crisp, editable, and policy-gated — the supreme-law boundary: the model
 * never produces the finished ad, only the backdrop layer.
 */

export class ImageGenError extends Error {
  readonly retryable: boolean;
  constructor(message: string, opts: { retryable?: boolean; cause?: unknown } = {}) {
    super(message);
    this.name = "ImageGenError";
    this.retryable = opts.retryable ?? false;
    if (opts.cause !== undefined) (this as { cause?: unknown }).cause = opts.cause;
  }
}

export interface GeneratedImage {
  bytes: Uint8Array;
  mimeType: string;
}

export interface GenerateImageInput {
  prompt: string;
  /** Provider aspect ratio hint, e.g. "16:9". Renderer covers/crops to the size. */
  aspectRatio?: string;
  timeoutMs?: number;
}

export interface ImageGenerator {
  readonly name: string;
  generate(input: GenerateImageInput): Promise<GeneratedImage>;
}
