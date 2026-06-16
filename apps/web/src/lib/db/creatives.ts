import "server-only";
import { type Variant, RenderSpec } from "@gaa/shared";
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
