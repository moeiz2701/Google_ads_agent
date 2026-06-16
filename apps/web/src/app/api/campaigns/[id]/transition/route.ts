import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CampaignStatus, canTransition } from "@gaa/shared";
import { getCampaign, updateCampaignStatus } from "@/lib/db/campaigns";
import { logAction } from "@/lib/db/audit";
import { handleRouteError, jsonError } from "@/lib/http";

export const runtime = "nodejs";

const Body = z.object({ to: CampaignStatus });

/**
 * POST /api/campaigns/:id/transition — lifecycle control (pause/resume/archive…).
 * Validates the transition against ALLOWED_TRANSITIONS (§9.2) before applying.
 * NOTE: transitions INTO `running`/`scheduled` are the launch path and belong to
 * Module 5 (execution); this endpoint covers pause/resume/archive/restore.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { to } = Body.parse(await req.json());
    const campaign = await getCampaign(params.id);
    if (!campaign) return jsonError(404, "Campaign not found");

    if (!canTransition(campaign.status, to)) {
      return jsonError(409, `Cannot move a ${campaign.status} campaign to ${to}`);
    }

    await updateCampaignStatus(params.id, to);
    await logAction({
      action: "campaign.status_changed",
      clientId: campaign.client_id,
      campaignId: params.id,
      details: { from: campaign.status, to },
    });
    return NextResponse.json({ status: to });
  } catch (err) {
    return handleRouteError("api/campaigns/:id/transition", err);
  }
}
