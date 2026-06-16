import Link from "next/link";
import { listClientProfiles } from "@/lib/db/clients";
import { Button, Card } from "@/components/ui/primitives";

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
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted">
            {clients.length} client{clients.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/clients/new">
          <Button>+ New Client</Button>
        </Link>
      </div>

      {loadError ? (
        <Card className="text-sm text-danger">{loadError}</Card>
      ) : clients.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No clients yet. Add your first client to start.
          </p>
          <div className="mt-4">
            <Link href="/clients/new">
              <Button>+ Add your first client</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {clients.map((c) => (
            <Link key={c.client_id} href={`/clients/${c.client_id}`} className="block">
              <Card className="flex items-center justify-between transition-colors hover:bg-bg">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted">
                    {c.website} · goal: {c.goal} · {c.geo.join(", ")}
                  </p>
                </div>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">
                  {c.budget.type} ${c.budget.amount}/{c.budget.currency}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
