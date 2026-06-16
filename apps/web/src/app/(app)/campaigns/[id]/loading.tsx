export default function CampaignDetailLoading() {
  return (
    <div className="max-w-[900px] mx-auto">
      <div className="h-3 w-32 bg-surface-2 mb-6 animate-pulse" />
      <div className="pb-6 border-b border-border mb-8">
        <div className="h-3 w-20 bg-surface-2 mb-3 animate-pulse" />
        <div className="flex items-center gap-3 mb-4">
          <div className="h-12 w-72 bg-surface-2 animate-pulse" />
          <div className="w-24 h-6 bg-surface-2 animate-pulse" />
        </div>
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-24 h-9 bg-surface-2 animate-pulse" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-16 bg-surface border border-border animate-pulse" />
        ))}
      </div>
      <p className="font-mono text-[11px] tracking-[0.15em] uppercase text-ink-3 text-center animate-pulse">
        {"// Loading campaign..."}
      </p>
    </div>
  );
}
