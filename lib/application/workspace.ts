// Application core (use cases) — Ticket 099 (TimTracker-Starter repo):
// server-side workspace context + authorization. Same "driving adapters
// call these, never lib/repositories/* directly" rule as
// lib/application/auth.ts.
import type { Repositories } from "@/lib/repositories/repositories";
import type { Workspace, WorkspaceMembership } from "@/lib/repositories/workspace.repository";
import { ForbiddenError, ValidationError } from "../domain/application-error.ts";
import { requireUser } from "./auth.ts";

export type { Workspace, WorkspaceMembership, WorkspaceRole, WorkspaceType } from "@/lib/repositories/workspace.repository";
export { ForbiddenError } from "../domain/application-error.ts";

const WORKSPACE_NAME_MAX_LENGTH = 100;

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
  if (requestedWorkspaceId) {
    const membership = await repos.workspace.getMembership(userId, requestedWorkspaceId);
    if (membership) return requestedWorkspaceId;
  }
  return repos.workspace.getPersonalWorkspaceId(userId);
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
