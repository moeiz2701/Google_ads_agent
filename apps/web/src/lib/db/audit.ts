import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { DEFAULT_AGENCY_ID } from "./constants";

/**
 * Append a row to the audit log. Every mutating action is logged (CLAUDE.md
 * supreme law). Best-effort: an audit write failure must never break the action
 * it records, but it is logged to the server console for follow-up.
 */
export async function logAction(entry: {
  action: string;
  actor?: string;
  clientId?: string | null;
  campaignId?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await getServiceClient().from("audit_log").insert({
      agency_id: DEFAULT_AGENCY_ID,
      client_id: entry.clientId ?? null,
      campaign_id: entry.campaignId ?? null,
      actor: entry.actor ?? "system",
      action: entry.action,
      details: entry.details ?? null,
    });
    if (error) throw error;
  } catch (err) {
    console.error("[audit] failed to record action", entry.action, err);
  }
}
