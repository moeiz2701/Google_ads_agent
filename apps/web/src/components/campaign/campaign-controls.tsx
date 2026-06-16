"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { canTransition } from "@gaa/shared";
import type { CampaignStatus } from "@gaa/shared";
import { Button } from "@/components/ui/primitives";

/**
 * Campaign lifecycle controls — shown in Campaign Detail header (§9.6).
 * All state changes go through POST /api/campaigns/:id/transition.
 * "Approve & Launch" is Phase 7; shown disabled with a note.
 */
export function CampaignControls({
  campaignId,
  currentStatus,
}: {
  campaignId: string;
  currentStatus: CampaignStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(to: CampaignStatus) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Could not move to ${to}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/duplicate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not duplicate");
      // Navigate to the copy
      router.push(`/campaigns/${data.campaign.campaign_id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not duplicate");
    } finally {
      setBusy(false);
    }
  }

  const can = (to: CampaignStatus) => canTransition(currentStatus, to);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Pause / Resume */}
      {can("paused") && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => transition("paused")}
          disabled={busy}
        >
          Pause
        </Button>
      )}
      {can("running") && currentStatus === "paused" && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => transition("running")}
          disabled={busy}
        >
          Resume
        </Button>
      )}

      {/* Submit for approval */}
      {can("pending_approval") && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => transition("pending_approval")}
          disabled={busy}
        >
          Submit for Approval
        </Button>
      )}

      {/* Duplicate */}
      <Button variant="secondary" size="sm" onClick={duplicate} disabled={busy}>
        Duplicate
      </Button>

      {/* Archive / Restore */}
      {can("archived") && (
        <Button
          variant="danger"
          size="sm"
          onClick={() => transition("archived")}
          disabled={busy}
        >
          Archive
        </Button>
      )}
      {currentStatus === "archived" && can("draft") && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => transition("draft")}
          disabled={busy}
        >
          Restore
        </Button>
      )}

      {/* Approve & Launch — disabled in Phase 7 */}
      <Button
        variant="primary"
        size="sm"
        disabled
        title="Approval and Google Ads test-account publishing is wired in Phase 7"
      >
        Approve &amp; Launch
      </Button>

      {error && (
        <p role="alert" className="font-mono text-[11px] tracking-[0.05em] text-red">
          {error}
        </p>
      )}
    </div>
  );
}
