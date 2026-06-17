import Link from "next/link";
import { notFound } from "next/navigation";
import { getCampaign } from "@/lib/db/campaigns";
import { getClientProfile } from "@/lib/db/clients";
import { listRecentActivity } from "@/lib/db/dashboard";
import { CampaignReview } from "@/components/campaign/campaign-review";
import { CampaignControls } from "@/components/campaign/campaign-controls";
import { ApproveLaunch } from "@/components/campaign/approve-launch";
import { StatusBadge } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAction(action: string): string {
  return action.replace(/\./g, " ").replace(/_/g, " ");
}

export default async function CampaignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const campaign = await getCampaign(params.id);
  if (!campaign) notFound();

  const [client, allActivity] = await Promise.all([
    getClientProfile(campaign.client_id).catch(() => null),
    listRecentActivity(50).catch(() => []),
  ]);

  const budgetCap = client?.budget.amount ?? campaign.budget.amount;
  const campaignActivity = allActivity.filter((a) => a.campaign_id === params.id);
  const enabledAds = campaign.ad_groups.reduce(
    (n, g) => n + g.ads.filter((a) => a.enabled).length,
    0,
  );
  const isLaunched = ["scheduled", "running", "paused", "completed"].includes(
    campaign.status,
  );

  const overviewItems = [
    { label: "Objective", value: campaign.objective },
    { label: "Bid Strategy", value: campaign.bid_strategy.replace(/_/g, " ") },
    {
      label: "Budget",
      value: `$${campaign.budget.amount} ${campaign.budget.currency} ${campaign.budget.type}`,
    },
    {
      label: "Networks",
      value:
        campaign.networks.map((n) => n.charAt(0).toUpperCase() + n.slice(1)).join(" + ") || "—",
    },
    { label: "Flight Start", value: campaign.flight_dates?.start ?? "—" },
    { label: "Flight End", value: campaign.flight_dates?.end ?? "open" },
    { label: "Geo", value: campaign.geo.join(", ") || "—" },
    { label: "Ad Groups", value: `${campaign.ad_groups.length} groups` },
  ];

  return (
    <div className="max-w-[900px] mx-auto space-y-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] uppercase text-ink-3">
          <li>
            <Link href="/campaigns" className="hover:text-accent transition-colors">
              Campaigns
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-ink-2">{campaign.name}</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="flex flex-wrap items-start gap-4 mb-4">
          <div className="flex-1 min-w-0">
            {client && (
              <p className="font-mono text-[11px] tracking-[0.15em] uppercase text-ink-3 mb-2">
                {"// "}{client.name}
              </p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-[36px] md:text-[48px] font-[800] uppercase tracking-[-0.01em] text-ink leading-none">
                {campaign.name}
              </h1>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="font-mono text-[12px] tracking-[0.05em] text-ink-3 mt-2">
              {"// Updated "}{formatDate(campaign.updated_at)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CampaignControls
            campaignId={campaign.campaign_id}
            currentStatus={campaign.status}
          />
          <ApproveLaunch
            campaignId={campaign.campaign_id}
            status={campaign.status}
            budget={campaign.budget}
            budgetCap={budgetCap}
            networks={campaign.networks}
            enabledAds={enabledAds}
          />
        </div>
      </div>

      {/* Overview */}
      <section aria-labelledby="overview-heading">
        <h2
          id="overview-heading"
          className="font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-ink-3 mb-4"
        >
          {"// Overview"}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {overviewItems.map(({ label, value }) => (
            <div key={label} className="bg-surface border border-border px-4 py-4">
              <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink-3 mb-1">
                {"// "}{label}
              </p>
              <p className="font-sans text-sm text-ink-2 capitalize">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Config editor */}
      <section aria-labelledby="config-heading">
        <h2
          id="config-heading"
          className="font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-ink-3 mb-4"
        >
          {"// Configure by Exception"}
        </h2>
        <p className="font-mono text-[12px] tracking-[0.05em] text-ink-3 mb-4">
          {"// Smart defaults from the analysis. Edit anything. Budget is capped at $"}{budgetCap}/{campaign.budget.currency}.
        </p>
        <CampaignReview initial={campaign} budgetCap={budgetCap} />
      </section>

      {/* Performance stub */}
      <section aria-labelledby="perf-heading">
        <h2
          id="perf-heading"
          className="font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-ink-3 mb-4"
        >
          {"// Performance"}
        </h2>
        <div className="border border-dashed border-border-2 px-6 py-10 text-center">
          <p className="font-display text-[22px] font-[700] uppercase text-ink-3 mb-2">
            {isLaunched ? "Live On Test Account" : "Metrics Once Launched"}
          </p>
          <p className="font-mono text-[12px] tracking-[0.05em] text-ink-3 max-w-md mx-auto">
            {isLaunched
              ? "// Published to the Google Ads TEST account. Test accounts don't serve or report metrics, so performance is empty by design. The longevity feedback loop (Module 6) — feeding realized results back into analysis — activates with production serving."
              : "// Approve & Launch to create this campaign on the Google Ads test account. Test accounts create real objects but never spend or report metrics; live performance + the feedback loop are a production feature (Module 6)."}
          </p>
        </div>
      </section>

      {/* Activity log */}
      <section aria-labelledby="activity-heading">
        <h2
          id="activity-heading"
          className="font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-ink-3 mb-4"
        >
          {"// Activity Log"}
        </h2>
        {campaignActivity.length === 0 ? (
          <div className="border border-border px-6 py-8 text-center">
            <p className="font-mono text-[12px] tracking-[0.05em] text-ink-3">
              {"// No recorded activity yet"}
            </p>
          </div>
        ) : (
          <div className="border border-border divide-y divide-border">
            {campaignActivity.map((entry) => (
              <div key={entry.id} className="flex items-start gap-4 px-5 py-4">
                <div className="w-1.5 h-1.5 mt-2 bg-accent-dim shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm text-ink-2 capitalize">
                    {formatAction(entry.action)}
                  </p>
                  {entry.actor && (
                    <p className="font-mono text-[11px] tracking-[0.05em] text-ink-3 mt-0.5">
                      {"// "}{entry.actor}
                    </p>
                  )}
                  {entry.details && Object.keys(entry.details).length > 0 && (
                    <p className="font-mono text-[11px] tracking-[0.05em] text-ink-3 mt-0.5">
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
      </section>
    </div>
  );
}
