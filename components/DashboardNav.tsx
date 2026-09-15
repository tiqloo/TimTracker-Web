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
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Building2, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock, CreditCard, FolderKanban, History, LayoutDashboard, Mail, Settings, UserCog, Users } from "lucide-react";
import { logout } from "@/lib/application/auth";
import { getRepositories } from "@/lib/application/client";
import type { WorkspaceMembershipSummary } from "@/lib/application/workspace";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { resolveManagementLinkIds, resolveNavLinkIds, type ManagementLinkId, type NavLinkId } from "@/lib/domain/dashboard-nav";
import { companyOverview, nav, t, type Lang, type Translated } from "@/lib/i18n";

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
type NavLinkDescriptor = {
  href: string;
  label: Translated;
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

// Ticket 173 (selbst gefunden) — which link ids apply to the active
// workspace's type/role is decided by the pure, unit-tested
// lib/domain/dashboard-nav.ts; this map only resolves an id to the
// actual {href, label, icon} a link needs (activeWorkspaceId-dependent
// hrefs and lucide-react icons don't belong in that framework-free
// file). "history"/"today" are relabeled (not duplicated) for an
// organization context — see dashboardNavLinkDescriptors()'s own
// `orgLabels` argument.
function dashboardNavLinkDescriptors(
  activeWorkspaceId: string,
  historyLabel: Translated,
): Record<NavLinkId, NavLinkDescriptor> {
  return {
    today: { href: "/dashboard", label: nav.today, icon: CalendarDays },
    history: { href: "/dashboard/history", label: historyLabel, icon: History },
    analytics: { href: "/dashboard/analytics", label: nav.analytics, icon: BarChart3 },
    projects: { href: "/dashboard/projects", label: nav.projects, icon: FolderKanban },
    support: { href: "/dashboard/support", label: nav.support, icon: SupportIcon },
    settings: { href: "/dashboard/settings", label: nav.settings, icon: Settings },
    // Ticket 121 — "Team-Zeiten" operates on the ACTIVE workspace (not an
    // arbitrary `/dashboard/workspaces/[id]/...` route) since its project
    // filter needs repos.projects.getAll(), itself active-workspace-scoped
    // (Ticket 103) — switch workspaces via the switcher first, same flow
    // as every other data-bearing page in this app.
    teamTimes: { href: "/dashboard/team-times", label: nav.teamTimes, icon: Users },
    // Ticket 181 (selbst gefunden) → Ticket 173: /dashboard/workspaces/[id]/members
    // (Ticket 110) had zero entry point anywhere in the app before 181
    // added exactly this link; 173 renames its label to "Mitarbeiter" in
    // the new grouped organization nav and moves it next to Team-Zeiten.
    employees: {
      href: `/dashboard/workspaces/${activeWorkspaceId}/members`,
      label: nav.employees,
      icon: UserCog,
    },
    // Ticket 191 — reuses companyOverview.pageTitle rather than a new
    // duplicate nav.overview string (both render "Übersicht"/"Overview").
    overview: { href: "/dashboard/overview", label: companyOverview.pageTitle, icon: LayoutDashboard },
  };
}

// Ticket 173 — the "Verwaltung" group rendered inside UserMenu's dropdown
// (not the main nav row, see lib/domain/dashboard-nav.ts's own comment
// for why: adding 3 more items to the main row would overflow the fixed
// mobile bottom bar, which has no scroll affordance). Einladungen (Ticket
// 115) had zero entry point anywhere before this, same "built but
// unlinked" pattern as 181's original members-link fix.
function managementLinkDescriptors(activeWorkspaceId: string): Record<ManagementLinkId, NavLinkDescriptor> {
  return {
    invitations: {
      href: `/dashboard/workspaces/${activeWorkspaceId}/invitations`,
      label: nav.invitations,
      icon: Mail,
    },
    workspaceSettings: {
      href: `/dashboard/workspaces/${activeWorkspaceId}/settings`,
      label: nav.workspaceSettingsLink,
      icon: Building2,
    },
    // No separate workspace billing yet (Ticket 135 still open) — reuses
    // the existing personal billing page, see that ticket's own
    // "Konkretisierung" note for why this is a deliberate stopgap.
    // nav.workspaceBilling ("Abrechnung"), not nav.billing ("Abo") — same
    // target page, distinct label so this doesn't read as a duplicate of
    // the personal "Abo" entry it sits below.
    billing: { href: "/dashboard/settings/billing", label: nav.workspaceBilling, icon: CreditCard },
  };
}

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

function SupportIcon({ size = 16, strokeWidth = 1.75 }: { size?: number; strokeWidth?: number }) {
  return <CircleHelp size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
}

function ChevronIcon() {
  return <ChevronDown size={14} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />;
}

// Ticket 072: instant "clicked, navigating there" feedback per nav link —
// independent of the destination route's own loading.tsx skeleton, which
// only appears once Next.js has actually started rendering the new route.
// This fires the moment the click is registered, before any server round
// trip (auth check + Supabase queries) even begins — exactly the "sofort
// eine Reaktion sehen" the ticket's user quote asks for.
//
// useLinkStatus() only reports a status when called from a component
// nested *inside* the <Link> it describes (Next.js requirement, see
// https://nextjs.org/docs/app/api-reference/functions/use-link-status) —
// hence this tiny child component rather than reading pending state
// directly in DashboardNav/navigationLinks(). Rendered as an
// absolutely-positioned overlay behind the icon/label (icon/label get
// `relative z-10`, see navigationLinks() below) rather than by swapping
// the parent <Link>'s own background classes, so it composes with the
// existing active/hover background logic instead of fighting it — both
// can be visible at once (e.g. re-clicking the already-active link).
// bg-brand-soft + a brief opacity fade reuses the exact tint the
// horizontal nav bar already uses for "this is the active page" (see the
// `active` ternary below), just pulsing instead of static, so it reads as
// "the same family of highlight, temporarily" rather than a new color
// vocabulary. animate-pulse (Tailwind's built-in, ~2s opacity pulse) is
// this ticket's "subtiler Pulse ... höchstens" — no spinner.
function NavLinkPendingOverlay() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 rounded-xl bg-brand-soft transition-opacity duration-150 ${
        pending ? "opacity-100 animate-pulse" : "opacity-0"
      }`}
    />
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
  avatarUrl,
  pending,
  onLogout,
  managementLinks,
  placement = "down",
  tone = "light",
  compact = false,
}: {
  lang: Lang;
  displayName: string;
  avatarUrl: string | null;
  pending: boolean;
  onLogout: () => void;
  // Ticket 173 — the "Verwaltung" group (Einladungen/Workspace-
  // Einstellungen/Abrechnung), only non-empty for an ORGANIZATION
  // owner/admin. The pre-existing "Abo" entry below stays unconditional
  // regardless of the active workspace — it manages the signed-in
  // person's OWN subscription, not anything workspace-scoped, so it
  // would be wrong to hide it just because an organization happens to be
  // active (confirmed by live testing: a member switching into an
  // organization must still reach their personal subscription). Once
  // Ticket 135 gives organizations their own billing page, "Abrechnung"
  // here and "Abo" below will point at two different pages instead of
  // sharing one — until then this is a deliberate, harmless duplicate.
  managementLinks: NavLinkDescriptor[];
  placement?: "up" | "down";
  tone?: "light" | "dark";
  compact?: boolean;
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
    <div
      ref={containerRef}
      className="relative shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="dashboard-user-menu"
        aria-label={compact ? displayName : undefined}
        className={`flex min-w-0 items-center gap-2 rounded-xl border border-transparent py-1.5 pr-2 pl-1.5 text-sm transition-all duration-150 ${focusRingClass} ${
          tone === "dark"
            ? "text-white/65 hover:border-white/10 hover:bg-white/5 hover:text-white"
            : "text-text-secondary hover:border-line hover:bg-surface hover:text-foreground"
        }`}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived Storage URL isn't a fit for next/image's static optimization pipeline (see WorkspaceSettingsClient's own identical exception).
          <img src={avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-lg border border-line/50 object-cover" />
        ) : (
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold uppercase ${tone === "dark" ? "bg-white/10 text-white" : "bg-brand-soft text-brand"}`}>
            {displayName.trim().charAt(0) || "T"}
          </span>
        )}
        {/* Ticket 024's truncate rule, reused verbatim per this ticket's
            own Edge Cases section rather than reinvented. */}
        {!compact && (
          <>
            <span className="min-w-0 max-w-[8rem] truncate sm:max-w-[14rem]" title={displayName}>
              {displayName}
            </span>
            <ChevronIcon />
          </>
        )}
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
          // comment for the full reasoning. animate-dropdown-in
          // (globals.css) is the ticket's explicit "Dropdown Fade +
          // translateY(4px)" animation requirement — this menu previously
          // appeared with a hard cut, no animation at all.
          className={`absolute z-50 w-52 animate-dropdown-in rounded-xl border border-line bg-surface p-1.5 shadow-[0_18px_50px_-18px_rgba(24,24,23,0.42)] ${
            placement === "up" ? "bottom-full left-0" : "top-full right-0"
          }`}
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
          {managementLinks.length > 0 && (
            <>
              <div role="separator" className="my-1 border-t border-line" />
              <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold tracking-[0.14em] text-text-secondary uppercase">
                {t(lang, nav.managementSectionLabel)}
              </p>
              {managementLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.href} href={link.href} role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
                    <span className="flex items-center gap-2">
                      {Icon && <Icon size={14} strokeWidth={1.8} />}
                      {t(lang, link.label)}
                    </span>
                  </Link>
                );
              })}
            </>
          )}
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

export function DashboardNav({
  lang,
  displayName,
  avatarUrl,
  workspaces,
  activeWorkspaceId,
}: {
  lang: Lang;
  displayName: string;
  avatarUrl: string | null;
  workspaces: WorkspaceMembershipSummary[];
  activeWorkspaceId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Ticket 073: resolved once here instead of duplicating the same
  // `lang === "de" ? ... : ...` ternary for both the toggle button's
  // aria-label and title below.
  const sidebarToggleLabel = t(lang, sidebarCollapsed ? nav.sidebarExpand : nav.sidebarCollapse);
  const activeWorkspace = workspaces.find((workspace) => workspace.workspaceId === activeWorkspaceId);
  const activeRole = activeWorkspace?.role;
  const workspaceKind = activeWorkspace?.workspaceType ?? "PERSONAL";
  const isOrganization = workspaceKind !== "PERSONAL";

  // Ticket 173 (selbst gefunden) — id selection is the pure, unit-tested
  // lib/domain/dashboard-nav.ts; this component only maps ids to
  // {href, label, icon} descriptors (activeWorkspaceId/icons don't belong
  // in that framework-free file).
  const navDescriptors = dashboardNavLinkDescriptors(activeWorkspaceId, isOrganization ? nav.myTime : nav.history);
  const navLinks = resolveNavLinkIds(workspaceKind, activeRole).map((id) => navDescriptors[id]);
  const managementDescriptors = managementLinkDescriptors(activeWorkspaceId);
  const managementLinks = resolveManagementLinkIds(workspaceKind, activeRole).map((id) => managementDescriptors[id]);

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

  function navigationLinks(vertical: boolean, compact = false) {
    return navLinks.map((link) => {
      const active =
        link.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(link.href);
      const Icon = link.icon;

      return (
        <Link
          key={link.href}
          href={link.href}
          aria-current={active ? "page" : undefined}
          title={compact ? t(lang, link.label) : undefined}
          className={`group relative flex shrink-0 items-center rounded-xl transition-all duration-150 ${focusRingClass} ${
            vertical ? "h-11 gap-3 px-3 text-sm" : "h-14 flex-1 flex-col justify-center gap-1 px-1 text-[10px]"
          } ${
            active
              ? vertical
                ? "bg-brand text-white"
                : "bg-brand-soft text-brand"
              : "text-text-secondary hover:bg-surface hover:text-foreground"
          }`}
        >
          <NavLinkPendingOverlay />
          {Icon && (
            <span className="relative z-10 flex shrink-0">
              <Icon size={17} strokeWidth={active ? 2 : 1.8} />
            </span>
          )}
          {!compact && (
            <span className={`relative z-10 ${active ? "font-semibold" : "font-medium"}`}>
              {t(lang, link.label)}
            </span>
          )}
          {vertical && active && !compact && (
            <span className="relative z-10 ml-auto h-1.5 w-1.5 rounded-full bg-white/80" />
          )}
        </Link>
      );
    });
  }

  return (
    <>
      <aside className={`dashboard-sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line/70 p-4 backdrop-blur-xl transition-[width] duration-200 lg:flex ${sidebarCollapsed ? "w-[84px]" : "w-[248px]"}`}>
        <button
          type="button"
          onClick={() => setSidebarCollapsed((value) => !value)}
          aria-label={sidebarToggleLabel}
          title={sidebarToggleLabel}
          className={`absolute top-8 -right-3 z-10 grid h-7 w-7 place-items-center rounded-full border border-brand/20 bg-surface text-brand transition-all duration-150 hover:scale-105 hover:border-brand/40 hover:bg-brand-soft ${focusRingClass}`}
        >
          {sidebarCollapsed ? <ChevronRight size={15} strokeWidth={2.2} /> : <ChevronLeft size={15} strokeWidth={2.2} />}
        </button>
        <div className="mb-8 flex items-center">
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-3 px-2 py-1 text-base font-bold tracking-[-0.025em]"
            title={sidebarCollapsed ? "Tiqloo" : undefined}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white">
              <Mark />
            </span>
            {!sidebarCollapsed && <span>Tiqloo</span>}
          </Link>
        </div>

        {!sidebarCollapsed && (
          <>
            <WorkspaceSwitcher lang={lang} workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} />
            {/* Ticket 173 — "Workspace-Typ wird erkennbar" for the
                organization case specifically: PERSONAL already reads
                clearly from the switcher's own workspace name above
                (usually literally "Persönlich", Ticket 097) — an extra
                "PERSÖNLICH" eyebrow under an already-"Persönlich"-labeled
                switcher duplicated the same word, confirmed by live
                browser testing before this was scoped down to
                ORGANIZATION only. */}
            {isOrganization && (
              <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.16em] text-text-secondary uppercase">
                {t(lang, nav.organizationEyebrow)}
              </p>
            )}
          </>
        )}
        <nav className="flex flex-col gap-1">{navigationLinks(true, sidebarCollapsed)}</nav>

        <div className="mt-auto border-t border-line pt-4">
          <UserMenu lang={lang} displayName={displayName} avatarUrl={avatarUrl} pending={pending} onLogout={handleLogout} managementLinks={managementLinks} placement="up" compact={sidebarCollapsed} />
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-line/70 bg-background/85 px-4 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-2 text-sm font-bold tracking-[-0.02em]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white"><Mark /></span>
            Tiqloo
          </Link>
          <UserMenu lang={lang} displayName={displayName} avatarUrl={avatarUrl} pending={pending} onLogout={handleLogout} managementLinks={managementLinks} />
        </div>
      </header>
      <nav className="fixed right-3 bottom-3 left-3 z-40 flex gap-1 rounded-2xl border border-line/80 bg-surface/95 p-1.5 shadow-[0_18px_50px_-20px_rgba(24,24,23,0.38)] backdrop-blur-xl lg:hidden">
        {navigationLinks(false)}
      </nav>
    </>
  );
}
