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
  MemberTimeEntryFilter,
  MemberTimeEntryRow,
  PendingInvitationSummary,
  ProjectTimeRow,
  ResentInvitation,
  RunningEntryRow,
  TeamTimeFilter,
  TeamTimeRow,
  Workspace,
  WorkspaceInvitationRow,
  WorkspaceMembership,
  WorkspaceMembershipSummary,
  WorkspaceMemberRow,
  WorkspaceRole,
  WorkspaceSettings,
  WorkspaceSettingsFields,
  WorkspaceSettingsInput,
  WorkspaceTimeFormat,
  WeekStart,
} from "@/lib/repositories/workspace.repository";
import { resolveWorkspaceIdWithFallback } from "../repositories/workspace.repository.ts";
import { ForbiddenError, ValidationError } from "../domain/application-error.ts";
import { requireUser } from "./auth.ts";
import { productFeatures } from "../config/product-features.ts";

export type {
  AcceptedInvitation,
  CreatedInvitation,
  InvitationPreview,
  InvitationRole,
  PendingInvitationSummary,
  ResentInvitation,
  Workspace,
  WorkspaceInvitationRow,
  WorkspaceMembership,
  WorkspaceMembershipSummary,
  WorkspaceMemberRow,
  WorkspaceMemberStatus,
  WorkspaceRole,
  WorkspaceSettings,
  WorkspaceSettingsFields,
  WorkspaceSettingsInput,
  WorkspaceType,
  WeekStart,
  WorkspaceDateFormat,
  WorkspaceDefaultLanguage,
  WorkspaceTimeFormat,
  TeamTimeFilter,
  TeamTimeRow,
  RunningEntryRow,
  MemberTimeEntryFilter,
  MemberTimeEntryRow,
  ProjectTimeRow,
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
  if (!productFeatures.workspaceAndTeam) return repos.workspace.getPersonalWorkspaceId(userId);
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

// Ticket 183 — Fall E aus Ticket 168: for the dashboard's pending-
// invitation banner. Same "the RPC itself is the authoritative check"
// relationship as listWorkspaceMembers/listWorkspaceInvitations above —
// list_pending_invitations_for_current_user only ever returns rows
// matching the caller's own account email.
export async function listPendingInvitations(repos: Repositories): Promise<PendingInvitationSummary[]> {
  await requireUser(repos);
  if (!productFeatures.invitations) return [];
  return repos.workspace.listPendingInvitations();
}

// Ticket 183 — the banner's "Annehmen" action, no token involved (the
// caller never saw the original invitation link). The RPC re-validates
// the email match itself regardless of how `invitationId` was obtained.
export async function acceptPendingInvitation(repos: Repositories, invitationId: string): Promise<AcceptedInvitation> {
  await requireUser(repos);
  return repos.workspace.acceptPendingInvitation(invitationId);
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
  if (!productFeatures.workspaceAndTeam) {
    const personalWorkspaceId = await repos.workspace.getPersonalWorkspaceId(userId);
    const workspaces = (await repos.workspace.listMemberships(userId)).filter(
      (workspace) => workspace.workspaceId === personalWorkspaceId,
    );
    return { workspaces, activeWorkspaceId: personalWorkspaceId };
  }
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
  if (!productFeatures.workspaceAndTeam) {
    const personalWorkspaceId = await repos.workspace.getPersonalWorkspaceId(userId);
    if (workspaceId !== personalWorkspaceId) throw new ForbiddenError("Workspace switching is disabled in personal mode.");
  }
  await repos.activeWorkspace.set(workspaceId);
}

// Ticket 118 — the one piece every day-boundary-sensitive read
// (lib/application/dashboard.ts's "Heute", the CSV/PDF/full-data exports,
// the analytics project totals) needs: which IANA timezone the currently
// active workspace is configured with (Ticket 117's own setting). Same
// resolution rule as getWorkspaceSwitcherData above (stored cookie value,
// falling back to the personal workspace) rather than a second, divergent
// lookup — kept as its own small function (not folded into
// getWorkspaceSwitcherData) since most callers here only ever need this
// one string, not the whole switcher payload.
export async function getActiveWorkspaceTimeZone(repos: Repositories): Promise<string> {
  const userId = await requireUser(repos);
  const cookieValue = await repos.activeWorkspace.get();
  const workspaceId = await resolveActiveWorkspaceId(repos, userId, cookieValue);
  const settings = await repos.workspace.getSettings(workspaceId);
  return settings.timezone;
}

// Ticket 188 (selbst gefunden): Ticket 117 shipped a full "Zeitformat"
// (24h/12h) workspace setting with a working settings-UI (see
// WorkspaceSettingsClient.tsx) and persists it via update_workspace_settings
// — but nothing ever read `settings.timeFormat` back for actual time-of-day
// rendering (DayDetail.tsx's formatTime() calls were driven only by UI
// language, never by this setting). Same resolution rule as
// getActiveWorkspaceTimeZone above.
export async function getActiveWorkspaceTimeFormat(repos: Repositories): Promise<WorkspaceTimeFormat> {
  const userId = await requireUser(repos);
  const cookieValue = await repos.activeWorkspace.get();
  const workspaceId = await resolveActiveWorkspaceId(repos, userId, cookieValue);
  const settings = await repos.workspace.getSettings(workspaceId);
  return settings.timeFormat;
}

// Ticket 188 (selbst gefunden, Folge-Fund): Ticket 117s "Wochenbeginn"
// (Montag/Sonntag) hatte denselben "gespeichert, nie gelesen"-Bug wie
// timeFormat oben — jede "Diese Woche"-Berechnung war fest auf Montag
// verdrahtet (lib/format.ts's startOfWeekIso). Gleiche Cookie-Fallback-
// Auflösung wie getActiveWorkspaceTimeZone/getActiveWorkspaceTimeFormat.
export async function getActiveWorkspaceWeekStart(repos: Repositories): Promise<WeekStart> {
  const userId = await requireUser(repos);
  const cookieValue = await repos.activeWorkspace.get();
  const workspaceId = await resolveActiveWorkspaceId(repos, userId, cookieValue);
  const settings = await repos.workspace.getSettings(workspaceId);
  return settings.weekStart;
}

// Ticket 122 — pages that need to know the CALLER's own role in the
// active workspace purely to decide whether to render management
// controls at all (projects/page.tsx: hide create/rename/archive for a
// plain member — the RPC/RLS underneath is the real, sole authority
// either way, same "hide a button that could only ever fail" reasoning
// as WorkspaceMembersClient's own isRemovable/isTransferTarget guards).
// Same cookie+fallback resolution as getActiveWorkspaceTimeZone above.
export async function getActiveWorkspaceRole(repos: Repositories): Promise<WorkspaceRole> {
  const userId = await requireUser(repos);
  const cookieValue = await repos.activeWorkspace.get();
  const workspaceId = await resolveActiveWorkspaceId(repos, userId, cookieValue);
  const membership = await requireWorkspaceMembership(repos, userId, workspaceId);
  return membership.role;
}

// Ticket 123 — the bare active workspace id, for pages/components that
// need to pass it on to another workspace-scoped call (e.g. projects/
// page.tsx passing it to ProjectsClient so a project's access panel can
// call listWorkspaceMembers(repos, workspaceId) for its own assignment
// checklist) without needing the full switcher payload. Same cookie+
// fallback resolution as getActiveWorkspaceRole/getActiveWorkspaceTimeZone
// above.
export async function getActiveWorkspaceId(repos: Repositories): Promise<string> {
  const userId = await requireUser(repos);
  const cookieValue = await repos.activeWorkspace.get();
  return resolveActiveWorkspaceId(repos, userId, cookieValue);
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

// Ticket 112 — "Workspace verlassen". The sole-owner rejection (a request
// to transfer ownership first, Ticket 113) is entirely the RPC's job —
// see WorkspaceRepository#leaveWorkspace's own doc.
export async function leaveWorkspace(repos: Repositories, workspaceId: string): Promise<void> {
  await requireUser(repos);
  await repos.workspace.leaveWorkspace(workspaceId);
}

// Ticket 113 — "Ownership übertragen". The "caller is the current owner"
// and "target is an existing admin" checks are entirely the RPC's job
// (see WorkspaceRepository#transferOwnership's own doc) — re-authentication
// happens inside the repository adapter, before the RPC is ever called.
export async function transferWorkspaceOwnership(
  repos: Repositories,
  workspaceId: string,
  newOwnerUserId: string,
  currentPassword: string,
): Promise<void> {
  await requireUser(repos);
  await repos.workspace.transferOwnership(workspaceId, newOwnerUserId, currentPassword);
}

// Ticket 115 — "Einladungsverwaltung". No requireWorkspaceMembership call
// here, same reasoning as listWorkspaceMembers above: list_workspace_invitations
// itself is the authoritative owner/admin check.
export async function listWorkspaceInvitations(repos: Repositories, workspaceId: string): Promise<WorkspaceInvitationRow[]> {
  await requireUser(repos);
  return repos.workspace.listInvitations(workspaceId);
}

// Ticket 115 — "erneut senden". The RPC itself rejects an already-
// accepted/revoked invitation and rotates the token — this function does
// not duplicate those checks, same relationship as every other RPC-backed
// write in this file.
export async function resendWorkspaceInvitation(repos: Repositories, invitationId: string): Promise<ResentInvitation> {
  await requireUser(repos);
  return repos.workspace.resendInvitation(invitationId);
}

// Ticket 115 — "widerrufen". Idempotent server-side (see
// WorkspaceRepository#revokeInvitation's own doc).
export async function revokeWorkspaceInvitation(repos: Repositories, invitationId: string): Promise<void> {
  await requireUser(repos);
  await repos.workspace.revokeInvitation(invitationId);
}

// Ticket 115 — "Rolle ändern" (for a still-open invitation, distinct from
// updateWorkspaceMemberRole above which targets an active membership).
export async function updateWorkspaceInvitationRole(
  repos: Repositories,
  invitationId: string,
  role: InvitationRole,
): Promise<{ id: string; role: InvitationRole }> {
  await requireUser(repos);
  if (role !== "admin" && role !== "member") {
    throw new ValidationError("Role must be either admin or member.");
  }
  return repos.workspace.updateInvitationRole(invitationId, role);
}

// Ticket 117 — "Workspace-Einstellungen". No requireWorkspaceMembership
// call here, same reasoning as listWorkspaceMembers/listWorkspaceInvitations
// above: get_workspace_settings itself is the authoritative membership
// check (readable by any member, not just owner/admin).
export async function getWorkspaceSettings(repos: Repositories, workspaceId: string): Promise<WorkspaceSettings> {
  await requireUser(repos);
  return repos.workspace.getSettings(workspaceId);
}

// The server-side RPC (update_workspace_settings) independently
// re-validates every field (name length, a real IANA timezone, the fixed
// enums) and the owner/admin check — this is the fast, user-facing check
// for the one field worth catching early, same relationship as every
// other validate-then-delegate function in this file.
export async function updateWorkspaceSettings(
  repos: Repositories,
  workspaceId: string,
  input: WorkspaceSettingsInput,
): Promise<WorkspaceSettingsFields> {
  await requireUser(repos);
  const name = input.name.trim();
  if (!name) throw new ValidationError("Workspace name must not be empty.");
  if (name.length > WORKSPACE_NAME_MAX_LENGTH) {
    throw new ValidationError(`Workspace name must not exceed ${WORKSPACE_NAME_MAX_LENGTH} characters.`);
  }
  return repos.workspace.updateSettings(workspaceId, { ...input, name });
}

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

// Fast, user-facing mirror of the 'workspace-logos' Storage bucket's own
// file_size_limit/allowed_mime_types (TimTracker-Starter repo migration)
// — the bucket enforces both authoritatively regardless of this check,
// same "client check is a courtesy, server check is the real gate"
// relationship as every validated field in this file.
export async function uploadWorkspaceLogo(repos: Repositories, workspaceId: string, file: File): Promise<string> {
  await requireUser(repos);
  if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
    throw new ValidationError("The logo must be a PNG, JPEG or WebP image.");
  }
  if (file.size > LOGO_MAX_BYTES) {
    throw new ValidationError("The logo must not exceed 2 MB.");
  }
  return repos.workspace.uploadLogo(workspaceId, file);
}

export async function removeWorkspaceLogo(repos: Repositories, workspaceId: string): Promise<void> {
  await requireUser(repos);
  await repos.workspace.removeLogo(workspaceId);
}

// Storage RLS (the bucket's own SELECT policy, TimTracker-Starter repo
// migration) is the sole authoritative "is this caller actually a member
// of the owning workspace" check for whether the signed URL request
// itself succeeds — this function does not duplicate that check, same
// relationship as every other RPC/Storage-backed read in this file.
export async function getWorkspaceLogoUrl(repos: Repositories, logoPath: string): Promise<string> {
  await requireUser(repos);
  return repos.workspace.getLogoUrl(logoPath);
}

// Ticket 121 — "Team-Zeiten für Admins". No requireWorkspaceMembership
// call here, same reasoning as listWorkspaceMembers/listWorkspaceInvitations
// above: list_workspace_team_time itself is the authoritative owner/admin
// check (no separate "manager" role yet, per the ticket's own AK).
export async function getTeamTime(
  repos: Repositories,
  workspaceId: string,
  fromDay: string,
  toDay: string,
  filter?: TeamTimeFilter,
): Promise<TeamTimeRow[]> {
  await requireUser(repos);
  return repos.workspace.listTeamTime(workspaceId, fromDay, toDay, filter);
}

// Ticket 191 — same reasoning as getTeamTime above: list_workspace_running_entries
// (TimTracker-Starter repo) is itself the authoritative owner/admin check.
export async function getRunningEntries(repos: Repositories, workspaceId: string): Promise<RunningEntryRow[]> {
  await requireUser(repos);
  return repos.workspace.listRunningEntries(workspaceId);
}

// Ticket 192 — "Mitarbeiterprofil". Same reasoning as getTeamTime/
// getRunningEntries above: list_workspace_member_time_entries
// (TimTracker-Starter repo) is itself the authoritative owner/admin
// check.
export async function getMemberTimeEntries(
  repos: Repositories,
  workspaceId: string,
  userId: string,
  fromDay: string,
  toDay: string,
  filter?: MemberTimeEntryFilter,
): Promise<MemberTimeEntryRow[]> {
  await requireUser(repos);
  return repos.workspace.listMemberTimeEntries(workspaceId, userId, fromDay, toDay, filter);
}

// Ticket 191 — "Unternehmensübersicht / Team-Dashboard". A single
// composite read for the new /dashboard/overview page, combining three
// already-existing/newly-added RPCs rather than having the page call each
// one separately: member count (110), today's per-member totals (121,
// scoped to fromDay=toDay=today), and currently-running entries (191,
// this same ticket). All three share the exact same
// is_workspace_admin_or_owner gate server-side — this function itself
// does no additional authorization, same "the RPC is the authority"
// pattern as getTeamTime/getRunningEntries above.
export interface WorkspaceOverviewMemberTotal {
  userId: string;
  email: string;
  displayName: string | null;
  totalSeconds: number;
}

export interface WorkspaceOverview {
  memberCount: number;
  activeTodayCount: number;
  totalSecondsToday: number;
  runningEntries: RunningEntryRow[];
  todayByMember: WorkspaceOverviewMemberTotal[];
}

export async function getWorkspaceOverview(
  repos: Repositories,
  workspaceId: string,
  today: string,
): Promise<WorkspaceOverview> {
  await requireUser(repos);
  const [members, todayRows, runningEntries] = await Promise.all([
    repos.workspace.listMembers(workspaceId),
    repos.workspace.listTeamTime(workspaceId, today, today),
    repos.workspace.listRunningEntries(workspaceId),
  ]);

  return {
    memberCount: members.filter((member) => member.status === "active").length,
    activeTodayCount: todayRows.length,
    totalSecondsToday: todayRows.reduce((sum, row) => sum + row.totalSeconds, 0),
    runningEntries,
    todayByMember: todayRows
      .map((row) => ({
        userId: row.userId,
        email: row.email,
        displayName: row.displayName,
        totalSeconds: row.totalSeconds,
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds),
  };
}

// Ticket 193 — same reasoning as getTeamTime/getRunningEntries above:
// list_workspace_project_time (TimTracker-Starter repo) is itself the
// authoritative owner/admin check.
export async function getProjectTime(
  repos: Repositories,
  workspaceId: string,
  fromDay: string,
  toDay: string,
  filter?: TeamTimeFilter,
): Promise<ProjectTimeRow[]> {
  await requireUser(repos);
  return repos.workspace.listProjectTime(workspaceId, fromDay, toDay, filter);
}

// Ticket 193 — "Unternehmensauswertungen". A single composite read for
// the new company-analytics page: total time, time-per-member,
// time-per-project and working-day count (a distinct `day` count) are
// all just different groupings of the SAME raw (day, member, project)
// row set from getProjectTime — no separate RPC round trip per metric.
export interface CompanyAnalyticsMemberTotal {
  userId: string;
  email: string;
  displayName: string | null;
  totalSeconds: number;
}

export interface CompanyAnalyticsProjectTotal {
  projectId: string;
  projectName: string;
  totalSeconds: number;
}

export interface CompanyAnalytics {
  totalSeconds: number;
  workingDays: number;
  byMember: CompanyAnalyticsMemberTotal[];
  byProject: CompanyAnalyticsProjectTotal[];
}

export async function getCompanyAnalytics(
  repos: Repositories,
  workspaceId: string,
  fromDay: string,
  toDay: string,
  filter?: TeamTimeFilter,
): Promise<CompanyAnalytics> {
  const rows = await getProjectTime(repos, workspaceId, fromDay, toDay, filter);

  const byMemberMap = new Map<string, CompanyAnalyticsMemberTotal>();
  const byProjectMap = new Map<string, CompanyAnalyticsProjectTotal>();
  const days = new Set<string>();
  let totalSeconds = 0;

  for (const row of rows) {
    totalSeconds += row.totalSeconds;
    days.add(row.day);

    const member = byMemberMap.get(row.userId) ?? {
      userId: row.userId,
      email: row.email,
      displayName: row.displayName,
      totalSeconds: 0,
    };
    member.totalSeconds += row.totalSeconds;
    byMemberMap.set(row.userId, member);

    const project = byProjectMap.get(row.projectId) ?? {
      projectId: row.projectId,
      projectName: row.projectName,
      totalSeconds: 0,
    };
    project.totalSeconds += row.totalSeconds;
    byProjectMap.set(row.projectId, project);
  }

  return {
    totalSeconds,
    workingDays: days.size,
    byMember: Array.from(byMemberMap.values()).sort((a, b) => b.totalSeconds - a.totalSeconds),
    byProject: Array.from(byProjectMap.values()).sort((a, b) => b.totalSeconds - a.totalSeconds),
  };
}
