/**
 * Root loading UI for the (app) route group.
 * Shown while any server component in this group is fetching.
 */
export default function Loading() {
  return (
    <div className="max-w-content mx-auto">
      {/* Header skeleton */}
      <div className="pb-6 border-b border-border mb-10">
        <div className="h-3 w-24 bg-surface-2 mb-4 animate-pulse" />
        <div className="h-10 w-64 bg-surface-2 animate-pulse" />
      </div>

      {/* Content skeletons */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-16 bg-surface border border-border animate-pulse"
            style={{ opacity: 1 - i * 0.15 }}
          />
        ))}
      </div>

      <p className="font-mono text-[11px] tracking-[0.15em] uppercase text-ink-3 mt-8 text-center animate-pulse">
        {"// Loading..."}
      </p>
    </div>
  );
}
