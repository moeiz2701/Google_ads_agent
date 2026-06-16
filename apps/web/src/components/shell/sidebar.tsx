"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/* ─── Navigation items ───────────────────────────────────────────────────── */
const NAV = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="6" height="6" stroke="currentColor" strokeWidth="1.5" />
        <rect x="9" y="1" width="6" height="6" stroke="currentColor" strokeWidth="1.5" />
        <rect x="1" y="9" width="6" height="6" stroke="currentColor" strokeWidth="1.5" />
        <rect x="9" y="9" width="6" height="6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    href: "/clients",
    label: "Clients",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    href: "/campaigns",
    label: "Campaigns",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 12L6 7l3 3 3-4 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
        <rect x="1" y="1" width="14" height="14" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    href: "/activity",
    label: "Activity",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M1 8h3l2-5 3 10 2-6 2 3h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" />
      </svg>
    ),
  },
] as const;

/* ─── Sidebar ───────────────────────────────────────────────────────────────
   Desktop: fixed 240px left column.
   Mobile: hidden by default, revealed by hamburger button (44px touch target).
   ─────────────────────────────────────────────────────────────────────────── */
export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const navContent = (
    <nav aria-label="Primary navigation">
      {/* Wordmark */}
      <div className="px-6 py-5 border-b border-border">
        <span className="font-display text-[22px] font-[800] uppercase tracking-[-0.01em] text-ink">
          Kodo
          <span className="text-accent">AI</span>
        </span>
        <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink-3 mt-0.5">
          {"// Agency Console"}
        </p>
      </div>

      {/* Links */}
      <ul className="py-4 px-3 space-y-0.5" role="list">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={[
                  "flex items-center gap-3 px-3 py-3 transition-colors duration-150",
                  "font-mono text-[11px] font-[500] tracking-[0.12em] uppercase",
                  "min-h-[44px]", // 44px touch target
                  active
                    ? "text-ink bg-surface-2 border border-border-2"
                    : "text-ink-3 border border-transparent hover:text-ink-2 hover:bg-surface",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                <span className={active ? "text-accent" : "text-ink-3"}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Bottom meta */}
      <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t border-border">
        <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-muted-deep">
          {"// MVP · Test Account"}
        </p>
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-[240px] shrink-0 bg-surface border-r border-border h-screen sticky top-0 relative overflow-hidden"
        aria-label="Sidebar"
      >
        {navContent}
      </aside>

      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="lg:hidden fixed top-4 left-4 z-50 w-11 h-11 flex items-center justify-center bg-surface border border-border text-ink-2 hover:text-ink transition-colors"
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileOpen}
        aria-controls="mobile-nav"
      >
        {mobileOpen ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        )}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-bg/80 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        id="mobile-nav"
        className={[
          "lg:hidden fixed top-0 left-0 z-40 h-full w-[240px] bg-surface border-r border-border",
          "transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        aria-label="Mobile navigation"
      >
        <div className="pt-16 h-full relative overflow-hidden">
          {navContent}
        </div>
      </aside>
    </>
  );
}
