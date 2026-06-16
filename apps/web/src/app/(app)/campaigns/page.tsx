import Link from "next/link";
import { listAllCampaigns } from "@/lib/db/dashboard";
import { PageHeader, StatusBadge, EmptyState, Button } from "@/components/ui/primitives";
import type { CampaignStatus } from "@gaa/shared";
import type { CampaignSummary } from "@/lib/db/dashboard";

export const dynamic = "force-dynamic";

const STATUS_GROUPS: { status: CampaignStatus; label: string }[] = [
  { status: "running", label: "Running" },
  { status: "scheduled", label: "Scheduled" },
  { status: "pending_approval", label: "Pending Approval" },
  { status: "draft", label: "Drafts" },
  { status: "paused", label: "Paused" },
  { status: "completed", label: "Completed" },
  { status: "archived", label: "Archived" },
];

function formatBudget(budget: CampaignSummary["budget"]): string {
  return `$${budget.amount} ${budget.currency} ${budget.type}`;
}

function formatDates(dates: CampaignSummary["flight_dates"]): string {
  if (!dates) return "—";
  const start = dates.start ?? "—";
  const end = dates.end ?? "open";
  return `${start} → ${end}`;
}

function formatNetworks(networks: string[]): string {
  return networks.map((n) => n.charAt(0).toUpperCase() + n.slice(1)).join(" + ");
}

function CampaignRow({ campaign }: { campaign: CampaignSummary }) {
  return (
    <Link
      href={`/campaigns/${campaign.campaign_id}`}
      className="flex items-center gap-4 px-5 py-4 bg-surface border-b border-border hover:bg-surface-2 transition-colors group"
    >
      <StatusBadge status={campaign.status} />

      <div className="flex-1 min-w-0">
        <p className="font-sans text-sm font-[500] text-ink truncate group-hover:text-accent transition-colors">
          {campaign.name}
        </p>
        <p className="font-mono text-[11px] tracking-[0.05em] text-ink-3 mt-0.5 truncate">
          {"// "}{campaign.client_name} &middot; {campaign.objective}
        </p>
      </div>

      <div className="hidden sm:flex items-center gap-6 shrink-0">
        <div className="text-right">
          <p className="font-mono text-[11px] tracking-[0.05em] text-ink-2">
            {formatNetworks(campaign.networks)}
          </p>
          <p className="font-mono text-[10px] tracking-[0.05em] text-ink-3 mt-0.5">
            {formatDates(campaign.flight_dates)}
          </p>
        </div>
        <div className="text-right w-[90px]">
          <p className="font-mono text-[11px] tracking-[0.05em] text-ink-2">
            {formatBudget(campaign.budget)}
          </p>
          <p className="font-mono text-[10px] tracking-[0.05em] text-ink-3 mt-0.5">
            {campaign.ad_group_count} groups &middot; {campaign.enabled_ad_count}/{campaign.ad_count} ads
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
  );
}

function CampaignGroup({
  label,
  status,
  campaigns,
}: {
  label: string;
  status: CampaignStatus;
  campaigns: CampaignSummary[];
}) {
  if (campaigns.length === 0) return null;

  return (
    <section aria-labelledby={`group-${status}`}>
      <div className="flex items-center gap-3 mb-2">
        <h2
          id={`group-${status}`}
          className="font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-ink-3"
        >
          {"// "}{label}
        </h2>
        <span className="font-mono text-[11px] tracking-[0.12em] text-ink-3">
          ({campaigns.length})
        </span>
      </div>
      <div className="border border-border">
        {campaigns.map((c) => (
          <CampaignRow key={c.campaign_id} campaign={c} />
        ))}
      </div>
    </section>
  );
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: { status?: string; client?: string; q?: string };
}) {
  let campaigns: CampaignSummary[] = [];
  let loadError: string | null = null;

  try {
    campaigns = await listAllCampaigns();
  } catch (err) {
    loadError = "Could not load campaigns. Check Supabase env vars.";
    console.error("[campaigns page]", err);
  }

  const { status: filterStatus, client: filterClient, q: filterQ } = searchParams;

  let filtered = campaigns;
  if (filterStatus) filtered = filtered.filter((c) => c.status === filterStatus);
  if (filterClient) filtered = filtered.filter((c) => c.client_id === filterClient);
  if (filterQ) {
    const q = filterQ.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.client_name.toLowerCase().includes(q),
    );
  }

  const uniqueClients = Array.from(
    new Map(campaigns.map((c) => [c.client_id, c.client_name])).entries(),
  );

  const grouped = new Map<CampaignStatus, CampaignSummary[]>();
  for (const g of STATUS_GROUPS) grouped.set(g.status, []);
  for (const c of filtered) {
    const list = grouped.get(c.status);
    if (list) list.push(c);
  }

  const hasResults = filtered.length > 0;

  return (
    <div className="max-w-content mx-auto space-y-8">
      <PageHeader
        eyebrow="Agency Console"
        title="Campaigns"
        meta={`${campaigns.length} total · ${campaigns.filter((c) => c.status === "running").length} running`}
      />

      {loadError && (
        <div className="border border-red bg-red-bg px-5 py-4 font-sans text-sm text-red" role="alert">
          {loadError}
        </div>
      )}

      {/* Filters bar */}
      <form method="GET" className="flex flex-wrap gap-3 items-center">
        <input
          name="q"
          type="search"
          defaultValue={filterQ ?? ""}
          placeholder="Search campaigns..."
          aria-label="Search campaigns"
          className="flex-1 min-w-[180px] border border-border bg-surface-2 px-4 py-2 font-sans text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent transition-colors"
        />

        <select
          name="status"
          defaultValue={filterStatus ?? ""}
          aria-label="Filter by status"
          className="border border-border bg-surface-2 px-4 py-2 font-mono text-[11px] tracking-[0.1em] uppercase text-ink-2 focus:outline-none focus:border-accent appearance-none"
        >
          <option value="">All statuses</option>
          {STATUS_GROUPS.map((g) => (
            <option key={g.status} value={g.status}>
              {g.label}
            </option>
          ))}
        </select>

        {uniqueClients.length > 1 && (
          <select
            name="client"
            defaultValue={filterClient ?? ""}
            aria-label="Filter by client"
            className="border border-border bg-surface-2 px-4 py-2 font-mono text-[11px] tracking-[0.1em] uppercase text-ink-2 focus:outline-none focus:border-accent appearance-none"
          >
            <option value="">All clients</option>
            {uniqueClients.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}

        <button
          type="submit"
          className="px-5 py-2 border border-border bg-transparent font-mono text-[11px] tracking-[0.15em] uppercase text-ink-2 hover:border-accent hover:text-ink transition-colors"
        >
          Filter
        </button>

        {(filterStatus || filterClient || filterQ) && (
          <a
            href="/campaigns"
            className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-3 hover:text-accent transition-colors"
          >
            Clear
          </a>
        )}
      </form>

      {/* Campaign groups */}
      {!loadError && !hasResults ? (
        <EmptyState
          label="No campaigns found"
          title="Nothing Matches"
          description={
            filterStatus || filterClient || filterQ
              ? "Try adjusting your filters or clearing them."
              : "Onboard a client and assemble a campaign to get started."
          }
          action={
            !filterStatus && !filterClient && !filterQ ? (
              <Link href="/clients/new">
                <Button>+ New Client</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {STATUS_GROUPS.map(({ status, label }) => {
            const group = grouped.get(status) ?? [];
            return (
              <CampaignGroup
                key={status}
                status={status}
                label={label}
                campaigns={group}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
