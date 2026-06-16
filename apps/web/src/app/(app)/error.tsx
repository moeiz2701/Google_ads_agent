"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/primitives";

/**
 * Root error boundary for the (app) route group.
 * Clear, recoverable messaging per §9.11.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="max-w-content mx-auto">
      <div className="border border-red bg-red-bg px-8 py-12 text-center">
        <p className="font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-red mb-3">
          {"// Error"}
        </p>
        <h1 className="font-display text-[36px] font-[800] uppercase tracking-[-0.01em] text-ink mb-4">
          Something Went Wrong
        </h1>
        <p className="font-sans text-sm text-ink-3 max-w-sm mx-auto mb-6">
          {error.message || "An unexpected error occurred. Try refreshing."}
        </p>
        {error.digest && (
          <p className="font-mono text-[11px] tracking-[0.05em] text-ink-3 mb-6">
            {"// Digest: "}{error.digest}
          </p>
        )}
        <Button variant="secondary" onClick={reset}>
          Try Again
        </Button>
      </div>
    </div>
  );
}
