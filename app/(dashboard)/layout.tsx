import { DashboardNav } from "@/components/DashboardNav";

// Shared shell for all (dashboard)/* pages (Heute/Historie/Projekte/
// Einstellungen) — a plain top nav plus logout, nothing more. Route
// protection itself (redirect to /login when signed out) already happens
// in proxy.ts, so this layout doesn't need to check auth again — it just
// renders the chrome around whatever page is active.
//
// The max-w-5xl centering wrapper lives here (not in every page's own
// <main>) so content stops stretching edge-to-edge on a wide monitor —
// matches the public homepage's container width, one place to keep both
// in sync.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background text-foreground">
      <DashboardNav />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 sm:px-8">{children}</div>
    </div>
  );
}
