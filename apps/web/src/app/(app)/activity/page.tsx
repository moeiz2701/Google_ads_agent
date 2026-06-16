import { listRecentActivity } from "@/lib/db/dashboard";
import { PageHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAction(action: string): string {
  return action.replace(/\./g, " ").replace(/_/g, " ");
}

export default async function ActivityPage() {
  let activity: Awaited<ReturnType<typeof listRecentActivity>> = [];
  let loadError: string | null = null;

  try {
    activity = await listRecentActivity(100);
  } catch (err) {
    loadError = "Could not load activity log.";
    console.error("[activity]", err);
  }

  return (
    <div className="max-w-content mx-auto space-y-8">
      <PageHeader
        eyebrow="Agency Console"
        title="Activity"
        meta={`${activity.length} events`}
      />

      {loadError && (
        <div className="border border-red bg-red-bg px-5 py-4 font-sans text-sm text-red" role="alert">
          {loadError}
        </div>
      )}

      {activity.length === 0 && !loadError ? (
        <div className="border border-border px-6 py-16 text-center">
          <p className="font-display text-[22px] font-[700] uppercase text-ink-3 mb-2">
            No Activity Yet
          </p>
          <p className="font-mono text-[12px] tracking-[0.05em] text-ink-3">
            {"// Every mutating action (launches, edits, status changes) appears here."}
          </p>
        </div>
      ) : (
        <div className="border border-border divide-y divide-border">
          {activity.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-4 px-5 py-5 hover:bg-surface transition-colors"
            >
              <div className="w-1.5 h-1.5 mt-2 bg-accent-dim shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="font-sans text-sm font-[500] text-ink-2 capitalize">
                  {formatAction(entry.action)}
                </p>
                <div className="flex flex-wrap gap-3 mt-1">
                  {entry.actor && (
                    <span className="font-mono text-[11px] tracking-[0.05em] text-ink-3">
                      {"// "}{entry.actor}
                    </span>
                  )}
                  {entry.client_id && (
                    <span className="font-mono text-[11px] tracking-[0.05em] text-ink-3">
                      client: {entry.client_id.slice(0, 8)}
                    </span>
                  )}
                  {entry.campaign_id && (
                    <span className="font-mono text-[11px] tracking-[0.05em] text-ink-3">
                      campaign: {entry.campaign_id.slice(0, 8)}
                    </span>
                  )}
                </div>
                {entry.details && Object.keys(entry.details).length > 0 && (
                  <p className="font-mono text-[11px] tracking-[0.05em] text-ink-3 mt-1 truncate">
                    {JSON.stringify(entry.details)}
                  </p>
                )}
              </div>
              <time
                dateTime={entry.created_at}
                className="font-mono text-[11px] tracking-[0.05em] text-ink-3 shrink-0"
              >
                {formatDate(entry.created_at)}
              </time>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
