"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";

export function GenerateButton({
  clientId,
  disabled,
  hasCreatives,
}: {
  clientId: string;
  disabled: boolean;
  hasCreatives: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setRunning(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/generate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={run}
        disabled={running || disabled}
        variant={hasCreatives ? "secondary" : "primary"}
        title={disabled ? "Run competitor analysis first" : undefined}
      >
        {running
          ? "Generating variants…"
          : hasCreatives
            ? "Generate more"
            : "Generate variants"}
      </Button>
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}
