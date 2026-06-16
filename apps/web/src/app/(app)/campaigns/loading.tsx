export default function CampaignsLoading() {
  return (
    <div className="max-w-content mx-auto">
      <div className="pb-6 border-b border-border mb-8">
        <div className="h-3 w-32 bg-surface-2 mb-4 animate-pulse" />
        <div className="h-10 w-48 bg-surface-2 animate-pulse" />
      </div>
      <div className="flex gap-3 mb-8">
        <div className="flex-1 h-11 bg-surface-2 animate-pulse" />
        <div className="w-32 h-11 bg-surface-2 animate-pulse" />
      </div>
      {[1, 2, 3].map((g) => (
        <div key={g} className="mb-8">
          <div className="h-3 w-24 bg-surface-2 mb-3 animate-pulse" />
          <div className="border border-border divide-y divide-border">
            {[1, 2].map((r) => (
              <div key={r} className="h-16 px-5 flex items-center animate-pulse">
                <div className="w-28 h-6 bg-surface-2 mr-4" />
                <div className="flex-1 h-4 bg-surface-2" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="font-mono text-[11px] tracking-[0.15em] uppercase text-ink-3 text-center animate-pulse">
        {"// Loading campaigns..."}
      </p>
    </div>
  );
}
