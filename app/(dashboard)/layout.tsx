import { DashboardNav } from "@/components/DashboardNav";

// Shared shell for all (dashboard)/* pages (Heute/Historie/Projekte/
// Einstellungen) — a plain top nav plus logout, nothing more. Route
// protection itself (redirect to /login when signed out) already happens
// in proxy.ts, so this layout doesn't need to check auth again — it just
// renders the chrome around whatever page is active.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <DashboardNav />
      {children}
    </div>
  );
}
