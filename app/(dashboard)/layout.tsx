import { headers } from "next/headers";
import { DashboardNav } from "@/components/DashboardNav";
import { ToastProvider } from "@/components/ToastProvider";
import { getRepositories } from "@/lib/application/server";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { getProfile } from "@/lib/application/auth";
import { displayNameOrFallback } from "@/lib/domain/profile";

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
//
// Now async (Ticket 022): resolves the effective UI language once here,
// same getEffectiveLanguageCode() pattern app/layout.tsx already uses for
// <html lang>, so DashboardNav (a Client Component — needs router/logout)
// gets it as a prop instead of re-deriving it itself. Every (dashboard)/*
// page independently resolves the same value for its OWN strings (same
// existing convention as every page independently calling
// getRepositories()), so this one call doesn't need to flow any further
// than the nav.
//
// Also resolves the display name (Ticket 024, TimTracker-Starter repo)
// the same way — DashboardNav is the "mindestens ... in der Dashboard-Nav"
// surface the ticket's AK names, and this is the one place all
// (dashboard)/* pages already share. Already resolved to the final
// fallback string here (lib/domain/profile.ts#displayNameOrFallback)
// rather than passing the raw Profile down, since DashboardNav has no use
// for the raw email/displayName split the settings page's edit form needs.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const repos = await getRepositories();
  const headerList = await headers();
  const [lang, profile] = await Promise.all([
    getEffectiveLanguageCode(repos, headerList.get("accept-language")),
    getProfile(repos),
  ]);
  const displayName = displayNameOrFallback(profile);

  return (
    // ToastProvider (Ticket 042) mounts here, once, wrapping the whole
    // dashboard shell — not inside individual pages — so every
    // (dashboard)/* Client Component can call useToast() and so a toast's
    // own dismiss timer survives client-side navigation between pages in
    // this route group (this layout doesn't remount on those navigations;
    // see ToastProvider.tsx's own comment for the full reasoning).
    <ToastProvider lang={lang}>
      <div className="dashboard-shell flex min-h-screen flex-1 flex-col bg-background text-foreground lg:flex-row">
        <DashboardNav lang={lang} displayName={displayName} />
        <div className="mx-auto min-w-0 w-full max-w-6xl flex-1 px-5 pb-24 sm:px-8 lg:px-10 lg:pb-0 xl:px-12">{children}</div>
      </div>
    </ToastProvider>
  );
}
