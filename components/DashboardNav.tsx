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
//
// Ticket 036 (TimTracker-Starter repo, 2026-09-01): three follow-up fixes
// once this nav had real content (5 links post-Ticket-030) and real user
// feedback:
// - the display-name link + separate Logout button in the main bar are
//   now one "account menu" dropdown (Einstellungen/Abo/Abmelden) — see
//   UserMenu() below.
// - the active link gets a --brand-tinted background pill, not just
//   font-weight + text color (Ticket 037 only recolored the text).
// - the link row itself is wrapped in its own overflow-x-auto scroller
//   (the "Minimallösung" the ticket names as acceptable) instead of
//   nothing, since a fixed h-14 header + 5 text links + an account menu
//   has no defined behavior below ~450px otherwise. A hamburger/drawer
//   pattern was considered but rejected for now — no browser environment
//   was available in this working session to verify a drawer's own
//   interaction/focus-trap behavior at real narrow widths, whereas
//   overflow-x-auto is a hard CSS guarantee (content simply scrolls,
//   never clips/breaks) independent of exact link count or label length.
//   Revisit if a 6th link ever makes even the scroller feel cramped.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/application/auth";
import { getRepositories } from "@/lib/application/client";
import { nav, t, type Lang, type Translated } from "@/lib/i18n";

// Shared with every focus-visible ring elsewhere in the app (AuthCard.tsx/
// ProjectsClient.tsx/SettingsClient.tsx/SupportClient.tsx's inputClass) —
// this ticket's AK explicitly calls out that DashboardNav's links/buttons
// were the one interactive surface still missing this, unlike form inputs.
const focusRingClass =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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

// Same stroke-only, currentColor visual language again — a plain down
// chevron marking the account-menu trigger as a disclosure control (not
// just a link), the conventional dropdown affordance.
function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3 w-3 shrink-0" aria-hidden="true">
      <path
        d="M6 8.5 10 12.5 14 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// Ticket 036: display name + Settings/Billing/Logout collapsed into one
// dropdown (AK: "Anzeigename + Logout werden zu einem einzelnen Dropdown/
// Menü zusammengefasst"). Its own component (like Mark()/SupportIcon()
// above) since it owns non-trivial open/close + outside-click/Escape
// state that doesn't belong inlined into DashboardNav's JSX.
function UserMenu({
  lang,
  displayName,
  pending,
  onLogout,
}: {
  lang: Lang;
  displayName: string;
  pending: boolean;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Edge case (ticket AK): "Menü offen + Klick außerhalb -> schließt sich
  // ... Escape-Taste schließt ebenfalls". Only listens while open so this
  // never adds document-level listeners for the common case (menu closed).
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Background highlight (hover + focus-visible) plus the shared ring —
  // menu items are its own little list, not full-width nav links, so a
  // bg-paper highlight reads better here than the nav links' bg-brand/10
  // pill would (that pill is reserved for "this is the current page").
  const itemClass = `block rounded-md px-3 py-2 text-sm text-foreground/80 hover:bg-paper hover:text-foreground focus-visible:bg-paper focus-visible:text-foreground ${focusRingClass}`;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="dashboard-user-menu"
        className={`flex min-w-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm text-foreground/70 hover:text-foreground ${focusRingClass}`}
      >
        {/* Ticket 024's truncate rule, reused verbatim per this ticket's
            own Edge Cases section rather than reinvented. */}
        <span className="min-w-0 max-w-[8rem] truncate sm:max-w-[14rem]" title={displayName}>
          {displayName}
        </span>
        <ChevronIcon />
      </button>
      {open && (
        <div
          id="dashboard-user-menu"
          role="menu"
          aria-label={displayName}
          className="absolute right-0 top-full z-10 mt-2 w-48 rounded-md border border-line bg-background py-1 shadow-lg"
        >
          <Link href="/dashboard/settings" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            {t(lang, nav.settings)}
          </Link>
          <Link
            href="/dashboard/settings/billing"
            role="menuitem"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            {t(lang, nav.billing)}
          </Link>
          <div role="separator" className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className={`${itemClass} w-full text-left disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {pending ? t(lang, nav.loggingOut) : t(lang, nav.logout)}
          </button>
        </div>
      )}
    </div>
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
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4">
        {/* min-w-0 lets this side actually shrink below its content width
            inside the flex row above — without it, flexbox refuses to
            shrink it past its content size and the overflow-x-auto below
            has nothing to do (same min-w-0 dependency the old identity
            link's own comment already called out for its own truncate). */}
        <div className="flex min-w-0 items-center gap-6">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <Mark />
            TimTracker
          </Link>
          {/* Responsive/overflow protection (ticket AK) — the "Minimallösung"
              named there: below ~450px width, 5 links no longer fit next to
              the logo + account menu, so the link row scrolls horizontally
              on its own rather than the fixed h-14 header breaking/wrapping.
              Everything above/below it (logo, account menu) stays put via
              shrink-0. */}
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV_LINKS.map((link) => {
              const active =
                link.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(link.href);
              const Icon = link.icon;
              // Active state (Ticket 036): a --brand-tinted background pill
              // (bg-brand/10) in addition to the text-brand + font-medium
              // Ticket 037 already added — per the AK, plain font-weight/
              // color wasn't a strong enough signal on its own.
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${focusRingClass} ${
                    active
                      ? "bg-brand/10 font-medium text-brand"
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
        <UserMenu lang={lang} displayName={displayName} pending={pending} onLogout={handleLogout} />
      </div>
    </header>
  );
}
