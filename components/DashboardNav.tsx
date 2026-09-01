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
import { ChevronDown, CircleHelp, Clock } from "lucide-react";
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

// Ticket 048: hand-drawn Mark()/SupportIcon()/ChevronIcon() SVGs replaced
// with lucide-react (new dependency, see package.json) — "einfache
// Outline-Icons, 1.5-2px Strichstärke, 18-20px" per the ticket AK, which
// explicitly names "Uhr/Zeit" (clock/time) as an example equivalent for a
// brand mark exactly like this one. Kept as thin local wrapper functions
// (not inlined at each call site) so NAV_LINKS's `icon?: ComponentType`
// shape below still works unchanged, and so the size/stroke choice stays
// in one place per icon.
//
// Sizes are context-appropriate rather than a flat 18-20px everywhere:
// the brand mark next to the "TimTracker" wordmark and the small Support
// nav-link icon are both inline WITH text at text-sm (14px) — forcing
// them up to the spec's full 18-20px would visually overpower that text.
// The spec's literal 18-20px band is applied to this ticket's standalone,
// non-inline icons instead (see app/page.tsx's Features section). Stroke
// width (1.5-1.75px) stays within the spec's 1.5-2px band in every case.
function Mark() {
  return <Clock size={18} strokeWidth={1.5} aria-hidden="true" />;
}

function SupportIcon() {
  return <CircleHelp size={16} strokeWidth={1.75} aria-hidden="true" />;
}

function ChevronIcon() {
  return <ChevronDown size={14} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />;
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
  // bg-paper highlight reads better here than the nav links' bg-brand-soft
  // pill would (that pill is reserved for "this is the current page").
  // Ticket 048: added transition-colors duration-150 — this menu's own
  // hover/focus states previously snapped instantly, unlike some other
  // interactive surfaces in this file; now every one of them uses the same
  // 120-150ms transition, per the ticket's animation AK.
  const itemClass = `block rounded-md px-3 py-2 text-sm text-foreground/80 transition-colors duration-150 hover:bg-paper hover:text-foreground focus-visible:bg-paper focus-visible:text-foreground ${focusRingClass}`;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="dashboard-user-menu"
        className={`flex min-w-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm text-foreground/70 transition-colors duration-150 hover:text-foreground ${focusRingClass}`}
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
          // Ticket 048: bg-background -> bg-surface (this dropdown is a
          // floating card, same token as every other card). shadow-lg ->
          // the same softer, warm-tinted custom shadow used for
          // HistoryDateRangePicker's popover and ToastProvider's toast —
          // one consistent "floating surface" shadow instead of three
          // different ad hoc ones. See HistoryDateRangePicker.tsx's own
          // comment for the full reasoning.
          className="absolute right-0 top-full z-10 mt-2 w-48 rounded-md border border-line bg-surface py-1 shadow-[0_4px_16px_-4px_rgba(24,24,23,0.12)]"
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
              // in addition to the text-brand + font-medium Ticket 037
              // already added — per the AK, plain font-weight/color wasn't
              // a strong enough signal on its own. Ticket 048: bg-brand/10
              // -> bg-brand-soft, the real named token now that one exists
              // (see globals.css) instead of an ad hoc opacity value, and
              // both branches get the same transition-colors duration-150
              // — one consistent hover pattern for both states, not a
              // static active pill next to an instantly-snapping inactive
              // hover (the ticket's own "nicht fünf verschieden starke
              // Hover-/Shadow-Effekte" note).
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ${focusRingClass} ${
                    active
                      ? "bg-brand-soft font-medium text-brand"
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
