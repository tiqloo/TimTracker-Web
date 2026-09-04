// Driven port for Ticket 099 (TimTracker-Starter repo) — server-side
// workspace-membership lookups. Backed by the `workspaces`/
// `workspace_memberships` tables from Tickets 096/097 (already live on
// `origin/master`, RLS restricts every row to the requesting user's own
// memberships as defense-in-depth alongside the explicit filters here).
//
// Deliberately NOT a general workspace CRUD port (create/rename/invite
// etc. belong to their own later tickets, e.g. 100/102) — this is only
// the read-side primitive every workspace-scoped request needs: "is this
// user actually a member of this workspace, and what's their personal
// workspace as a fallback."
export type WorkspaceRole = "owner" | "admin" | "member";

export interface WorkspaceMembership {
  workspaceId: string;
  role: WorkspaceRole;
}

export interface WorkspaceRepository {
  // `null` when the user has no membership row for this workspace id —
  // covers both "workspace exists but user isn't a member" and
  // "workspace id doesn't exist at all" identically, on purpose: neither
  // case may leak whether the workspace itself exists to a non-member.
  getMembership(userId: string, workspaceId: string): Promise<WorkspaceMembership | null>;

  // Every user has exactly one PERSONAL workspace (Ticket 097's backfill
  // + trigger guarantee this for every account, existing and new) — the
  // fallback target whenever no explicit/valid workspace is in play.
  getPersonalWorkspaceId(userId: string): Promise<string>;
}
