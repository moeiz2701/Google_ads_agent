import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientEnv, serverEnv } from "@/lib/env";

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 *
 * MVP is single-agency with light auth (§12), so server routes use the
 * service-role client for data ops. When real multi-tenant auth lands, swap this
 * for an RLS-respecting per-request client (@supabase/ssr) — call sites won't change.
 *
 * NEVER import this from a client component; `server-only` enforces that.
 */
let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cached) return cached;
  const pub = clientEnv();
  const srv = serverEnv();
  cached = createClient(pub.NEXT_PUBLIC_SUPABASE_URL, srv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
