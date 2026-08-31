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

const NAV_LINKS = [
  { href: "/dashboard", label: "Heute" },
  { href: "/dashboard/history", label: "Historie" },
  { href: "/dashboard/projects", label: "Projekte" },
  { href: "/dashboard/settings", label: "Einstellungen" },
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

export function DashboardNav() {
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
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    active
                      ? "font-medium text-foreground"
                      : "text-foreground/60 hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={pending}
          className="text-sm text-foreground/70 hover:text-foreground disabled:opacity-50"
        >
          {pending ? "Wird abgemeldet…" : "Logout"}
        </button>
      </div>
    </header>
  );
}
