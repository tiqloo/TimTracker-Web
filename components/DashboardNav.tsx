"use client";

// Shared top nav for all (dashboard)/* pages — flat horizontal bar, no
// sidebar/drawer, matching this project's established "keep it simple"
// preference (see CLAUDE.md / AuthCard.tsx's comment for the same call
// made on the auth pages). Client Component because logout needs
// getRepositories() from lib/application/client + a router redirect,
// same pattern as app/(auth)/login/page.tsx.
//
// Redesigned 2026-08-31 alongside the public homepage (app/page.tsx) —
// this nav had never gotten the same pass and still looked like unstyled
// scaffolding (no brand mark, no active-page indication, plain underline
// links) while the marketing page in front of it now has a real design
// system. Reuses the exact same tokens (border-line, the Mark logo) so the
// two don't visually disagree about what this product looks like.
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/application/auth";
import { getRepositories } from "@/lib/application/client";
import { nav, t, type Lang, type Translated } from "@/lib/i18n";

// Ticket 030 (TimTracker-Starter repo): "Support" is the one entry here
// with an icon (the AK explicitly calls for "eigenes Icon, analog zur
// Referenz" — Personio's support entry has one). Every other link stays
// plain text, unchanged, rather than retrofitting icons everywhere just
// for consistency's sake — out of scope for this ticket. `icon` is
// therefore optional, not a new shared convention.
const NAV_LINKS: { href: string; label: Translated; icon?: React.ComponentType }[] = [
  { href: "/dashboard", label: nav.today },
  { href: "/dashboard/history", label: nav.history },
  { href: "/dashboard/projects", label: nav.projects },
  { href: "/dashboard/support", label: nav.support, icon: SupportIcon },
  { href: "/dashboard/settings", label: nav.settings },
];

function Mark() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path
        d="M10 5.5V10l3 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Same stroke-only, currentColor visual language as Mark() above (no new
// icon style introduced) — a question mark in a circle, the conventional
// "help" glyph the Personio reference itself uses.
function SupportIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
      <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path
        d="M7.7 7.8a2.3 2.3 0 1 1 3.5 1.95c-.65.4-1.2.8-1.2 1.65"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="10" cy="14" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DashboardNav({ lang, displayName }: { lang: Lang; displayName: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      const repos = getRepositories();
      await logout(repos);
      router.push("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <header className="border-b border-line px-4 sm:px-6">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Mark />
            TimTracker
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active =
                link.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(link.href);
              const Icon = link.icon;
              // Active state uses --color-brand (Ticket 037) instead of
              // plain text-foreground, so the current page reads via the
              // product's actual accent color, not just font-weight.
              // Full active-nav redesign (pill/underline indicator etc.)
              // stays Ticket 036's scope — this only recolors what's here.
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
                    active
                      ? "font-medium text-brand"
                      : "text-foreground/60 hover:text-foreground"
                  }`}
                >
                  {Icon && <Icon />}
                  {t(lang, link.label)}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          {/* Ticket 024 (TimTracker-Starter repo): identity display —
              already resolved to the display name (or the email-prefix
              fallback) by app/(dashboard)/layout.tsx, see
              lib/domain/profile.ts#displayNameOrFallback. `truncate`
              (needs the `min-w-0` above, since this sits inside a flex
              row — without it a flex item won't shrink below its content
              width and truncate has nothing to clip against) covers the
              ticket's "sehr langer Anzeigename -> abgeschnitten, kein
              Layout-Bruch" edge case. */}
          <Link
            href="/dashboard/settings"
            className="min-w-0 max-w-[8rem] truncate text-sm text-foreground/70 hover:text-foreground sm:max-w-[14rem]"
            title={displayName}
          >
            {displayName}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={pending}
            className="shrink-0 text-sm text-foreground/70 hover:text-foreground disabled:opacity-50"
          >
            {pending ? t(lang, nav.loggingOut) : t(lang, nav.logout)}
          </button>
        </div>
      </div>
    </header>
  );
}
