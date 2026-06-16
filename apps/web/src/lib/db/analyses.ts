import "server-only";
import { AnalysisObject } from "@gaa/shared";
import { getServiceClient } from "@/lib/supabase/server";

/** Persistence for analysis_object (§4.4) keyed by client. */

export async function saveAnalysis(
  clientId: string,
  analysis: AnalysisObject,
): Promise<string> {
  const { data, error } = await getServiceClient()
    .from("analyses")
    .insert({
      client_id: clientId,
      vertical: analysis.vertical,
      geo: analysis.geo,
      analysis,
      source_ad_count: analysis.source_ad_count,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to save analysis: ${error.message}`);
  return (data as { id: string }).id;
}

export async function getLatestAnalysis(
  clientId: string,
): Promise<AnalysisObject | null> {
  return (await getLatestAnalysisWithId(clientId))?.analysis ?? null;
}

/** Latest analysis plus its row id (needed to link a campaign's analysis_id). */
export async function getLatestAnalysisWithId(
  clientId: string,
): Promise<{ id: string; analysis: AnalysisObject } | null> {
  const { data, error } = await getServiceClient()
    .from("analyses")
    .select("id, analysis")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load analysis: ${error.message}`);
  if (!data) return null;
  const row = data as { id: string; analysis: unknown };
  const parsed = AnalysisObject.safeParse(row.analysis);
  return parsed.success ? { id: row.id, analysis: parsed.data } : null;
}
