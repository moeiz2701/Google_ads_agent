"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";

export function AssembleButton({
  clientId,
  disabled,
  hasCampaigns,
}: {
  clientId: string;
  disabled: boolean;
  hasCampaigns: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setRunning(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/campaigns`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Assembly failed");
      router.push(`/campaigns/${data.campaign.campaign_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assembly failed");
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={run}
        disabled={running || disabled}
        variant={hasCampaigns ? "secondary" : "primary"}
        title={disabled ? "Run analysis first" : undefined}
      >
        {running ? "Assembling…" : hasCampaigns ? "Assemble another" : "Assemble campaign"}
      </Button>
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}
