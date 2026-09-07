// Application core (use cases) — Ticket 099 (TimTracker-Starter repo):
// server-side workspace context + authorization. Same "driving adapters
// call these, never lib/repositories/* directly" rule as
// lib/application/auth.ts.
import type { Repositories } from "@/lib/repositories/repositories";
import type {
  AcceptedInvitation,
  CreatedInvitation,
  InvitationPreview,
  InvitationRole,
  Workspace,
  WorkspaceMembership,
  WorkspaceMembershipSummary,
  WorkspaceMemberRow,
} from "@/lib/repositories/workspace.repository";
import { resolveWorkspaceIdWithFallback } from "../repositories/workspace.repository.ts";
import { ForbiddenError, ValidationError } from "../domain/application-error.ts";
import { requireUser } from "./auth.ts";

export type {
  AcceptedInvitation,
  CreatedInvitation,
  InvitationPreview,
  InvitationRole,
  Workspace,
  WorkspaceMembership,
  WorkspaceMembershipSummary,
  WorkspaceMemberRow,
  WorkspaceMemberStatus,
  WorkspaceRole,
  WorkspaceType,
} from "@/lib/repositories/workspace.repository";
export { ForbiddenError } from "../domain/application-error.ts";

const WORKSPACE_NAME_MAX_LENGTH = 100;
// Same permissive shape the server-side RPC itself checks
// (create_workspace_invitation, TimTracker-Starter repo) — this is only
// the fast, user-facing check, not the authoritative one, so it
// deliberately stays loose rather than trying to fully validate RFC 5322.
const EMAIL_SHAPE_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// THE non-negotiable primitive from Ticket 099: every workspace-scoped
// operation (reading/writing projects or time entries once Ticket 098's
// workspace_id columns are wired into these repositories, invite
// management, settings, ...) must call this before touching any
// workspace-scoped data — never trust a client-sent workspaceId on its
// own. Throws ForbiddenError (403, not 404 — see Ticket 063's error
// contract, referenced verbatim by 099's own AC) for both "workspace
// doesn't exist" and "workspace exists but caller isn't a member": a
// non-member must not be able to distinguish the two from the response.
export async function requireWorkspaceMembership(
  repos: Repositories,
  userId: string,
  workspaceId: string,
): Promise<WorkspaceMembership> {
  const membership = await repos.workspace.getMembership(userId, workspaceId);
  if (!membership) throw new ForbiddenError("You are not a member of this workspace.");
  return membership;
}

// Resolves which workspace a request should operate on for the "what's
// my current context" case — deliberately NOT the same as
// requireWorkspaceMembership above. This is for recovering a *stored*
// preference that may have gone stale (the referenced workspace was
// deleted, or the caller was removed from it since the value was last
// saved — Ticket 099's own edge case: "Fallback auf den persönlichen
// Workspace statt Absturz") and for not-yet-workspace-aware callers
// (current Mac app, pre-Ticket-104) that never send a workspaceId at
// all. It intentionally does NOT throw for an invalid/foreign id, only
// falls back — any route that actually reads/writes workspace-scoped
// data on behalf of an explicit request must still call
// requireWorkspaceMembership itself, this function alone is not an
// authorization check.
export async function resolveActiveWorkspaceId(
  repos: Repositories,
  userId: string,
  requestedWorkspaceId: string | null | undefined,
): Promise<string> {
  return resolveWorkspaceIdWithFallback(repos.workspace, userId, requestedWorkspaceId);
}

// Ticket 100 — "Unternehmens-Workspace erstellen". Trims and validates the
// name the same way createProject() (lib/application/projects.ts) does for
// its own name field — same validation layer as every other "create X with
// a name" form in this app, per the ticket's own AC. The server-side RPC
// (create_organization_workspace) validates again independently; this is
// the fast, user-facing check, not the authoritative one.
export async function createOrganizationWorkspace(repos: Repositories, rawName: string): Promise<Workspace> {
  await requireUser(repos);
  const name = rawName.trim();
  if (!name) throw new ValidationError("Workspace name must not be empty.");
  if (name.length > WORKSPACE_NAME_MAX_LENGTH) {
    throw new ValidationError(`Workspace name must not exceed ${WORKSPACE_NAME_MAX_LENGTH} characters.`);
  }
  return repos.workspace.createOrganization(name);
}

// Ticket 102 — "Mitarbeiter einladen". Server-side (create_workspace_invitation)
// independently re-checks both the email shape AND that the caller is an
// owner/admin of workspaceId — this is the fast, user-facing check, not
// the authoritative one, same relationship as createOrganizationWorkspace
// above.
export async function inviteWorkspaceMember(
  repos: Repositories,
  workspaceId: string,
  rawEmail: string,
  role: InvitationRole,
): Promise<CreatedInvitation> {
  await requireUser(repos);
  const email = rawEmail.trim().toLowerCase();
  if (!email) throw new ValidationError("An email address is required.");
  if (!EMAIL_SHAPE_PATTERN.test(email)) throw new ValidationError("This does not look like a valid email address.");
  return repos.workspace.createInvitation(workspaceId, email, role);
}

// Deliberately does NOT call requireUser: the whole point is letting a
// brand-new, not-yet-registered/not-yet-logged-in visitor who just
// clicked an invitation link find out which email/workspace it's for
// (Ticket 102 AK: pre-fill the registration form) — see
// WorkspaceRepository#previewInvitation's own comment.
export async function previewWorkspaceInvitation(repos: Repositories, token: string): Promise<InvitationPreview> {
  return repos.workspace.previewInvitation(token);
}

// Requires an authenticated session — mirrors the server-side RPC's own
// check, giving a typed UnauthorizedError early rather than only
// surfacing the RPC's raw error.
export async function acceptWorkspaceInvitation(repos: Repositories, token: string): Promise<AcceptedInvitation> {
  await requireUser(repos);
  return repos.workspace.acceptInvitation(token);
}

// Ticket 103 — everything the workspace switcher needs in one call: every
// workspace the caller belongs to, plus which one is CURRENTLY active
// (resolved with the same fallback rule projects/time-entries themselves
// use — see resolveWorkspaceIdWithFallback — never the raw, potentially
// stale cookie value, so the switcher can never highlight a workspace the
// user isn't actually seeing data from).
export interface WorkspaceSwitcherData {
  workspaces: WorkspaceMembershipSummary[];
  activeWorkspaceId: string;
}

export async function getWorkspaceSwitcherData(repos: Repositories): Promise<WorkspaceSwitcherData> {
  const userId = await requireUser(repos);
  const [workspaces, cookieValue] = await Promise.all([
    repos.workspace.listMemberships(userId),
    repos.activeWorkspace.get(),
  ]);
  const activeWorkspaceId = await resolveWorkspaceIdWithFallback(repos.workspace, userId, cookieValue);
  return { workspaces, activeWorkspaceId };
}

// Switches the active workspace: validates the caller is actually a
// member of `workspaceId` (requireWorkspaceMembership — the switcher UI
// only ever offers workspaces the caller already belongs to, but this is
// never trusted client-side, same rule as every other workspace-scoped
// write in this file) before persisting it as the new cookie value.
// Callers are responsible for reloading data afterwards (a full navigation
// — see components/WorkspaceSwitcher.tsx's own comment for why a soft
// router.refresh() isn't enough here).
export async function switchActiveWorkspace(repos: Repositories, workspaceId: string): Promise<void> {
  const userId = await requireUser(repos);
  await requireWorkspaceMembership(repos, userId, workspaceId);
  await repos.activeWorkspace.set(workspaceId);
}

// Ticket 110 — "Workspace-Mitgliederübersicht". No requireWorkspaceMembership
// call here on purpose: the RPC itself is the authoritative owner/admin
// check (list_workspace_members raises for anyone else, including a
// member of a DIFFERENT workspace) — same "the RPC is the sole
// authoritative check" reasoning already established for the invite page
// (app/(dashboard)/dashboard/workspaces/[workspaceId]/invite/page.tsx's
// own comment).
export async function listWorkspaceMembers(repos: Repositories, workspaceId: string): Promise<WorkspaceMemberRow[]> {
  await requireUser(repos);
  return repos.workspace.listMembers(workspaceId);
}

// Ticket 110 — the caller-facing guard (never a direct 'owner' grant) is
// enforced server-side too (RPC rejects with a 22023), this is only the
// fast, user-facing check, same relationship as every other
// validate-then-delegate function in this file.
export async function updateWorkspaceMemberRole(
  repos: Repositories,
  workspaceId: string,
  userId: string,
  role: InvitationRole,
): Promise<{ userId: string; role: InvitationRole }> {
  await requireUser(repos);
  if (role !== "admin" && role !== "member") {
    throw new ValidationError("Role must be either admin or member.");
  }
  return repos.workspace.updateMemberRole(workspaceId, userId, role);
}

// Ticket 111 — "Mitglied entfernen". Self-removal and owner-removal are
// rejected server-side (the RPC's own job, see WorkspaceRepository#removeMember's
// doc) — this function does not duplicate those checks, same relationship
// as every other RPC-backed write in this file.
export async function removeWorkspaceMember(repos: Repositories, workspaceId: string, userId: string): Promise<void> {
  await requireUser(repos);
  await repos.workspace.removeMember(workspaceId, userId);
}
