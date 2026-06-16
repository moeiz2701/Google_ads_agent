"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";

export function RunAnalysisButton({
  clientId,
  hasAnalysis,
}: {
  clientId: string;
  hasAnalysis: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setRunning(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/analyze`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={run} disabled={running} variant={hasAnalysis ? "secondary" : "primary"}>
        {running
          ? "Analyzing competitors…"
          : hasAnalysis
            ? "Re-run analysis"
            : "Run competitor analysis"}
      </Button>
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}
