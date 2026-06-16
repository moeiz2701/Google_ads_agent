import Link from "next/link";
import { listClientProfiles } from "@/lib/db/clients";
import { Button, PageHeader, EmptyState } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  let clients: Awaited<ReturnType<typeof listClientProfiles>> = [];
  let loadError: string | null = null;
  try {
    clients = await listClientProfiles();
  } catch (err) {
    loadError =
      "Could not load clients. Check that Supabase env vars are set and the migration has run.";
    console.error("[clients page]", err);
  }

  return (
    <div className="max-w-content mx-auto space-y-8">
      <PageHeader
        eyebrow="Agency Console"
        title="Clients"
        meta={`${clients.length} client${clients.length === 1 ? "" : "s"}`}
        actions={
          <Link href="/clients/new">
            <Button>+ New Client</Button>
          </Link>
        }
      />

      {loadError && (
        <div
          className="border border-red bg-red-bg px-5 py-4 font-sans text-sm text-red"
          role="alert"
        >
          {loadError}
        </div>
      )}

      {!loadError && clients.length === 0 ? (
        <EmptyState
          label="No clients yet"
          title="Add Your First Client"
          description="Onboard a client with their website URL. The system pre-fills brand kit and offerings automatically."
          action={
            <Link href="/clients/new">
              <Button>+ Add First Client</Button>
            </Link>
          }
        />
      ) : (
        <div className="border border-border divide-y divide-border">
          {clients.map((c) => (
            <Link
              key={c.client_id}
              href={`/clients/${c.client_id}`}
              className="flex items-center justify-between gap-4 px-5 py-5 bg-surface hover:bg-surface-2 transition-colors group"
            >
              <div className="min-w-0">
                <p className="font-sans text-base font-[500] text-ink group-hover:text-accent transition-colors">
                  {c.name}
                </p>
                <p className="font-mono text-[11px] tracking-[0.05em] text-ink-3 mt-1 truncate">
                  {"// "}{c.website} &middot; goal: {c.goal} &middot; {c.geo.join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:block font-mono text-[11px] tracking-[0.12em] uppercase text-ink-3 border border-border px-3 py-1.5">
                  {c.budget.type} ${c.budget.amount}/{c.budget.currency}
                </span>
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
    </div>
  );
}
