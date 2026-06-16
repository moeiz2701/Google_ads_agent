"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/primitives";

export default function CampaignsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[campaigns error]", error);
  }, [error]);

  return (
    <div className="max-w-content mx-auto">
      <div className="border border-red bg-red-bg px-8 py-12 text-center">
        <p className="font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-red mb-3">
          {"// Campaigns Error"}
        </p>
        <h1 className="font-display text-[28px] font-[800] uppercase text-ink mb-4">
          Could Not Load Campaigns
        </h1>
        <p className="font-sans text-sm text-ink-3 max-w-sm mx-auto mb-6">
          {error.message || "Check Supabase env vars and try again."}
        </p>
        <Button variant="secondary" onClick={reset}>
          Try Again
        </Button>
      </div>
    </div>
  );
}
