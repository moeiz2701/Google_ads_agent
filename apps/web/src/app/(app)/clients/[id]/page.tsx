import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientProfile } from "@/lib/db/clients";
import { getLatestAnalysis } from "@/lib/db/analyses";
import { listCreatives } from "@/lib/db/creatives";
import { listCampaigns } from "@/lib/db/campaigns";
import { InsightsView } from "@/components/insights/insights-view";
import { RunAnalysisButton } from "@/components/insights/run-analysis-button";
import { CreativeCard } from "@/components/creatives/creative-card";
import { GenerateButton } from "@/components/creatives/generate-button";
import { AssembleButton } from "@/components/campaign/assemble-button";
import { PageHeader, StatusBadge, Card } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const client = await getClientProfile(params.id);
  if (!client) notFound();

  const [analysis, creatives, campaigns] = await Promise.all([
    getLatestAnalysis(params.id).catch(() => null),
    listCreatives(params.id).catch(() => []),
    listCampaigns(params.id).catch(() => []),
  ]);

  return (
    <div className="max-w-[900px] mx-auto space-y-10">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4">
        <Link
          href="/clients"
          className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-3 hover:text-accent transition-colors"
        >
          &larr; Clients
        </Link>
      </nav>

      <PageHeader
        eyebrow="Client Workspace"
        title={client.name}
        meta={
          <span>
            {"// "}{client.website} &middot; goal: {client.goal} &middot;{" "}
            {client.geo.join(", ")} &middot; {client.budget.type} ${client.budget.amount}/
            {client.budget.currency}
          </span>
        }
      />

      {/* USP */}
      {client.usp && (
        <Card>
          <p className="font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-ink-3 mb-2">
            {"// USP"}
          </p>
          <p className="font-sans text-sm text-ink-2 leading-relaxed">{client.usp}</p>
        </Card>
      )}

      {/* Insights */}
      <section aria-labelledby="insights-heading">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2
            id="insights-heading"
            className="font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-ink-3"
          >
            {"// Insights"}
          </h2>
          <RunAnalysisButton clientId={client.client_id} hasAnalysis={!!analysis} />
        </div>

        {analysis ? (
          <InsightsView analysis={analysis} />
        ) : (
          <div className="border border-dashed border-border-2 px-6 py-10 text-center">
            <p className="font-display text-[22px] font-[700] uppercase text-ink-3 mb-2">
              No Analysis Yet
            </p>
            <p className="font-mono text-[12px] tracking-[0.05em] text-ink-3 max-w-sm mx-auto">
              {"// Run competitor analysis to mine winning angles and the gaps competitors are missing."}
            </p>
          </div>
        )}
      </section>

      {/* Creative Library */}
      <section aria-labelledby="creatives-heading">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2
            id="creatives-heading"
            className="font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-ink-3"
          >
            {"// Creative Library"}
            {creatives.length > 0 && (
              <span className="ml-2">({creatives.length})</span>
            )}
          </h2>
          <GenerateButton
            clientId={client.client_id}
            disabled={!analysis}
            hasCreatives={creatives.length > 0}
          />
        </div>

        {creatives.length === 0 ? (
          <div className="border border-dashed border-border-2 px-6 py-10 text-center">
            <p className="font-display text-[22px] font-[700] uppercase text-ink-3 mb-2">
              No Variants Yet
            </p>
            <p className="font-mono text-[12px] tracking-[0.05em] text-ink-3 max-w-sm mx-auto">
              {analysis
                ? "// Generate Search & Display variants built around the gaps above."
                : "// Run analysis first, then generate variants grounded in the findings."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {creatives.map((c) => (
              <CreativeCard key={c.id} creative={c} />
            ))}
          </div>
        )}
      </section>

      {/* Campaigns */}
      <section aria-labelledby="campaigns-heading">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2
            id="campaigns-heading"
            className="font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-ink-3"
          >
            {"// Campaigns"}
            {campaigns.length > 0 && (
              <span className="ml-2">({campaigns.length})</span>
            )}
          </h2>
          <AssembleButton
            clientId={client.client_id}
            disabled={!analysis}
            hasCampaigns={campaigns.length > 0}
          />
        </div>

        {campaigns.length === 0 ? (
          <div className="border border-dashed border-border-2 px-6 py-10 text-center">
            <p className="font-display text-[22px] font-[700] uppercase text-ink-3 mb-2">
              No Campaigns Yet
            </p>
            <p className="font-mono text-[12px] tracking-[0.05em] text-ink-3 max-w-sm mx-auto">
              {analysis
                ? "// Assemble a launch-ready draft with smart defaults from the analysis."
                : "// Run analysis (and ideally generate variants) before assembling a campaign."}
            </p>
          </div>
        ) : (
          <div className="border border-border divide-y divide-border">
            {campaigns.map((cp) => (
              <Link
                key={cp.campaign_id}
                href={`/campaigns/${cp.campaign_id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 bg-surface hover:bg-surface-2 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="font-sans text-sm font-[500] text-ink group-hover:text-accent transition-colors">
                    {cp.name}
                  </p>
                  <p className="font-mono text-[11px] tracking-[0.05em] text-ink-3 mt-0.5">
                    {"// "}{cp.objective} &middot; {cp.ad_groups.length} ad groups &middot;{" "}
                    {cp.ad_groups.reduce((n, g) => n + g.ads.length, 0)} variants
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={cp.status} />
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    className="text-ink-3 group-hover:text-accent transition-colors"
                    aria-hidden="true"
                  >
                    <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
