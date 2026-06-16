"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/primitives";

export default function CampaignDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[campaign detail error]", error);
  }, [error]);

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="border border-red bg-red-bg px-8 py-12 text-center">
        <p className="font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-red mb-3">
          {"// Campaign Error"}
        </p>
        <h1 className="font-display text-[28px] font-[800] uppercase text-ink mb-4">
          Could Not Load Campaign
        </h1>
        <p className="font-sans text-sm text-ink-3 max-w-sm mx-auto mb-6">
          {error.message || "This campaign may not exist or there was a database error."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={reset}>
            Try Again
          </Button>
          <Link href="/campaigns">
            <Button variant="ghost">Back to Campaigns</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
