import { NextResponse, type NextRequest } from "next/server";
import { duplicateCampaign } from "@/lib/db/campaigns";
import { logAction } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";

/** POST /api/campaigns/:id/duplicate — clone as a new Draft (§9.5). */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const copy = await duplicateCampaign(params.id);
    await logAction({
      action: "campaign.duplicated",
      clientId: copy.client_id,
      campaignId: copy.campaign_id,
      details: { from: params.id },
    });
    return NextResponse.json({ campaign: copy }, { status: 201 });
  } catch (err) {
    return handleRouteError("api/campaigns/:id/duplicate", err);
  }
}
