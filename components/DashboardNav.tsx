"use client";

// Shared top nav for all (dashboard)/* pages — flat horizontal bar, no
// sidebar/drawer, matching this project's established "keep it simple"
// preference (see CLAUDE.md / AuthCard.tsx's comment for the same call
// made on the auth pages). Client Component because logout needs
// getRepositories() from lib/application/client + a router redirect,
// same pattern as app/(auth)/login/page.tsx.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/application/auth";
import { getRepositories } from "@/lib/application/client";

const NAV_LINKS = [
  { href: "/", label: "Heute" },
  { href: "/history", label: "Historie" },
  { href: "/projects", label: "Projekte" },
  { href: "/settings", label: "Einstellungen" },
];

export function DashboardNav() {
  const router = useRouter();
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
    <nav className="flex items-center justify-between gap-4 border-b border-black/10 px-6 py-3 dark:border-white/15">
      <div className="flex items-center gap-6">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm font-medium hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={pending}
        className="text-sm font-medium underline disabled:opacity-50"
      >
        {pending ? "Wird abgemeldet…" : "Logout"}
      </button>
    </nav>
  );
}
