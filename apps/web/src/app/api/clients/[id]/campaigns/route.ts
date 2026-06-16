import { NextResponse, type NextRequest } from "next/server";
import { getClientProfile } from "@/lib/db/clients";
import { getLatestAnalysisWithId } from "@/lib/db/analyses";
import { listCreatives } from "@/lib/db/creatives";
import { saveCampaign } from "@/lib/db/campaigns";
import { assembleCampaign } from "@/lib/campaign/assemble";
import { logAction } from "@/lib/db/audit";
import { handleRouteError, jsonError } from "@/lib/http";

export const runtime = "nodejs";

/** POST /api/clients/:id/campaigns — assemble a smart-default draft campaign. */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const client = await getClientProfile(params.id);
    if (!client) return jsonError(404, "Client not found");

    const latest = await getLatestAnalysisWithId(params.id);
    if (!latest) {
      return jsonError(409, "Run competitor analysis before assembling a campaign.");
    }

    const creatives = await listCreatives(params.id);
    const config = assembleCampaign(
      client,
      latest.analysis,
      creatives.map((c) => ({
        id: c.id,
        format: c.format,
        spec: c.spec,
        insight_ref: c.insight_ref,
      })),
      { analysisId: latest.id },
    );

    const saved = await saveCampaign(config);
    await logAction({
      action: "campaign.assembled",
      clientId: client.client_id,
      campaignId: saved.campaign_id,
      details: {
        ad_groups: saved.ad_groups.length,
        ads: saved.ad_groups.reduce((n, g) => n + g.ads.length, 0),
      },
    });
    return NextResponse.json({ campaign: saved }, { status: 201 });
  } catch (err) {
    return handleRouteError("api/clients/:id/campaigns POST", err);
  }
}
