import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canTransition, type CampaignStatus } from "@gaa/shared";
import { getCampaign, markLaunched } from "@/lib/db/campaigns";
import { getClientProfile } from "@/lib/db/clients";
import { logAction } from "@/lib/db/audit";
import { executeLaunch } from "@/lib/execution/execute";
import { postLaunchStatus } from "@/lib/execution/status";
import { PolicyError, ValidationError } from "@/lib/execution/errors";
import { GoogleAdsError } from "@/lib/google-ads";
import { handleRouteError, jsonError } from "@/lib/http";

export const runtime = "nodejs";

/**
 * POST /api/campaigns/:id/launch — the approval gate + deterministic execution
 * (Module 5, §7). This is the explicit human launch action; there is NO
 * autonomous publish anywhere else (CLAUDE.md supreme law). MVP publishes to a
 * Google Ads TEST account only.
 *
 * Flow: load campaign + client profile → idempotency guard → executeLaunch
 * (budget cap + policy gate + enabled-only, all deterministic) → markLaunched +
 * audit. Failures are audited too.
 */

const Body = z.object({
  /** Operating Google Ads (test client) account; dashes allowed (stripped). */
  customerId: z.string().min(1).optional(),
});

/** Only an unlaunched campaign may be launched. */
const LAUNCHABLE: CampaignStatus[] = ["draft", "pending_approval"];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  let clientId: string | null = null;
  try {
    const body = Body.parse(await req.json().catch(() => ({})));

    const campaign = await getCampaign(params.id);
    if (!campaign) return jsonError(404, "Campaign not found");
    clientId = campaign.client_id;

    // Idempotency: anything already past the gate must not re-launch.
    if (!LAUNCHABLE.includes(campaign.status)) {
      return jsonError(
        409,
        `Campaign is ${campaign.status} — only draft or pending-approval campaigns can be launched`,
      );
    }

    const profile = await getClientProfile(campaign.client_id);
    if (!profile) return jsonError(404, "Client profile not found for campaign");

    // Decide target status, then validate the transition where it applies.
    const nextStatus = postLaunchStatus(campaign.flight_dates);
    if (
      campaign.status === "pending_approval" &&
      !canTransition(campaign.status, nextStatus)
    ) {
      return jsonError(409, `Cannot move ${campaign.status} → ${nextStatus}`);
    }

    const result = await executeLaunch(campaign, profile, {
      customerId: body.customerId,
    });

    await markLaunched(params.id, nextStatus, result);
    await logAction({
      action: "campaign.launched",
      clientId: campaign.client_id,
      campaignId: params.id,
      details: {
        status: nextStatus,
        customerId: result.customerId,
        campaignResourceName: result.campaignResourceName,
        budgetResourceName: result.budgetResourceName,
        adGroupCount: result.adGroupResourceNames.length,
        adCount: result.adResourceNames.length,
        warnings: result.warnings,
      },
    });

    return NextResponse.json({ status: nextStatus, result });
  } catch (err) {
    // Audit every failed launch attempt (best-effort; never masks the response).
    await logAction({
      action: "campaign.launch_failed",
      clientId,
      campaignId: params.id,
      details: { error: errorSummary(err) },
    });

    if (err instanceof PolicyError) {
      return jsonError(422, err.message, { violations: err.violations });
    }
    if (err instanceof ValidationError) {
      return jsonError(400, err.message, err.details);
    }
    if (err instanceof GoogleAdsError) {
      // Upstream (Google Ads) failure — bad gateway, not our fault.
      return jsonError(502, "Google Ads API rejected the launch", {
        retryable: err.opts.retryable,
        status: err.opts.status,
        message: err.message,
      });
    }
    return handleRouteError("api/campaigns/:id/launch", err);
  }
}

/** A safe, secret-free one-line summary of a thrown error for the audit log. */
function errorSummary(err: unknown): string {
  if (err instanceof PolicyError) return `policy: ${err.violations.length} violation(s)`;
  if (err instanceof ValidationError) return `validation: ${err.message}`;
  if (err instanceof GoogleAdsError) return `google-ads: ${err.message}`;
  if (err instanceof Error) return err.name;
  return "unknown";
}
