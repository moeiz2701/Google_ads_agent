import { z } from "zod";

/**
 * Centralized, validated environment access. Fail fast on misconfiguration
 * (CLAUDE.md: "Config validated at startup"). Server-only secrets are never
 * read in client components — importing this module in a client bundle that
 * touches `serverEnv` will surface at build time.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  LLM_PROVIDER: z.enum(["gemini", "anthropic", "openai"]).default("gemini"),
  LLM_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  // Python AI service (Module 2 analysis, Module 3 generation).
  AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  // Module 2 corpus: fetch LIVE competitor ads (Transparency Center) by default,
  // or set true to force the deterministic cached demo corpus (safe demos / CI).
  ANALYSIS_USE_CACHED_CORPUS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // Max competitor ads to fetch/analyze per run (live path). ~60 gives a credible
  // gap map + per-competitor depth (breadth-first across ≤15 advertisers); the
  // longevity sort + relevance gate keep quality. Hard-capped at 100 for cost/latency.
  ANALYSIS_MAX_ADS: z.coerce.number().int().positive().max(100).default(60),

  // AI background-image generation (Module 4 rendering). Provider-abstracted,
  // OFF by default — when "none" (or the key is missing) the renderer keeps its
  // stock-photo / brand-gradient behavior. Set "gemini" + GEMINI_API_KEY to enable.
  // Generated images are cached in the IMAGE_GEN_BUCKET Supabase Storage bucket
  // (keyed by a brand+query+treatment hash) so each unique brief generates once.
  IMAGE_GEN_PROVIDER: z.enum(["none", "gemini"]).default("none"),
  IMAGE_GEN_MODEL: z.string().default("imagen-3.0-generate-002"),
  IMAGE_GEN_BUCKET: z.string().default("generated-creatives"),

  // Google Ads (Module 5 execution; MVP = TEST account). All optional — when any
  // is missing the execution layer falls back to the mock client.
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().optional(),
  GOOGLE_ADS_CLIENT_ID: z.string().optional(),
  GOOGLE_ADS_CLIENT_SECRET: z.string().optional(),
  GOOGLE_ADS_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: z.string().optional(),
  // Google Ads REST API version. Google sunsets versions every few months, so
  // keep this current and overridable without a code change (v17 was retired).
  GOOGLE_ADS_API_VERSION: z.string().default("v21"),
  // Force the mock client even when creds are present (safe demos / CI).
  GOOGLE_ADS_USE_MOCK: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

function parse<T extends z.ZodTypeAny>(schema: T, source: unknown): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n` +
        `Copy .env.example to apps/web/.env.local and fill in the values.`,
    );
  }
  return result.data;
}

/**
 * Browser-safe env (NEXT_PUBLIC_*). Lazy so a credential-less build doesn't throw
 * at import time — it throws on first use at request time instead.
 */
export const clientEnv = () =>
  parse(clientSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

/** Server-only env. Importing this in a client component is a bug. */
export const serverEnv = () => parse(serverSchema, process.env);
