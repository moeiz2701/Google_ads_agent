import { NextResponse, type NextRequest } from "next/server";
import { CampaignConfig } from "@gaa/shared";
import { getCampaign, updateCampaign } from "@/lib/db/campaigns";
import { getClientProfile } from "@/lib/db/clients";
import { logAction } from "@/lib/db/audit";
import { handleRouteError, jsonError } from "@/lib/http";

export const runtime = "nodejs";

/** GET /api/campaigns/:id */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const campaign = await getCampaign(params.id);
    if (!campaign) return jsonError(404, "Campaign not found");
    return NextResponse.json({ campaign });
  } catch (err) {
    return handleRouteError("api/campaigns/:id GET", err);
  }
}

/**
 * PATCH /api/campaigns/:id — persist configure-by-exception edits.
 * The budget is hard-capped to the client's agreed profile budget here
 * (deterministic guard — the UI shows the cap, the server enforces it).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const existing = await getCampaign(params.id);
    if (!existing) return jsonError(404, "Campaign not found");

    const incoming = CampaignConfig.parse(await req.json());
    if (incoming.campaign_id !== params.id) {
      return jsonError(400, "Campaign id mismatch");
    }

    // Enforce the budget cap against the client's profile (never trust the client).
    const client = await getClientProfile(existing.client_id);
    const cap = client?.budget.amount ?? existing.budget.amount;
    const capped = Math.min(incoming.budget.amount, cap);
    const config = { ...incoming, budget: { ...incoming.budget, amount: capped } };

    const saved = await updateCampaign(params.id, config);
    await logAction({
      action: "campaign.edited",
      clientId: saved.client_id,
      campaignId: saved.campaign_id,
      details: { budget: saved.budget.amount, capped: capped < incoming.budget.amount },
    });
    return NextResponse.json({ campaign: saved });
  } catch (err) {
    return handleRouteError("api/campaigns/:id PATCH", err);
  }
}
