import {
  type GenerateImageInput,
  type GeneratedImage,
  type ImageGenerator,
  ImageGenError,
} from "./types";

/**
 * Gemini/Imagen background-image generator over the REST API (no SDK).
 * Uses the Generative Language `:predict` endpoint with the org's GEMINI_API_KEY.
 */
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_TIMEOUT_MS = 45_000;

export class GeminiImageGenerator implements ImageGenerator {
  readonly name = "gemini";
  constructor(
    private readonly model: string,
    private readonly apiKey: string,
  ) {}

  async generate(input: GenerateImageInput): Promise<GeneratedImage> {
    const url = `${ENDPOINT}/${this.model}:predict?key=${this.apiKey}`;
    const body = {
      instances: [{ prompt: input.prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: input.aspectRatio ?? "16:9",
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        // 429 / 5xx are transient; 4xx (auth/bad request/quota) are terminal.
        const retryable = res.status === 429 || res.status >= 500;
        throw new ImageGenError(`Imagen HTTP ${res.status}: ${text.slice(0, 300)}`, {
          retryable,
        });
      }
      const data = (await res.json()) as {
        predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
      };
      const pred = data.predictions?.[0];
      if (!pred?.bytesBase64Encoded) {
        throw new ImageGenError("Imagen response contained no image", {
          retryable: true,
        });
      }
      const bytes = Uint8Array.from(Buffer.from(pred.bytesBase64Encoded, "base64"));
      return { bytes, mimeType: pred.mimeType ?? "image/png" };
    } catch (err) {
      if (err instanceof ImageGenError) throw err;
      // network error / abort → retryable
      throw new ImageGenError("Imagen request failed", { retryable: true, cause: err });
    } finally {
      clearTimeout(timer);
    }
  }
}
