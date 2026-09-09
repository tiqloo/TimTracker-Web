"use client";

// Ticket 103 — "Workspace-Wechsel". Sits in DashboardNav's sidebar, right
// where a static "Workspace" label used to be (see DashboardNav.tsx's own
// comment at the call site). Same open/close + outside-click/Escape
// interaction shape as that file's own UserMenu() — deliberately not
// extracted into a shared component (the two dropdowns differ enough in
// content/placement that a shared abstraction would need as many
// escape-hatch props as it saves, per this project's "avoid unnecessary
// abstractions" rule) but intentionally styled identically so both read as
// the same family of control.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2, Check, ChevronsUpDown, Plus, User } from "lucide-react";
import { switchActiveWorkspace, type WorkspaceMembershipSummary, type WorkspaceRole } from "@/lib/application/workspace";
import { getRepositories } from "@/lib/application/client";
import { workspaceSwitcher as i18nWorkspaceSwitcher, t, type Lang } from "@/lib/i18n";

const focusRingClass =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// Ticket 174 — same role-label mapping as every other role display in
// this app (e.g. app/(dashboard)/dashboard/workspaces/[workspaceId]/members),
// kept local since it's only three short strings.
function roleLabel(lang: Lang, role: WorkspaceRole): string {
  switch (role) {
    case "owner":
      return t(lang, i18nWorkspaceSwitcher.roleOwner);
    case "admin":
      return t(lang, i18nWorkspaceSwitcher.roleAdmin);
    case "member":
      return t(lang, i18nWorkspaceSwitcher.roleMember);
  }
}

// A plain top-level function, same shape as LoginForm.tsx's own
// navigateAfterSignIn — the React Compiler ESLint rule
// (react-hooks/immutability) only flags a `window` mutation written
// directly inside a component/hook body, not one reached through an
// ordinary helper function like this.
function reloadIntoActiveWorkspace(): void {
  window.location.href = "/dashboard";
}

export function WorkspaceSwitcher({
  lang,
  workspaces,
  activeWorkspaceId,
}: {
  lang: Lang;
  workspaces: WorkspaceMembershipSummary[];
  activeWorkspaceId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const active = workspaces.find((w) => w.workspaceId === activeWorkspaceId);
  const activeName = active?.workspaceName ?? t(lang, i18nWorkspaceSwitcher.fallbackLabel);

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

  // Edge case (ticket AK): exactly one workspace (just the personal one) —
  // a plain label, no dropdown affordance at all, so switching between "one
  // option" never reads as an interactive control with nothing to do.
  if (workspaces.length <= 1) {
    return (
      <p className="mb-2 truncate px-3 text-[10px] font-semibold tracking-[0.16em] text-text-secondary uppercase" title={activeName}>
        {activeName}
      </p>
    );
  }

  async function handleSwitch(workspaceId: string) {
    if (workspaceId === activeWorkspaceId || pending) {
      setOpen(false);
      return;
    }
    setPending(true);
    try {
      const repos = getRepositories();
      await switchActiveWorkspace(repos, workspaceId);
      // A hard navigation, not router.push()/router.refresh(): every
      // (dashboard)/* page's Client Component seeds its own local state
      // from server-provided initial props via useState(initialX) (e.g.
      // ProjectsClient.tsx's `useState(initialProjects)`) — a value only
      // ever read on that component's FIRST mount. A soft refresh alone
      // would fetch fresh, correctly-scoped data server-side but never
      // reach those already-mounted components, leaving stale
      // previous-workspace data on screen (exactly the "kein Rest-Zustand/
      // Flackern alter Daten" AK this ticket calls out). A full page load
      // remounts everything, which is also the simplest way to guarantee
      // the AK's "vollständig verschwinden" — no per-page loading-state
      // audit needed across Heute/Historie/Projekte/Auswertung.
      reloadIntoActiveWorkspace();
    } catch {
      setPending(false);
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative mb-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="workspace-switcher-menu"
        className={`flex w-full items-center gap-1.5 rounded-lg px-3 py-1 text-left transition-colors duration-150 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`}
      >
        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold tracking-[0.16em] text-text-secondary uppercase" title={activeName}>
          {activeName}
        </span>
        <ChevronsUpDown size={12} strokeWidth={2} className="shrink-0 text-text-secondary" aria-hidden="true" />
      </button>
      {open && (
        <div
          id="workspace-switcher-menu"
          role="menu"
          aria-label={t(lang, i18nWorkspaceSwitcher.menuLabel)}
          className="absolute top-full left-0 z-50 mt-1 w-full min-w-[200px] animate-dropdown-in rounded-xl border border-line bg-surface p-1.5 shadow-[0_18px_50px_-18px_rgba(24,24,23,0.42)]"
        >
          {workspaces.map((workspace) => (
            <div key={workspace.workspaceId} className="flex items-center gap-1">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={workspace.workspaceId === activeWorkspaceId}
                disabled={pending}
                onClick={() => handleSwitch(workspace.workspaceId)}
                className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground/80 transition-colors duration-150 hover:bg-paper hover:text-foreground focus-visible:bg-paper focus-visible:text-foreground disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`}
              >
                {/* Ticket 174: PERSONAL vs. ORGANIZATION must be
                    recognizable at a glance — the whole point being
                    "keine Verwechslung von privater und geschäftlicher
                    Zeit" — same icon pair components/RegistrationChoice.tsx
                    already uses for the same distinction at registration
                    time. */}
                {workspace.workspaceType === "PERSONAL" ? (
                  <User size={14} strokeWidth={2} className="shrink-0 text-text-secondary" aria-hidden="true" />
                ) : (
                  <Building2 size={14} strokeWidth={2} className="shrink-0 text-text-secondary" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{workspace.workspaceName}</span>
                  {/* No subtitle for PERSONAL — its own name already says
                      everything there is to say, adding "Persönlich"
                      under "Persönlich" would be pure noise. */}
                  {workspace.workspaceType !== "PERSONAL" && (
                    <span className="block truncate text-xs text-text-secondary">
                      {t(lang, i18nWorkspaceSwitcher.organizationLabel)} · {roleLabel(lang, workspace.role)}
                    </span>
                  )}
                </span>
                {workspace.workspaceId === activeWorkspaceId && (
                  <Check size={15} strokeWidth={2.2} className="shrink-0 text-brand" aria-hidden="true" />
                )}
              </button>
              {/* Ticket 112: the personal workspace can never be left
                  (Ticket 097's own guarantee: every account always has
                  exactly one) — no link shown for it, matching the
                  server-side leave_workspace RPC's own real constraint
                  (there is no protect-last-owner trigger exception for
                  "it's the personal workspace", a personal workspace's
                  owner simply always remains its sole owner). */}
              {workspace.workspaceType !== "PERSONAL" && (
                <Link
                  href={`/dashboard/workspaces/${workspace.workspaceId}/leave`}
                  onClick={() => setOpen(false)}
                  className={`shrink-0 rounded-md px-2 py-2 text-xs text-text-secondary transition-colors duration-150 hover:bg-paper hover:text-foreground ${focusRingClass}`}
                >
                  {t(lang, i18nWorkspaceSwitcher.leaveLink)}
                </Link>
              )}
            </div>
          ))}
          {/* Ticket 174 — a second, more convenient entry point into the
              already-existing Ticket 100 flow (also reachable via
              Einstellungen, components/SettingsClient.tsx's own
              WorkspaceSection) — not a new capability, just discoverable
              from where a user is actually thinking about workspaces. */}
          <div className="mt-1 border-t border-line pt-1">
            <Link
              href="/dashboard/workspaces/new"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-text-secondary transition-colors duration-150 hover:bg-paper hover:text-foreground ${focusRingClass}`}
            >
              <Plus size={14} strokeWidth={2} className="shrink-0" aria-hidden="true" />
              {t(lang, i18nWorkspaceSwitcher.createWorkspaceLink)}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
