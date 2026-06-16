import Link from "next/link";
import { getPortfolioSummary, listRecentActivity } from "@/lib/db/dashboard";
import { PageHeader, StatusBadge, Card, Button } from "@/components/ui/primitives";
import type { CampaignStatus } from "@gaa/shared";

export const dynamic = "force-dynamic";

const STATUS_ORDER: CampaignStatus[] = [
  "running",
  "scheduled",
  "pending_approval",
  "draft",
  "paused",
  "completed",
  "archived",
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAction(action: string): string {
  return action.replace(/\./g, " ").replace(/_/g, " ");
}

export default async function DashboardPage() {
  let portfolio: Awaited<ReturnType<typeof getPortfolioSummary>> | null = null;
  let activity: Awaited<ReturnType<typeof listRecentActivity>> = [];
  let loadError: string | null = null;

  try {
    [portfolio, activity] = await Promise.all([
      getPortfolioSummary(),
      listRecentActivity(10),
    ]);
  } catch (err) {
    loadError = "Could not load dashboard data. Check Supabase env vars and run migrations.";
    console.error("[dashboard]", err);
  }

  return (
    <div className="max-w-content mx-auto space-y-10">
      <PageHeader
        eyebrow="Agency Console"
        title="Dashboard"
        actions={
          <Link href="/clients/new">
            <Button>+ New Client</Button>
          </Link>
        }
      />

      {loadError && (
        <div className="border border-red bg-red-bg px-5 py-4 font-sans text-sm text-red" role="alert">
          {loadError}
        </div>
      )}

      {portfolio && (
        <>
          {/* Needs Attention */}
          <section aria-labelledby="attention-heading">
            <h2
              id="attention-heading"
              className="font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-ink-3 mb-4"
            >
              {"// Needs Attention"}
            </h2>

            {portfolio.needsAttention.length === 0 ? (
              <div className="border border-border px-6 py-8 text-center">
                <p className="font-mono text-[12px] tracking-[0.05em] text-ink-3">
                  {"// No campaigns need action right now"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {portfolio.needsAttention.map((c) => (
                  <Link
                    key={c.campaign_id}
                    href={`/campaigns/${c.campaign_id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 bg-surface border border-border hover:border-border-2 transition-colors group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <StatusBadge status={c.status} />
                      <div className="min-w-0">
                        <p className="font-sans text-sm font-[500] text-ink truncate group-hover:text-accent transition-colors">
                          {c.name}
                        </p>
                        <p className="font-mono text-[11px] tracking-[0.05em] text-ink-3 mt-0.5">
                          {"// "}{c.client_name}
                        </p>
                      </div>
                    </div>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      className="shrink-0 text-ink-3 group-hover:text-accent transition-colors"
                      aria-hidden="true"
                    >
                      <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Portfolio Snapshot */}
          <section aria-labelledby="portfolio-heading">
            <h2
              id="portfolio-heading"
              className="font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-ink-3 mb-4"
            >
              {"// Portfolio Snapshot"}
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              <Card className="text-center py-6">
                <p className="font-display text-[48px] font-[800] text-ink leading-none">
                  {portfolio.totalClients}
                </p>
                <p className="font-mono text-[11px] tracking-[0.15em] uppercase text-ink-3 mt-2">
                  {"// Clients"}
                </p>
              </Card>
              <Card className="text-center py-6">
                <p className="font-display text-[48px] font-[800] text-ink leading-none">
                  {portfolio.totalCampaigns}
                </p>
                <p className="font-mono text-[11px] tracking-[0.15em] uppercase text-ink-3 mt-2">
                  {"// Campaigns"}
                </p>
              </Card>
              <Card className="text-center py-6">
                <p className="font-display text-[48px] font-[800] text-green leading-none">
                  {portfolio.byStatus.running}
                </p>
                <p className="font-mono text-[11px] tracking-[0.15em] uppercase text-ink-3 mt-2">
                  {"// Running"}
                </p>
              </Card>
              <Card className="text-center py-6">
                <p className="font-display text-[48px] font-[800] text-amber leading-none">
                  {portfolio.byStatus.pending_approval}
                </p>
                <p className="font-mono text-[11px] tracking-[0.15em] uppercase text-ink-3 mt-2">
                  {"// Pending Approval"}
                </p>
              </Card>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
              {STATUS_ORDER.map((status) => (
                <Link
                  key={status}
                  href={`/campaigns?status=${status}`}
                  className="flex flex-col items-center gap-2 px-3 py-4 bg-surface border border-border hover:border-border-2 transition-colors group"
                >
                  <span className="font-display text-[28px] font-[800] text-ink leading-none group-hover:text-accent transition-colors">
                    {portfolio.byStatus[status]}
                  </span>
                  <StatusBadge status={status} />
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Recent Activity */}
      <section aria-labelledby="activity-heading">
        <div className="flex items-center justify-between mb-4">
          <h2
            id="activity-heading"
            className="font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-ink-3"
          >
            {"// Recent Activity"}
          </h2>
          <Link
            href="/activity"
            className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-3 hover:text-accent transition-colors"
          >
            View all &rarr;
          </Link>
        </div>

        {activity.length === 0 ? (
          <div className="border border-border px-6 py-8 text-center">
            <p className="font-mono text-[12px] tracking-[0.05em] text-ink-3">
              {"// No activity yet"}
            </p>
          </div>
        ) : (
          <div className="border border-border divide-y divide-border">
            {activity.map((entry) => (
              <div key={entry.id} className="flex items-start gap-4 px-5 py-4">
                <div className="w-1.5 h-1.5 mt-2 bg-ink-3 shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm text-ink-2 capitalize">
                    {formatAction(entry.action)}
                  </p>
                  {entry.actor && (
                    <p className="font-mono text-[11px] tracking-[0.05em] text-ink-3 mt-0.5">
                      {"// "}{entry.actor}
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
      </section>

      {/* Quick Actions */}
      <section aria-labelledby="quick-actions-heading">
        <h2
          id="quick-actions-heading"
          className="font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-ink-3 mb-4"
        >
          {"// Quick Actions"}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/clients/new">
            <Card className="hover:border-border-2 transition-colors cursor-pointer group h-full">
              <p className="font-display text-[18px] font-[700] uppercase tracking-[-0.005em] text-ink group-hover:text-accent transition-colors">
                New Client
              </p>
              <p className="font-mono text-[12px] tracking-[0.05em] text-ink-3 mt-1">
                {"// Onboard a new agency client"}
              </p>
            </Card>
          </Link>
          <Link href="/campaigns">
            <Card className="hover:border-border-2 transition-colors cursor-pointer group h-full">
              <p className="font-display text-[18px] font-[700] uppercase tracking-[-0.005em] text-ink group-hover:text-accent transition-colors">
                All Campaigns
              </p>
              <p className="font-mono text-[12px] tracking-[0.05em] text-ink-3 mt-1">
                {"// View state-grouped campaign list"}
              </p>
            </Card>
          </Link>
        </div>
      </section>
    </div>
  );
}
