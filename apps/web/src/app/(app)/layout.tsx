import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

/**
 * App shell layout — wraps all primary routes (Dashboard, Clients, Campaigns, Activity).
 * Structure: [Sidebar] | [Topbar + content scroll area]
 * Root layout (app/layout.tsx) keeps html/body + globals.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8 lg:px-12 lg:py-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
