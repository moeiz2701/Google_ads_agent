import { z } from "zod";

/**
 * Campaign lifecycle (§9.2) — the spine of every dashboard view.
 *
 *   Draft → Pending Approval → Scheduled → Running → Paused → Completed → Archived
 *
 * Each state determines what is shown and what the user can do.
 */
export const CampaignStatus = z.enum([
  "draft",
  "pending_approval",
  "scheduled",
  "running",
  "paused",
  "completed",
  "archived",
]);
export type CampaignStatus = z.infer<typeof CampaignStatus>;

/** Legal forward transitions (validated by the execution/control layer, not the UI). */
export const ALLOWED_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["pending_approval", "archived"],
  pending_approval: ["scheduled", "running", "draft", "archived"],
  scheduled: ["running", "paused", "draft", "archived"],
  running: ["paused", "completed", "archived"],
  paused: ["running", "completed", "archived"],
  completed: ["archived"],
  archived: ["draft"],
};

export const canTransition = (
  from: CampaignStatus,
  to: CampaignStatus,
): boolean => ALLOWED_TRANSITIONS[from].includes(to);
