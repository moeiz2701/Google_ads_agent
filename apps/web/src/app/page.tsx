import Link from "next/link";
import { Button } from "@/components/ui/primitives";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <p className="text-sm font-medium text-muted">Agency Console</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        AI-powered Google Ads, from research to launch-ready campaign.
      </h1>
      <p className="mt-4 max-w-xl text-muted">
        Onboard a client, mine what works in their market, generate on-brand
        Search &amp; Display variants around the gaps competitors miss, and
        assemble a campaign you review and approve. (MVP — Google Ads test
        account.)
      </p>

      <div className="mt-8 flex gap-3">
        <Link href="/clients/new">
          <Button>+ New Client</Button>
        </Link>
        <Link href="/clients">
          <Button variant="secondary">View Clients</Button>
        </Link>
      </div>

      <ol className="mt-12 space-y-2 text-sm text-muted">
        <li>1. Onboarding &amp; brand kit — you are here (Module 1)</li>
        <li>2. Competitor &amp; market analysis (Module 2)</li>
        <li>3. Variant generation (Module 3)</li>
        <li>4–7. Rendering · assembly · dashboard · approval &amp; publish</li>
      </ol>
    </main>
  );
}
