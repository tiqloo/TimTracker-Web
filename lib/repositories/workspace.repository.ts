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

// Ticket 103 — one row of "every workspace I'm a member of", for the
// workspace switcher. A superset of WorkspaceMembership (adds the name/
// type the switcher UI actually needs to render each option) rather than
// reusing Workspace+WorkspaceMembership separately — the switcher always
// needs both together, one row per membership.
export interface WorkspaceMembershipSummary {
  workspaceId: string;
  workspaceName: string;
  workspaceType: WorkspaceType;
  role: WorkspaceRole;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  workspaceType: WorkspaceType;
}

// Ticket 110 — one row of "everyone associated with this workspace",
// combining real memberships AND still-open/expired/revoked invitations
// into one list (exactly what the members overview shows in one table).
// `userId`/`displayName` are only ever set for an "active" row — an
// invitation that hasn't been accepted yet has no account to point at.
export type WorkspaceMemberStatus = "active" | "invited" | "invitation_expired" | "invitation_revoked";

export interface WorkspaceMemberRow {
  userId: string | null;
  email: string;
  displayName: string | null;
  role: WorkspaceRole;
  status: WorkspaceMemberStatus;
  since: string;
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

  // Ticket 103 — every workspace the user belongs to, for the workspace
  // switcher. No fixed order promised by the port itself; the adapter
  // returns the personal workspace first (see its own comment).
  listMemberships(userId: string): Promise<WorkspaceMembershipSummary[]>;

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

  // Ticket 110 — backed by a SECURITY DEFINER RPC
  // (list_workspace_members, TimTracker-Starter repo) that itself checks
  // the caller is an owner/admin of workspaceId; this port makes no
  // promises about who's allowed to call it.
  listMembers(workspaceId: string): Promise<WorkspaceMemberRow[]>;

  // Ticket 110 — the one member-management action with no other ticket
  // of its own (unlike remove-member, Ticket 111, or resend-invitation,
  // Ticket 115). Never grants 'owner' — enforced server-side.
  updateMemberRole(workspaceId: string, userId: string, role: InvitationRole): Promise<{ userId: string; role: InvitationRole }>;

  // Ticket 111 — backed by a SECURITY DEFINER RPC (remove_workspace_member,
  // TimTracker-Starter repo) that itself rejects self-removal (Ticket
  // 112's own "leave workspace" flow) and removing an owner (Ticket 113's
  // own ownership-transfer flow); this port makes no promises about
  // either case, the RPC is the sole authority.
  removeMember(workspaceId: string, userId: string): Promise<void>;

  // Ticket 112 — backed by a SECURITY DEFINER RPC (leave_workspace,
  // TimTracker-Starter repo). Unlike removeMember, no owner/admin check
  // at all — any member may end their OWN membership. The sole owner of
  // a workspace is rejected server-side (the existing last-owner-protection
  // trigger), pointing to the future ownership-transfer flow (Ticket 113).
  leaveWorkspace(workspaceId: string): Promise<void>;

  // Ticket 113 — backed by a SECURITY DEFINER RPC (transfer_workspace_ownership,
  // TimTracker-Starter repo) that itself checks the caller is the CURRENT
  // owner (not just any owner/admin) and that the target is an existing
  // admin of the same workspace. `currentPassword` re-authenticates the
  // caller FIRST (same established pattern as AuthRepository#changeEmail/
  // changePassword: a fresh client.auth.signInWithPassword() against the
  // caller's own session email) — throws ReauthenticationFailedError on a
  // wrong password, before the RPC itself is ever called.
  transferOwnership(workspaceId: string, newOwnerUserId: string, currentPassword: string): Promise<void>;
}

// Ticket 103 — the one fallback rule every "which workspace should this
// request operate on" caller needs: an explicit/stored candidate id wins
// IF the user is actually still a member of it, otherwise fall back to
// their personal workspace (Ticket 099's own edge case: a stale/foreign
// value must never error or crash the page, just quietly fall back).
//
// Lives here, against the port (not lib/application/workspace.ts's
// Repositories-shaped resolveActiveWorkspaceId, which this now delegates
// to), specifically so BOTH the application layer AND the composition
// roots can call it: the composition roots need this exact logic to
// resolve the active workspace id lazily inside the projects/time-entries
// adapter factories (lib/repositories/supabase/{projects,time-entries}.
// repository.ts), at a point where a full Repositories object doesn't
// exist yet (it's still being constructed) — only the already-built
// WorkspaceRepository adapter is available. Duplicating this rule instead
// of sharing it would risk the two copies silently drifting apart.
export async function resolveWorkspaceIdWithFallback(
  workspace: WorkspaceRepository,
  userId: string,
  candidateWorkspaceId: string | null | undefined,
): Promise<string> {
  if (candidateWorkspaceId) {
    const membership = await workspace.getMembership(userId, candidateWorkspaceId);
    if (membership) return candidateWorkspaceId;
  }
  return workspace.getPersonalWorkspaceId(userId);
}
