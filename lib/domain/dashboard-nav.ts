// Pure link-selection logic for DashboardNav.tsx (Ticket 173, selbst
// gefunden über das "Unternehmensbereich"-Paket) — kept framework-free
// (no next/link, no icons) so it can be unit-tested with plain
// `node --test`, same reasoning as lib/http/proxy-routing.ts already
// separates routing predicates out of proxy.ts. DashboardNav.tsx maps
// these ids to the actual {href, label, icon} objects, since those need
// activeWorkspaceId/lucide-react and don't belong in a pure logic file.
// Matches lib/repositories/workspace.repository.ts's WorkspaceType exactly
// (not re-exported from there to avoid pulling a repository-layer import
// into this framework-free file) — SYSTEM is treated identically to
// PERSONAL below (anything that isn't ORGANIZATION gets the flat nav).
export type WorkspaceKind = "PERSONAL" | "ORGANIZATION" | "SYSTEM";
export type WorkspaceRole = "owner" | "admin" | "member";

export type NavLinkId =
  | "today"
  | "history"
  | "analytics"
  | "projects"
  | "support"
  | "settings"
  | "overview"
  | "teamTimes"
  | "employees"
  | "companyAnalytics";

export type ManagementLinkId = "invitations" | "workspaceSettings" | "billing";

function isAdminRole(role: WorkspaceRole | undefined): boolean {
  return role === "owner" || role === "admin";
}

// The main nav row. PERSONAL keeps exactly the pre-Ticket-173 flat list,
// "history" labeled "Historie". ORGANIZATION keeps the same "history"
// route but the CALL SITE relabels it "Meine Zeiten" (parallels
// "Team-Zeiten" for an admin/owner) — "Einstellungen" moves out of the
// main row into the account dropdown's existing entry (still reachable,
// just not duplicated in both places).
export function resolveNavLinkIds(workspaceKind: WorkspaceKind, role: WorkspaceRole | undefined): NavLinkId[] {
  if (workspaceKind !== "ORGANIZATION") {
    return ["today", "history", "analytics", "projects", "support", "settings"];
  }
  if (isAdminRole(role)) {
    // Ticket 193 — "analytics" ("Auswertung", the personal page) stays
    // for an admin/owner's own time; "companyAnalytics" ("Auswertungen",
    // plural, Ticket 193's new page) is the additional workspace-wide
    // view, exactly the two-entry split the original nav mockup called
    // for ("Auswertung" for a member, "Auswertungen" for an owner/admin).
    return ["overview", "today", "history", "teamTimes", "employees", "projects", "analytics", "companyAnalytics", "support"];
  }
  return ["today", "history", "projects", "analytics", "support"];
}

// The "Verwaltung" group, shown in UserMenu's dropdown (not the main nav
// row) — Einladungen (Ticket 115) and Workspace-Einstellungen (Ticket
// 117) existed with zero entry point anywhere in the app before this
// (Einladungen) or only via Mitglieder (workspaceSettings, Ticket 181);
// Abrechnung reuses the existing personal billing page for now (no
// separate workspace billing yet, see Ticket 135's own "Konkretisierung"
// note) — a deliberate navigation-only stopgap, not a new feature.
export function resolveManagementLinkIds(workspaceKind: WorkspaceKind, role: WorkspaceRole | undefined): ManagementLinkId[] {
  if (workspaceKind !== "ORGANIZATION" || !isAdminRole(role)) {
    return [];
  }
  return ["invitations", "workspaceSettings", "billing"];
}
