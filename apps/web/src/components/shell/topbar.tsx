import Link from "next/link";
import { Button } from "@/components/ui/primitives";

/**
 * App shell top bar — sits above content area on all app pages.
 * Quick action: + New Client. Lightweight; no auth state in MVP.
 */
export function Topbar() {
  return (
    <header className="h-[56px] flex items-center justify-end gap-4 px-6 border-b border-border bg-bg shrink-0">
      <Link href="/clients/new">
        <Button size="sm">+ New Client</Button>
      </Link>
    </header>
  );
}
