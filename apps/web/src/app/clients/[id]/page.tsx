import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientProfile } from "@/lib/db/clients";
import { getLatestAnalysis } from "@/lib/db/analyses";
import { InsightsView } from "@/components/insights/insights-view";
import { RunAnalysisButton } from "@/components/insights/run-analysis-button";
import { Card } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const client = await getClientProfile(params.id);
  if (!client) notFound();

  const analysis = await getLatestAnalysis(params.id).catch(() => null);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/clients" className="text-sm text-muted hover:underline">
        ← Clients
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
          <p className="text-sm text-muted">
            {client.website} · goal: {client.goal} · {client.geo.join(", ")} ·{" "}
            {client.budget.type} ${client.budget.amount}/{client.budget.currency}
          </p>
        </div>
      </div>

      {client.usp && (
        <Card className="mt-6">
          <h3 className="text-sm font-semibold">USP</h3>
          <p className="mt-1 text-sm text-muted">{client.usp}</p>
        </Card>
      )}

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Insights</h2>
          <RunAnalysisButton clientId={client.client_id} hasAnalysis={!!analysis} />
        </div>

        {analysis ? (
          <InsightsView analysis={analysis} />
        ) : (
          <Card>
            <p className="text-sm text-muted">
              No analysis yet. Run competitor analysis to mine winning angles and the
              gaps competitors are missing. (Requires the AI service running on
              AI_SERVICE_URL.)
            </p>
          </Card>
        )}
      </section>
    </main>
  );
}
