import { NextResponse, type NextRequest } from "next/server";
import { getClientProfile } from "@/lib/db/clients";
import { saveAnalysis } from "@/lib/db/analyses";
import { analyzeCompetitors, AiServiceError, NoRelevantAdsError } from "@/lib/ai/client";
import { logAction } from "@/lib/db/audit";
import { handleRouteError, jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 180;

/** POST /api/clients/:id/analyze — run Module 2 and persist the analysis. */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const client = await getClientProfile(params.id);
    if (!client) return jsonError(404, "Client not found");

    const analysis = await analyzeCompetitors(client);
    const analysisId = await saveAnalysis(client.client_id, analysis);
    await logAction({
      action: "analysis.completed",
      clientId: client.client_id,
      details: {
        analysis_id: analysisId,
        source_ad_count: analysis.source_ad_count,
        gaps: analysis.gap_opportunities.length,
      },
    });
    return NextResponse.json({ analysis, analysis_id: analysisId }, { status: 201 });
  } catch (err) {
    // Actionable "no relevant ads" → 422 with the clean message (UI shows it as-is).
    if (err instanceof NoRelevantAdsError) return jsonError(422, err.message);
    if (err instanceof AiServiceError) return jsonError(502, err.message);
    return handleRouteError("api/clients/:id/analyze", err);
  }
}
