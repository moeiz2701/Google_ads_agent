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
