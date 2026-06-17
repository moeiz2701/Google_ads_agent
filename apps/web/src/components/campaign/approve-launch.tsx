"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdNetwork, Budget, CampaignStatus } from "@gaa/shared";
import { Button } from "@/components/ui/primitives";

/**
 * The approval gate (§7.1) — the ONLY publish entry point. A human reviews, then
 * explicitly Approves & Launches; a confirmation modal restates the hard budget
 * cap before firing POST /api/campaigns/:id/launch. No autonomous publishing.
 *
 * Shown only for launchable states (draft / pending_approval). MVP publishes to a
 * Google Ads TEST account — no real spend or serving.
 */
export function ApproveLaunch({
  campaignId,
  status,
  budget,
  budgetCap,
  networks,
  enabledAds,
}: {
  campaignId: string;
  status: CampaignStatus;
  budget: Budget;
  budgetCap: number;
  networks: AdNetwork[];
  enabledAds: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [violations, setViolations] = useState<string[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (status !== "draft" && status !== "pending_approval") return null;

  async function launch() {
    setError(null);
    setViolations([]);
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/launch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(customerId.trim() ? { customerId: customerId.trim() } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 422 && Array.isArray(data.details?.violations)) {
          setViolations(data.details.violations as string[]);
        }
        throw new Error(data.error ?? "Launch failed");
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed");
    } finally {
      setBusy(false);
    }
  }

  const overCap = budget.amount >= budgetCap;

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        Approve &amp; Launch
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="launch-title"
            className="w-full max-w-md border border-accent-dim bg-surface p-6"
          >
            <h2
              id="launch-title"
              className="font-display text-[24px] font-[800] uppercase tracking-[-0.005em] text-ink"
            >
              Approve &amp; Launch
            </h2>
            <p className="mt-1 font-mono text-[12px] tracking-[0.05em] text-ink-3">
              {"// Publishes to the Google Ads TEST account — no real spend or serving"}
            </p>

            <dl className="mt-5 space-y-2 border-t border-border pt-4 font-mono text-[12px] tracking-[0.05em]">
              <Row label="Daily budget">
                <span className="text-ink">
                  ${budget.amount}/{budget.currency}
                </span>{" "}
                <span className="text-ink-3">
                  (cap ${budgetCap}
                  {overCap ? " — at cap" : ""})
                </span>
              </Row>
              <Row label="Networks">
                <span className="text-ink-2 capitalize">{networks.join(" + ") || "—"}</span>
              </Row>
              <Row label="Variants live">
                <span className="text-ink-2">{enabledAds}</span>
              </Row>
            </dl>

            <label
              htmlFor="customer-id"
              className="mt-5 block font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-ink-3"
            >
              {"// Test client account ID"}
            </label>
            <input
              id="customer-id"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="123-456-7890 (optional in mock mode)"
              className="mt-2 w-full border border-border bg-surface-2 px-4 py-3 font-sans text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
            />

            {violations.length > 0 && (
              <div className="mt-4 border-l-2 border-red bg-red-bg px-4 py-3">
                <p className="font-mono text-[11px] tracking-[0.1em] uppercase text-red">
                  {"// Policy check failed"}
                </p>
                <ul className="mt-1 space-y-0.5 font-sans text-sm text-ink-2">
                  {violations.map((v) => (
                    <li key={v}>· {v}</li>
                  ))}
                </ul>
              </div>
            )}
            {error && violations.length === 0 && (
              <p role="alert" className="mt-4 font-mono text-[12px] tracking-[0.05em] text-red">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={launch} disabled={busy || enabledAds === 0}>
                {busy ? "Launching…" : "Launch to test account"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-3">{"// "}{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
