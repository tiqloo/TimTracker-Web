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
export type WorkspaceType = "PERSONAL" | "ORGANIZATION" | "SYSTEM";

export interface WorkspaceMembership {
  workspaceId: string;
  role: WorkspaceRole;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  workspaceType: WorkspaceType;
}

// Ticket 102 — invitation role is intentionally narrower than
// WorkspaceRole above: an invitation can never directly grant 'owner'
// (that only ever happens via workspace creation, Ticket 100, or an
// explicit ownership transfer, Ticket 113).
export type InvitationRole = "admin" | "member";

export interface CreatedInvitation {
  id: string;
  // The one-time plaintext token — only ever returned here, right after
  // creation. Never persisted anywhere as plaintext (TimTracker-Starter
  // repo's create_workspace_invitation() stores only its SHA-256 hash).
  token: string;
  email: string;
  role: InvitationRole;
  expiresAt: string;
}

export interface InvitationPreview {
  email: string;
  workspaceName: string;
  role: InvitationRole;
  isValid: boolean;
}

export interface AcceptedInvitation {
  workspaceId: string;
  workspaceName: string;
  role: InvitationRole;
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

  // Ticket 100 — creates a new ORGANIZATION workspace with the calling
  // user recorded as its owner. Backed by a SECURITY DEFINER Postgres RPC
  // (TimTracker-Starter repo, create_organization_workspace()), not a
  // plain table insert — Ticket 096 deliberately never granted
  // INSERT on `workspaces`/`workspace_memberships` to `authenticated`,
  // and creating a workspace is a two-table, must-be-atomic operation
  // (workspace + its first membership), not a fit for RLS-gated
  // client-side inserts. Name validation (non-empty, length) happens both
  // here-adjacent in the application layer AND server-side in the RPC —
  // never trust only one side.
  createOrganization(name: string): Promise<Workspace>;

  // Ticket 102 — all three backed by SECURITY DEFINER RPCs
  // (TimTracker-Starter repo), same "no raw table grant" reasoning as
  // createOrganization above. createInvitation requires the caller to
  // already be an owner/admin of workspaceId — enforced server-side, this
  // port makes no promises about who's allowed to call it.
  createInvitation(workspaceId: string, email: string, role: InvitationRole): Promise<CreatedInvitation>;

  // Callable by an anonymous (not-yet-registered, not-yet-logged-in)
  // caller too — the whole point is letting a brand-new user's
  // registration form know which email/workspace an invitation link is
  // for, before they have any session at all. Never accepts on its own.
  previewInvitation(token: string): Promise<InvitationPreview>;

  // Requires an authenticated session whose account email matches the
  // invitation's — enforced server-side (Ticket 099's non-negotiable
  // rule applies here too: this port never decides that itself).
  acceptInvitation(token: string): Promise<AcceptedInvitation>;
}
