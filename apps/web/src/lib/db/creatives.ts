import "server-only";
import { type BrandKit, type Variant, BrandKit as BrandKitSchema, RenderSpec } from "@gaa/shared";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";

/** Creative Library persistence (§9.9). Stores generated render-specs per client. */

export interface CreativeRecord {
  id: string;
  format: "search" | "display";
  spec: RenderSpec;
  insight_ref: string | null;
  status: string;
  rendered_urls: Record<string, string> | null;
}

const CreativeRow = z.object({
  id: z.string(),
  format: z.enum(["search", "display"]),
  spec: RenderSpec,
  insight_ref: z.string().nullable(),
  status: z.string(),
  rendered_urls: z.record(z.string()).nullable(),
});

export async function saveCreatives(
  clientId: string,
  variants: Variant[],
): Promise<number> {
  if (variants.length === 0) return 0;
  const rows = variants.map((v) => ({
    client_id: clientId,
    format: v.spec.format,
    spec: v.spec,
    insight_ref: v.insight_ref,
    status: "unused",
  }));
  const { error, count } = await getServiceClient()
    .from("creatives")
    .insert(rows, { count: "exact" });
  if (error) throw new Error(`Failed to save creatives: ${error.message}`);
  return count ?? rows.length;
}

/** The data the renderer needs for one creative: its spec, the client brand kit,
 *  and the per-client AI-background preference (read here, not on ClientProfile). */
export async function getCreativeRenderData(
  creativeId: string,
): Promise<
  { spec: RenderSpec; brandKit: BrandKit | null; allowAi: boolean } | null
> {
  const { data, error } = await getServiceClient()
    .from("creatives")
    .select("spec, client:clients(brand_kit, use_ai_backgrounds)")
    .eq("id", creativeId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load creative: ${error.message}`);
  if (!data) return null;

  const spec = RenderSpec.safeParse((data as { spec: unknown }).spec);
  if (!spec.success) throw new Error("Stored creative spec is invalid");

  // Supabase returns the joined row as an object (or array); normalize.
  const joined = (data as { client: unknown }).client;
  const clientRow = (Array.isArray(joined) ? joined[0] : joined) as
    | { brand_kit?: unknown; use_ai_backgrounds?: boolean | null }
    | null;
  const bk = BrandKitSchema.safeParse(clientRow?.brand_kit);
  return {
    spec: spec.data,
    brandKit: bk.success ? bk.data : null,
    // Default true so a client predating the column behaves as before.
    allowAi: clientRow?.use_ai_backgrounds ?? true,
  };
}

/** Change a Display creative's template (per-variant control, §5.1). Validates
 *  the stored spec and that it's a Display creative. Returns a status the route
 *  maps to an HTTP code. */
export async function updateCreativeTemplate(
  creativeId: string,
  templateId: string,
): Promise<"ok" | "not_found" | "not_display"> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("creatives")
    .select("spec")
    .eq("id", creativeId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load creative: ${error.message}`);
  if (!data) return "not_found";

  const spec = RenderSpec.safeParse((data as { spec: unknown }).spec);
  if (!spec.success) throw new Error("Stored creative spec is invalid");
  if (spec.data.format !== "display") return "not_display";

  const updated = { ...spec.data, template_id: templateId };
  const { error: upErr } = await db
    .from("creatives")
    .update({ spec: updated })
    .eq("id", creativeId);
  if (upErr) throw new Error(`Failed to update creative: ${upErr.message}`);
  return "ok";
}

export async function listCreatives(
  clientId: string,
): Promise<CreativeRecord[]> {
  const { data, error } = await getServiceClient()
    .from("creatives")
    .select("id, format, spec, insight_ref, status, rendered_urls")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to list creatives: ${error.message}`);
  // Drop any row that fails schema validation rather than crash the page.
  const out: CreativeRecord[] = [];
  for (const row of data ?? []) {
    const parsed = CreativeRow.safeParse(row);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
