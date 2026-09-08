import assert from "node:assert/strict";
import test from "node:test";
import {
  changeEmail,
  changePassword,
  completeOAuthSignIn,
  register,
  requireUser,
  signInWithGoogle,
  updateDisplayName,
  updatePassword,
} from "./auth.ts";
import { setDailyGoalHours } from "./daily-goal.ts";
import {
  assignTimeEntryToProject,
  getBreakdownForDay,
  getEntriesForDay,
} from "./dashboard.ts";
import { getFullDataExport } from "./data-export.ts";
import {
  archiveProject,
  assignProjectMember,
  createProject,
  listProjectMembers,
  listProjects,
  renameProject,
  setProjectRestricted,
  unassignProjectMember,
} from "./projects.ts";
import type { ProjectMemberRow } from "./projects.ts";
import {
  acceptWorkspaceInvitation,
  createOrganizationWorkspace,
  getActiveWorkspaceId,
  getActiveWorkspaceRole,
  getActiveWorkspaceTimeZone,
  getTeamTime,
  getWorkspaceLogoUrl,
  getWorkspaceSettings,
  getWorkspaceSwitcherData,
  inviteWorkspaceMember,
  leaveWorkspace,
  listWorkspaceInvitations,
  listWorkspaceMembers,
  previewWorkspaceInvitation,
  removeWorkspaceLogo,
  removeWorkspaceMember,
  requireWorkspaceMembership,
  resendWorkspaceInvitation,
  resolveActiveWorkspaceId,
  revokeWorkspaceInvitation,
  switchActiveWorkspace,
  transferWorkspaceOwnership,
  updateWorkspaceInvitationRole,
  updateWorkspaceMemberRole,
  updateWorkspaceSettings,
  uploadWorkspaceLogo,
} from "./workspace.ts";
import type { TeamTimeRow, WorkspaceInvitationRow, WorkspaceMemberRow, WorkspaceSettings } from "./workspace.ts";
import { ForbiddenError, UnauthorizedError, ValidationError } from "../domain/application-error.ts";
import type { Profile } from "../domain/profile.ts";
import type { Project } from "../domain/project.ts";
import type { Subscription } from "../domain/subscription.ts";
import type { DailyBreakdown, TimeEntry } from "../domain/time-entry.ts";
import type { Repositories } from "../repositories/repositories.ts";

const MANAGED_PROJECT: Project = {
  id: "project-1",
  name: "Alpha",
  colorHex: "B4592E",
  customer: "Customer",
  notes: "",
  isDefault: false,
  isArchived: false,
  updatedAt: "2026-01-01T00:00:00Z",
  isRestricted: false,
};

const DEFAULT_PROJECT: Project = {
  ...MANAGED_PROJECT,
  id: "default",
  name: "Arbeitszeit",
  isDefault: true,
};

const ENTRY: TimeEntry = {
  id: "entry-1",
  projectId: MANAGED_PROJECT.id,
  day: "2026-01-02",
  startTime: "2026-01-02T08:00:00Z",
  endTime: "2026-01-02T09:00:00Z",
  source: "manual",
  note: null,
  updatedAt: "2026-01-02T09:00:00Z",
};

interface MemoryState {
  userId: string | null;
  profile: Profile;
  projects: Project[];
  entries: TimeEntry[];
  subscription: Subscription;
  dailyGoal: number | null;
  personalWorkspaceId: string;
  // workspaceId -> role, for every workspace this fake's user is
  // (supposedly) a member of. The personal workspace is a member by
  // default, same as real Ticket 097 backfill guarantees.
  memberships: Record<string, "owner" | "admin" | "member">;
  // workspaceId -> {name, type}, the switcher-only detail listMemberships
  // needs on top of `memberships` above (Ticket 103).
  workspaceDetails: Record<string, { name: string; type: "PERSONAL" | "ORGANIZATION" }>;
  // Raw, unvalidated "active workspace" cookie value (Ticket 103) — null
  // until switchActiveWorkspace() (or a test override) sets one, exactly
  // like a first-ever visit with no cookie yet.
  activeWorkspaceCookie: string | null;
  // token -> invitation, for the Ticket 102 fakes below.
  invitations: Record<string, { email: string; workspaceId: string; workspaceName: string; role: "admin" | "member"; accepted: boolean }>;
  // workspaceId -> member/invitation rows, for the Ticket 110 fakes below.
  memberRowsByWorkspace: Record<string, WorkspaceMemberRow[]>;
  // workspaceId -> invitation rows (own id, unlike memberRowsByWorkspace
  // above), for the Ticket 115 fakes below.
  invitationRowsByWorkspace: Record<string, WorkspaceInvitationRow[]>;
  // workspaceId -> settings row, for the Ticket 117 fakes below.
  settingsByWorkspace: Record<string, WorkspaceSettings>;
  // workspaceId -> already-aggregated team-time rows, for the Ticket 121
  // fake below — returned as-is regardless of the filter passed in (the
  // filter's actual effect is the RPC's own job, verified at the adapter
  // level in workspace.repository.test.ts; this fake only needs to prove
  // getTeamTime() delegates and requires auth).
  teamTimeRowsByWorkspace: Record<string, TeamTimeRow[]>;
  // projectId -> assigned member rows, for the Ticket 123 fakes below.
  projectMemberRowsByProject: Record<string, ProjectMemberRow[]>;
  calls: Array<{ method: string; args: unknown[] }>;
}

function memoryRepositories(overrides: Partial<MemoryState> = {}): {
  repos: Repositories;
  state: MemoryState;
} {
  const state: MemoryState = {
    userId: "user-1",
    profile: {
      email: "person@example.com",
      displayName: null,
      createdAt: "2025-01-02T03:04:05Z",
    },
    projects: [MANAGED_PROJECT],
    entries: [ENTRY],
    subscription: { status: "active", currentPeriodEnd: null },
    dailyGoal: null,
    personalWorkspaceId: "workspace-personal-1",
    memberships: { "workspace-personal-1": "owner" },
    workspaceDetails: { "workspace-personal-1": { name: "Persönlich", type: "PERSONAL" } },
    activeWorkspaceCookie: null,
    invitations: {},
    memberRowsByWorkspace: {},
    invitationRowsByWorkspace: {},
    // Ticket 118: getActiveWorkspaceTimeZone() now underlies every
    // day-boundary-sensitive use case (getTodayBreakdown/getTodayEntries/
    // getFullDataExport/...), so every test's default personal workspace
    // needs a settings row even when the test itself has nothing to do
    // with workspace settings — same "sane baseline for every fixture"
    // reasoning as personalWorkspaceId/memberships above.
    settingsByWorkspace: {
      "workspace-personal-1": { ...DEFAULT_SETTINGS, id: "workspace-personal-1" },
    },
    teamTimeRowsByWorkspace: {},
    projectMemberRowsByProject: {},
    calls: [],
    ...overrides,
  };
  const record = (method: string, ...args: unknown[]) => state.calls.push({ method, args });

  const repos: Repositories = {
    auth: {
      async getAuthenticatedUserId() { record("auth.userId"); return state.userId; },
      async register(email, password, redirectTo) { record("auth.register", email, password, redirectTo); return { emailConfirmationRequired: true }; },
      async login(email, password) { record("auth.login", email, password); },
      async signInWithGoogle(destinationPath) { record("auth.google", destinationPath); },
      async exchangeOAuthCode(code) { record("auth.oauthCallback", code); },
      async logout() { record("auth.logout"); },
      async requestPasswordReset(email) { record("auth.reset", email); },
      async updatePassword(password) { record("auth.updatePassword", password); },
      onAuthStateChange() { return () => undefined; },
      async deleteAccount() { record("auth.deleteAccount"); },
      async getProfile() { record("auth.profile"); return state.profile; },
      async updateDisplayName(name) { record("auth.displayName", name); },
      async changeEmail(email, password) { record("auth.changeEmail", email, password); },
      async changePassword(password, currentPassword) { record("auth.changePassword", password, currentPassword); },
    },
    projects: {
      async getAll() { record("projects.getAll"); return state.projects.slice(); },
      async create(input) {
        record("projects.create", input);
        return { ...MANAGED_PROJECT, ...input, customer: input.customer ?? "", notes: input.notes ?? "" };
      },
      async rename(id, name, notes) { record("projects.rename", id, name, notes); return { ...MANAGED_PROJECT, id, name, notes }; },
      async setArchived(id, archived) { record("projects.archive", id, archived); },
      async setRestricted(id, restricted) { record("projects.setRestricted", id, restricted); },
      async listProjectMembers(id) {
        record("projects.listProjectMembers", id);
        return state.projectMemberRowsByProject[id] ?? [];
      },
      async assignProjectMember(id, userId) {
        record("projects.assignProjectMember", id, userId);
        const rows = state.projectMemberRowsByProject[id] ?? (state.projectMemberRowsByProject[id] = []);
        if (!rows.some((row) => row.userId === userId)) {
          rows.push({ userId, email: `${userId}@example.test`, displayName: null, role: "member" });
        }
      },
      async unassignProjectMember(id, userId) {
        record("projects.unassignProjectMember", id, userId);
        const rows = state.projectMemberRowsByProject[id];
        if (rows) state.projectMemberRowsByProject[id] = rows.filter((row) => row.userId !== userId);
      },
    },
    timeEntries: {
      async getForDay(day) { record("entries.day", day); return state.entries.filter((entry) => entry.day === day); },
      async getForRange(from, to, projectId) {
        record("entries.range", from, to, projectId);
        return state.entries.filter((entry) => entry.day >= from && entry.day <= to && (!projectId || entry.projectId === projectId));
      },
      async getBreakdown(from, to, projectId) {
        record("entries.breakdown", from, to, projectId);
        return [];
      },
      async updateProject(id, projectId) { record("entries.assign", id, projectId); return { ...ENTRY, id, projectId }; },
    },
    subscription: {
      async getCurrent() { record("subscription.get"); return state.subscription; },
      async openBillingPortal() { record("subscription.portal"); return "https://billing.example"; },
    },
    language: {
      async get() { return "de"; },
      async set() {},
    },
    dailyGoal: {
      async get() { record("goal.get"); return state.dailyGoal; },
      async set(hours) { record("goal.set", hours); state.dailyGoal = hours; },
    },
    workspace: {
      async getMembership(userId, workspaceId) {
        record("workspace.getMembership", userId, workspaceId);
        const role = state.memberships[workspaceId];
        return role ? { workspaceId, role } : null;
      },
      async getPersonalWorkspaceId(userId) {
        record("workspace.personalId", userId);
        return state.personalWorkspaceId;
      },
      async listMemberships(userId) {
        record("workspace.listMemberships", userId);
        return Object.entries(state.memberships).map(([workspaceId, role]) => {
          const details = state.workspaceDetails[workspaceId] ?? { name: workspaceId, type: "ORGANIZATION" as const };
          return { workspaceId, workspaceName: details.name, workspaceType: details.type, role };
        });
      },
      async createOrganization(name) {
        record("workspace.createOrganization", name);
        return { id: "workspace-new-org-1", name, slug: "new-org-1", workspaceType: "ORGANIZATION" };
      },
      async createInvitation(workspaceId, email, role) {
        record("workspace.createInvitation", workspaceId, email, role);
        const token = `token-for-${email}`;
        state.invitations[token] = { email, workspaceId, workspaceName: "Invited Workspace", role, accepted: false };
        return { id: `invite-${email}`, token, email, role, expiresAt: "2026-12-31T00:00:00.000Z" };
      },
      async previewInvitation(token) {
        record("workspace.previewInvitation", token);
        const invitation = state.invitations[token];
        if (!invitation) throw new Error("This invitation link is invalid");
        return {
          email: invitation.email,
          workspaceName: invitation.workspaceName,
          role: invitation.role,
          isValid: !invitation.accepted,
        };
      },
      async acceptInvitation(token) {
        record("workspace.acceptInvitation", token);
        const invitation = state.invitations[token];
        if (!invitation) throw new Error("This invitation link is invalid");
        if (invitation.accepted) throw new Error("This invitation has already been accepted");
        invitation.accepted = true;
        return { workspaceId: invitation.workspaceId, workspaceName: invitation.workspaceName, role: invitation.role };
      },
      async listMembers(workspaceId) {
        record("workspace.listMembers", workspaceId);
        return state.memberRowsByWorkspace[workspaceId] ?? [];
      },
      async updateMemberRole(workspaceId, userId, role) {
        record("workspace.updateMemberRole", workspaceId, userId, role);
        const rows = state.memberRowsByWorkspace[workspaceId] ?? [];
        const row = rows.find((r) => r.userId === userId);
        if (!row) throw new Error("This user is not a member of this workspace");
        row.role = role;
        return { userId, role };
      },
      async removeMember(workspaceId, userId) {
        record("workspace.removeMember", workspaceId, userId);
        const rows = state.memberRowsByWorkspace[workspaceId] ?? [];
        const index = rows.findIndex((r) => r.userId === userId);
        if (index === -1) throw new Error("This user is not a member of this workspace");
        rows.splice(index, 1);
      },
      async leaveWorkspace(workspaceId) {
        record("workspace.leaveWorkspace", workspaceId);
        const role = state.memberships[workspaceId];
        if (!role) throw new Error("You are not a member of this workspace");
        if (role === "owner") {
          throw new Error("Cannot remove, demote or delete the last owner of a workspace — transfer ownership first");
        }
        delete state.memberships[workspaceId];
      },
      async transferOwnership(workspaceId, newOwnerUserId, currentPassword) {
        record("workspace.transferOwnership", workspaceId, newOwnerUserId, currentPassword);
        if (currentPassword !== "correct-password") throw new Error("Wrong password");
        state.memberships[workspaceId] = "admin";
      },
      async listInvitations(workspaceId) {
        record("workspace.listInvitations", workspaceId);
        return state.invitationRowsByWorkspace[workspaceId] ?? [];
      },
      async resendInvitation(invitationId) {
        record("workspace.resendInvitation", invitationId);
        for (const rows of Object.values(state.invitationRowsByWorkspace)) {
          const row = rows.find((r) => r.id === invitationId);
          if (row) {
            if (row.acceptedAt) throw new Error("This invitation has already been accepted");
            if (row.revokedAt) throw new Error("This invitation has been revoked");
            row.expiresAt = "2026-12-31T00:00:00.000Z";
            return { id: row.id, token: `resent-token-for-${row.id}`, email: row.email, role: row.role, expiresAt: row.expiresAt };
          }
        }
        throw new Error("This invitation does not exist");
      },
      async revokeInvitation(invitationId) {
        record("workspace.revokeInvitation", invitationId);
        for (const rows of Object.values(state.invitationRowsByWorkspace)) {
          const row = rows.find((r) => r.id === invitationId);
          if (row) {
            if (row.acceptedAt) throw new Error("This invitation has already been accepted");
            row.revokedAt = row.revokedAt ?? "2026-09-07T00:00:00.000Z";
            return;
          }
        }
        throw new Error("This invitation does not exist");
      },
      async updateInvitationRole(invitationId, role) {
        record("workspace.updateInvitationRole", invitationId, role);
        for (const rows of Object.values(state.invitationRowsByWorkspace)) {
          const row = rows.find((r) => r.id === invitationId);
          if (row) {
            if (row.acceptedAt) throw new Error("This invitation has already been accepted");
            if (row.revokedAt) throw new Error("This invitation has been revoked");
            row.role = role;
            return { id: row.id, role };
          }
        }
        throw new Error("This invitation does not exist");
      },
      async getSettings(workspaceId) {
        record("workspace.getSettings", workspaceId);
        const settings = state.settingsByWorkspace[workspaceId];
        if (!settings) throw new Error("This workspace does not exist");
        return settings;
      },
      async updateSettings(workspaceId, input) {
        record("workspace.updateSettings", workspaceId, input);
        const settings = state.settingsByWorkspace[workspaceId];
        if (!settings) throw new Error("This workspace does not exist");
        Object.assign(settings, input);
        return settings;
      },
      async uploadLogo(workspaceId, file) {
        record("workspace.uploadLogo", workspaceId, file);
        const settings = state.settingsByWorkspace[workspaceId];
        if (!settings) throw new Error("This workspace does not exist");
        const path = `${workspaceId}/logo`;
        settings.logoPath = path;
        return path;
      },
      async removeLogo(workspaceId) {
        record("workspace.removeLogo", workspaceId);
        const settings = state.settingsByWorkspace[workspaceId];
        if (!settings) throw new Error("This workspace does not exist");
        settings.logoPath = null;
      },
      async getLogoUrl(logoPath) {
        record("workspace.getLogoUrl", logoPath);
        return `https://signed.example.test/${logoPath}`;
      },
      async listTeamTime(workspaceId, fromDay, toDay, filter) {
        record("workspace.listTeamTime", workspaceId, fromDay, toDay, filter);
        return state.teamTimeRowsByWorkspace[workspaceId] ?? [];
      },
    },
    activeWorkspace: {
      async get() {
        record("activeWorkspace.get");
        return state.activeWorkspaceCookie;
      },
      async set(workspaceId) {
        record("activeWorkspace.set", workspaceId);
        state.activeWorkspaceCookie = workspaceId;
      },
    },
  };
  return { repos, state };
}

test("project use cases normalize mutations and hide system projects", async () => {
  const { repos, state } = memoryRepositories({ projects: [DEFAULT_PROJECT, MANAGED_PROJECT] });
  assert.deepEqual(await listProjects(repos), [MANAGED_PROJECT]);
  assert.equal((await createProject(repos, { name: "  New  ", colorHex: "4C8FBF" })).name, "New");
  assert.equal((await renameProject(repos, "project-1", "  Renamed ", "note")).name, "Renamed");
  await archiveProject(repos, "project-1", true);
  assert.deepEqual(state.calls.filter(({ method }) => method.startsWith("projects.")), [
    { method: "projects.getAll", args: [] },
    { method: "projects.create", args: [{ name: "New", colorHex: "4C8FBF" }] },
    { method: "projects.rename", args: ["project-1", "Renamed", "note"] },
    { method: "projects.archive", args: ["project-1", true] },
  ]);
});

test("project mutation validation rejects blank names before repository access", async () => {
  const { repos, state } = memoryRepositories();
  await assert.rejects(createProject(repos, { name: " \n ", colorHex: "B4592E" }), ValidationError);
  await assert.rejects(renameProject(repos, "project-1", "\t", "notes"), ValidationError);
  assert.equal(state.calls.length, 0);
});

// Ticket 123 — Projekt-Mitglieder.
test("setProjectRestricted delegates to the repository", async () => {
  const { repos, state } = memoryRepositories();
  await setProjectRestricted(repos, "project-1", true);
  assert.deepEqual(state.calls.at(-1), { method: "projects.setRestricted", args: ["project-1", true] });
});

test("assignProjectMember delegates to the repository and the assignment shows up in listProjectMembers", async () => {
  const { repos, state } = memoryRepositories();
  await assignProjectMember(repos, "project-1", "user-2");
  assert.deepEqual(state.calls.at(-1), { method: "projects.assignProjectMember", args: ["project-1", "user-2"] });
  const members = await listProjectMembers(repos, "project-1");
  assert.deepEqual(members, [{ userId: "user-2", email: "user-2@example.test", displayName: null, role: "member" }]);
});

test("unassignProjectMember delegates to the repository and removes the member from listProjectMembers", async () => {
  const memberRow: ProjectMemberRow = { userId: "user-2", email: "colleague@example.test", displayName: "Colleague", role: "member" };
  const { repos, state } = memoryRepositories({
    projectMemberRowsByProject: { "project-1": [memberRow] },
  });
  await unassignProjectMember(repos, "project-1", "user-2");
  assert.deepEqual(state.calls.at(-1), { method: "projects.unassignProjectMember", args: ["project-1", "user-2"] });
  assert.deepEqual(await listProjectMembers(repos, "project-1"), []);
});

test("listProjectMembers delegates to the repository", async () => {
  const memberRow: ProjectMemberRow = { userId: "user-2", email: "colleague@example.test", displayName: "Colleague", role: "admin" };
  const { repos } = memoryRepositories({
    projectMemberRowsByProject: { "project-1": [memberRow] },
  });
  assert.deepEqual(await listProjectMembers(repos, "project-1"), [memberRow]);
});

test("assignment trims the project id and rejects blank selections", async () => {
  const { repos, state } = memoryRepositories();
  assert.equal((await assignTimeEntryToProject(repos, "entry-1", " project-2 ")).projectId, "project-2");
  await assert.rejects(assignTimeEntryToProject(repos, "entry-1", "  "), ValidationError);
  assert.deepEqual(state.calls, [{ method: "entries.assign", args: ["entry-1", "project-2"] }]);
});

test("dashboard day use cases preserve repository data and provide an empty breakdown", async () => {
  const day = ENTRY.day;
  const { repos } = memoryRepositories();
  assert.deepEqual(await getEntriesForDay(repos, day), [ENTRY]);
  assert.deepEqual(await getBreakdownForDay(repos, day), {
    day,
    standardSeconds: 0,
    projectSeconds: 0,
    pauseSeconds: 0,
    totalSeconds: 0,
    unassignedSeconds: 0,
  } satisfies DailyBreakdown);
});

test("daily-goal use case persists normalized values", async () => {
  const { repos, state } = memoryRepositories();
  await setDailyGoalHours(repos, 80);
  await setDailyGoalHours(repos, Number.NaN);
  assert.deepEqual(state.calls, [
    { method: "goal.set", args: [24] },
    { method: "goal.set", args: [null] },
  ]);
});

test("auth use cases normalize identity fields but leave passwords opaque", async () => {
  const { repos, state } = memoryRepositories();
  assert.equal(await requireUser(repos), "user-1");
  await updateDisplayName(repos, "  Ada Lovelace  ");
  await updateDisplayName(repos, "   ");
  await changeEmail(repos, "  ada@example.com ", " current password ");
  await changePassword(repos, " new password ", " current password ");
  await updatePassword(repos, " recovery password ");
  await signInWithGoogle(repos, "/dashboard/history?from=2026-09-01");
  await signInWithGoogle(repos, "https://evil.example/phishing");
  await completeOAuthSignIn(repos, "one-time-code");
  // Ticket 102: register()'s redirectTo goes through the same
  // normalizeDashboardRedirect() gate as signInWithGoogle above — omitted
  // reproduces the pre-102 default, a legitimate workspace-invitation
  // target is passed through unchanged, and an out-of-scope value falls
  // back to /dashboard rather than reaching Supabase's outbound email.
  await register(repos, "new@example.com", "password123");
  await register(repos, "invited@example.com", "password123", "/invite/accept?token=abc123");
  await register(repos, "new@example.com", "password123", "https://evil.example/phishing");
  assert.deepEqual(state.calls, [
    { method: "auth.userId", args: [] },
    { method: "auth.displayName", args: ["Ada Lovelace"] },
    { method: "auth.displayName", args: [null] },
    { method: "auth.changeEmail", args: ["ada@example.com", " current password "] },
    { method: "auth.changePassword", args: [" new password ", " current password "] },
    { method: "auth.updatePassword", args: [" recovery password "] },
    { method: "auth.google", args: ["/dashboard/history?from=2026-09-01"] },
    { method: "auth.google", args: ["/dashboard"] },
    { method: "auth.oauthCallback", args: ["one-time-code"] },
    { method: "auth.register", args: ["new@example.com", "password123", "/dashboard/get-started"] },
    { method: "auth.register", args: ["invited@example.com", "password123", "/invite/accept?token=abc123"] },
    { method: "auth.register", args: ["new@example.com", "password123", "/dashboard"] },
  ]);
});

test("requireUser raises the typed unauthorized error for an anonymous session", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(requireUser(repos), UnauthorizedError);
});

// Ticket 099 — the non-negotiable server-side membership check: a client
// sending a workspaceId it doesn't actually belong to must never gain
// access, and must get a 403 (ForbiddenError), never a silent pass or a
// 404 (see the ticket's own reference to Ticket 063's error contract).
test("requireWorkspaceMembership returns the membership for a real member", async () => {
  const { repos } = memoryRepositories({ memberships: { "workspace-personal-1": "owner", "workspace-team-1": "member" } });
  assert.deepEqual(await requireWorkspaceMembership(repos, "user-1", "workspace-team-1"), {
    workspaceId: "workspace-team-1",
    role: "member",
  });
});

test("requireWorkspaceMembership rejects a workspace id the caller isn't a member of, with ForbiddenError (403), not a silent pass", async () => {
  const { repos } = memoryRepositories();
  await assert.rejects(
    requireWorkspaceMembership(repos, "user-1", "workspace-someone-elses"),
    ForbiddenError,
  );
});

test("requireWorkspaceMembership rejects a workspace id that doesn't exist at all identically to a foreign one (must not leak existence)", async () => {
  const { repos } = memoryRepositories();
  await assert.rejects(
    requireWorkspaceMembership(repos, "user-1", "workspace-does-not-exist"),
    ForbiddenError,
  );
});

test("resolveActiveWorkspaceId honors an explicitly requested workspace once membership is verified", async () => {
  const { repos } = memoryRepositories({ memberships: { "workspace-personal-1": "owner", "workspace-team-1": "member" } });
  assert.equal(await resolveActiveWorkspaceId(repos, "user-1", "workspace-team-1"), "workspace-team-1");
});

test("resolveActiveWorkspaceId falls back to the personal workspace when no workspace was requested (not-yet-workspace-aware caller)", async () => {
  const { repos } = memoryRepositories();
  assert.equal(await resolveActiveWorkspaceId(repos, "user-1", null), "workspace-personal-1");
  assert.equal(await resolveActiveWorkspaceId(repos, "user-1", undefined), "workspace-personal-1");
});

test("resolveActiveWorkspaceId falls back to the personal workspace instead of throwing when the requested workspace no longer resolves to a membership (e.g. it was deleted)", async () => {
  const { repos } = memoryRepositories();
  assert.equal(await resolveActiveWorkspaceId(repos, "user-1", "workspace-deleted"), "workspace-personal-1");
});

// Ticket 103 — the workspace switcher's own data + switch action.
test("getWorkspaceSwitcherData lists every membership and resolves the active one from the stored cookie", async () => {
  const { repos } = memoryRepositories({
    memberships: { "workspace-personal-1": "owner", "workspace-org-1": "member" },
    workspaceDetails: {
      "workspace-personal-1": { name: "Persönlich", type: "PERSONAL" },
      "workspace-org-1": { name: "PROMOS Consult", type: "ORGANIZATION" },
    },
    activeWorkspaceCookie: "workspace-org-1",
  });
  const data = await getWorkspaceSwitcherData(repos);
  assert.equal(data.activeWorkspaceId, "workspace-org-1");
  assert.deepEqual(data.workspaces, [
    { workspaceId: "workspace-personal-1", workspaceName: "Persönlich", workspaceType: "PERSONAL", role: "owner" },
    { workspaceId: "workspace-org-1", workspaceName: "PROMOS Consult", workspaceType: "ORGANIZATION", role: "member" },
  ]);
});

test("getWorkspaceSwitcherData resolves to the personal workspace when no cookie is stored yet (first-ever visit)", async () => {
  const { repos } = memoryRepositories();
  const data = await getWorkspaceSwitcherData(repos);
  assert.equal(data.activeWorkspaceId, "workspace-personal-1");
});

test("getWorkspaceSwitcherData falls back to the personal workspace instead of trusting a stale cookie (e.g. removed from that workspace since)", async () => {
  const { repos } = memoryRepositories({ activeWorkspaceCookie: "workspace-no-longer-a-member-of" });
  const data = await getWorkspaceSwitcherData(repos);
  assert.equal(data.activeWorkspaceId, "workspace-personal-1");
});

// Ticket 118 — every day-boundary-sensitive read resolves the active
// workspace's OWN configured timezone through this one function, same
// cookie+fallback resolution rule as getWorkspaceSwitcherData above.
test("getActiveWorkspaceTimeZone resolves the active (cookie-selected) workspace's own timezone", async () => {
  const { repos } = memoryRepositories({
    memberships: { "workspace-personal-1": "owner", "workspace-org-1": "member" },
    activeWorkspaceCookie: "workspace-org-1",
    settingsByWorkspace: {
      "workspace-org-1": { ...DEFAULT_SETTINGS, id: "workspace-org-1", timezone: "America/New_York" },
    },
  });
  assert.equal(await getActiveWorkspaceTimeZone(repos), "America/New_York");
});

test("getActiveWorkspaceTimeZone falls back to the personal workspace's timezone for a stale/foreign cookie", async () => {
  const { repos } = memoryRepositories({
    activeWorkspaceCookie: "workspace-no-longer-a-member-of",
    settingsByWorkspace: {
      "workspace-personal-1": { ...DEFAULT_SETTINGS, id: "workspace-personal-1", timezone: "Europe/Berlin" },
    },
  });
  assert.equal(await getActiveWorkspaceTimeZone(repos), "Europe/Berlin");
});

test("getActiveWorkspaceTimeZone requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(getActiveWorkspaceTimeZone(repos), UnauthorizedError);
});

// Ticket 122 — the caller's own role in the active (cookie-selected)
// workspace, same resolution rule as getActiveWorkspaceTimeZone above.
test("getActiveWorkspaceRole resolves the caller's role in the active workspace", async () => {
  const { repos } = memoryRepositories({
    memberships: { "workspace-personal-1": "owner", "workspace-org-1": "admin" },
    activeWorkspaceCookie: "workspace-org-1",
  });
  assert.equal(await getActiveWorkspaceRole(repos), "admin");
});

test("getActiveWorkspaceRole falls back to the personal workspace's role for a stale/foreign cookie", async () => {
  const { repos } = memoryRepositories({ activeWorkspaceCookie: "workspace-no-longer-a-member-of" });
  assert.equal(await getActiveWorkspaceRole(repos), "owner");
});

test("getActiveWorkspaceRole requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(getActiveWorkspaceRole(repos), UnauthorizedError);
});

test("getActiveWorkspaceId resolves the active (cookie-selected) workspace's own id", async () => {
  const { repos } = memoryRepositories({
    memberships: { "workspace-personal-1": "owner", "workspace-org-1": "member" },
    activeWorkspaceCookie: "workspace-org-1",
  });
  assert.equal(await getActiveWorkspaceId(repos), "workspace-org-1");
});

test("getActiveWorkspaceId falls back to the personal workspace for a stale/foreign cookie", async () => {
  const { repos } = memoryRepositories({ activeWorkspaceCookie: "workspace-no-longer-a-member-of" });
  assert.equal(await getActiveWorkspaceId(repos), "workspace-personal-1");
});

test("getActiveWorkspaceId requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(getActiveWorkspaceId(repos), UnauthorizedError);
});

test("switchActiveWorkspace persists the new workspace once membership is verified", async () => {
  const { repos, state } = memoryRepositories({
    memberships: { "workspace-personal-1": "owner", "workspace-org-1": "member" },
  });
  await switchActiveWorkspace(repos, "workspace-org-1");
  assert.equal(state.activeWorkspaceCookie, "workspace-org-1");
});

test("switchActiveWorkspace rejects a workspace the caller isn't a member of (never trusts a client-supplied id on its own) and does not persist it", async () => {
  const { repos, state } = memoryRepositories();
  await assert.rejects(
    switchActiveWorkspace(repos, "workspace-someone-elses"),
    ForbiddenError,
  );
  assert.equal(state.activeWorkspaceCookie, null);
});

test("switchActiveWorkspace requires an authenticated session", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(switchActiveWorkspace(repos, "workspace-personal-1"), UnauthorizedError);
});

// Ticket 100 — create_organization_workspace.
test("createOrganizationWorkspace trims the name and delegates to the repository", async () => {
  const { repos, state } = memoryRepositories();
  const workspace = await createOrganizationWorkspace(repos, "  PROMOS Consult  ");
  assert.deepEqual(workspace, { id: "workspace-new-org-1", name: "PROMOS Consult", slug: "new-org-1", workspaceType: "ORGANIZATION" });
  assert.deepEqual(state.calls.at(-1), { method: "workspace.createOrganization", args: ["PROMOS Consult"] });
});

test("createOrganizationWorkspace rejects an empty/whitespace-only name before ever reaching the repository", async () => {
  const { repos, state } = memoryRepositories();
  await assert.rejects(createOrganizationWorkspace(repos, "   "), ValidationError);
  assert.ok(!state.calls.some((call) => call.method === "workspace.createOrganization"));
});

test("createOrganizationWorkspace rejects an excessively long name before ever reaching the repository", async () => {
  const { repos, state } = memoryRepositories();
  await assert.rejects(createOrganizationWorkspace(repos, "a".repeat(101)), ValidationError);
  assert.ok(!state.calls.some((call) => call.method === "workspace.createOrganization"));
});

test("createOrganizationWorkspace requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(createOrganizationWorkspace(repos, "PROMOS Consult"), UnauthorizedError);
});

// Ticket 102 — invite/preview/accept workspace invitations.
test("inviteWorkspaceMember normalizes the email (trim + lowercase) and delegates to the repository", async () => {
  const { repos, state } = memoryRepositories();
  const invitation = await inviteWorkspaceMember(repos, "workspace-team-1", "  Colleague@Example.TEST  ", "member");
  assert.equal(invitation.email, "colleague@example.test");
  assert.deepEqual(state.calls.at(-1), {
    method: "workspace.createInvitation",
    args: ["workspace-team-1", "colleague@example.test", "member"],
  });
});

test("inviteWorkspaceMember rejects an empty email before ever reaching the repository", async () => {
  const { repos, state } = memoryRepositories();
  await assert.rejects(inviteWorkspaceMember(repos, "workspace-team-1", "   ", "member"), ValidationError);
  assert.ok(!state.calls.some((call) => call.method === "workspace.createInvitation"));
});

test("inviteWorkspaceMember rejects an obviously malformed email before ever reaching the repository", async () => {
  const { repos, state } = memoryRepositories();
  await assert.rejects(inviteWorkspaceMember(repos, "workspace-team-1", "not-an-email", "member"), ValidationError);
  assert.ok(!state.calls.some((call) => call.method === "workspace.createInvitation"));
});

test("inviteWorkspaceMember requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(inviteWorkspaceMember(repos, "workspace-team-1", "colleague@example.test", "member"), UnauthorizedError);
});

test("previewWorkspaceInvitation works without any authenticated session at all", async () => {
  // A single shared `repos`/`state` represents the backend both the
  // inviting admin and the (as-yet-unauthenticated) invitee talk to — it
  // is not meant to model "two different users' own repos instances",
  // just "the same shared invitations table two different calls see".
  const { repos, state } = memoryRepositories();
  const invitation = await inviteWorkspaceMember(repos, "workspace-team-1", "newperson@example.test", "admin");

  state.userId = null;
  const preview = await previewWorkspaceInvitation(repos, invitation.token);
  assert.equal(preview.email, "newperson@example.test");
  assert.equal(preview.role, "admin");
  assert.equal(preview.isValid, true);
});

test("acceptWorkspaceInvitation requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(acceptWorkspaceInvitation(repos, "some-token"), UnauthorizedError);
});

test("acceptWorkspaceInvitation delegates to the repository once authenticated", async () => {
  const { repos } = memoryRepositories();
  const invitation = await inviteWorkspaceMember(repos, "workspace-team-1", "acceptor@example.test", "member");

  const accepted = await acceptWorkspaceInvitation(repos, invitation.token);
  assert.equal(accepted.workspaceId, "workspace-team-1");
  assert.equal(accepted.role, "member");
});

// Ticket 110 — Workspace-Mitgliederübersicht.
test("listWorkspaceMembers requires authentication and delegates to the repository", async () => {
  const memberRow: WorkspaceMemberRow = {
    userId: "user-2",
    email: "colleague@example.test",
    displayName: "Colleague",
    role: "member",
    status: "active",
    since: "2026-09-01T00:00:00.000Z",
  };
  const { repos, state } = memoryRepositories({
    memberRowsByWorkspace: { "workspace-team-1": [memberRow] },
  });

  const members = await listWorkspaceMembers(repos, "workspace-team-1");

  assert.deepEqual(members, [memberRow]);
  assert.deepEqual(state.calls.at(-1), { method: "workspace.listMembers", args: ["workspace-team-1"] });
});

test("listWorkspaceMembers requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(listWorkspaceMembers(repos, "workspace-team-1"), UnauthorizedError);
});

test("updateWorkspaceMemberRole delegates to the repository for a valid role", async () => {
  const { repos, state } = memoryRepositories({
    memberRowsByWorkspace: {
      "workspace-team-1": [
        { userId: "user-2", email: "colleague@example.test", displayName: null, role: "member", status: "active", since: "2026-09-01T00:00:00.000Z" },
      ],
    },
  });

  const updated = await updateWorkspaceMemberRole(repos, "workspace-team-1", "user-2", "admin");

  assert.deepEqual(updated, { userId: "user-2", role: "admin" });
  assert.deepEqual(state.memberRowsByWorkspace["workspace-team-1"][0].role, "admin");
});

test("updateWorkspaceMemberRole rejects an invalid role before ever reaching the repository", async () => {
  const { repos, state } = memoryRepositories();
  await assert.rejects(
    // @ts-expect-error deliberately invalid at the boundary, same as the server-side RPC guards against it
    updateWorkspaceMemberRole(repos, "workspace-team-1", "user-2", "owner"),
    ValidationError,
  );
  assert.ok(!state.calls.some((call) => call.method === "workspace.updateMemberRole"));
});

test("updateWorkspaceMemberRole requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(updateWorkspaceMemberRole(repos, "workspace-team-1", "user-2", "admin"), UnauthorizedError);
});

test("removeWorkspaceMember delegates to the repository", async () => {
  const { repos, state } = memoryRepositories({
    memberRowsByWorkspace: {
      "workspace-team-1": [
        { userId: "user-2", email: "colleague@example.test", displayName: null, role: "member", status: "active", since: "2026-09-01T00:00:00.000Z" },
      ],
    },
  });

  await removeWorkspaceMember(repos, "workspace-team-1", "user-2");

  assert.deepEqual(state.memberRowsByWorkspace["workspace-team-1"], []);
  assert.deepEqual(state.calls.at(-1), { method: "workspace.removeMember", args: ["workspace-team-1", "user-2"] });
});

test("removeWorkspaceMember propagates a repository error (e.g. the RPC rejects removing an owner) instead of swallowing it", async () => {
  const { repos } = memoryRepositories({ memberRowsByWorkspace: { "workspace-team-1": [] } });
  await assert.rejects(removeWorkspaceMember(repos, "workspace-team-1", "user-2"), /not a member/);
});

test("removeWorkspaceMember requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(removeWorkspaceMember(repos, "workspace-team-1", "user-2"), UnauthorizedError);
});

test("leaveWorkspace delegates to the repository for a non-owner membership", async () => {
  const { repos, state } = memoryRepositories({
    memberships: { "workspace-personal-1": "owner", "workspace-team-1": "member" },
  });

  await leaveWorkspace(repos, "workspace-team-1");

  assert.equal(state.memberships["workspace-team-1"], undefined);
  assert.deepEqual(state.calls.at(-1), { method: "workspace.leaveWorkspace", args: ["workspace-team-1"] });
});

test("leaveWorkspace propagates a repository error when the caller is the sole owner", async () => {
  const { repos } = memoryRepositories();
  await assert.rejects(leaveWorkspace(repos, "workspace-personal-1"), /transfer ownership first/);
});

test("leaveWorkspace requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(leaveWorkspace(repos, "workspace-team-1"), UnauthorizedError);
});

test("transferWorkspaceOwnership delegates to the repository with the given password", async () => {
  const { repos, state } = memoryRepositories({ memberships: { "workspace-team-1": "owner" } });

  await transferWorkspaceOwnership(repos, "workspace-team-1", "user-2", "correct-password");

  assert.deepEqual(state.calls.at(-1), { method: "workspace.transferOwnership", args: ["workspace-team-1", "user-2", "correct-password"] });
});

test("transferWorkspaceOwnership propagates a repository error (e.g. wrong password) instead of swallowing it", async () => {
  const { repos } = memoryRepositories({ memberships: { "workspace-team-1": "owner" } });
  await assert.rejects(transferWorkspaceOwnership(repos, "workspace-team-1", "user-2", "wrong-password"), /Wrong password/);
});

test("transferWorkspaceOwnership requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(transferWorkspaceOwnership(repos, "workspace-team-1", "user-2", "correct-password"), UnauthorizedError);
});

// Ticket 115 — Einladungsverwaltung.
const OPEN_INVITATION: WorkspaceInvitationRow = {
  id: "invite-1",
  email: "pending@example.test",
  role: "member",
  sentAt: "2026-09-01T00:00:00.000Z",
  expiresAt: "2026-09-08T00:00:00.000Z",
  revokedAt: null,
  acceptedAt: null,
};

test("listWorkspaceInvitations requires authentication and delegates to the repository", async () => {
  const { repos, state } = memoryRepositories({
    invitationRowsByWorkspace: { "workspace-team-1": [OPEN_INVITATION] },
  });

  const invitations = await listWorkspaceInvitations(repos, "workspace-team-1");

  assert.deepEqual(invitations, [OPEN_INVITATION]);
  assert.deepEqual(state.calls.at(-1), { method: "workspace.listInvitations", args: ["workspace-team-1"] });
});

test("listWorkspaceInvitations requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(listWorkspaceInvitations(repos, "workspace-team-1"), UnauthorizedError);
});

test("resendWorkspaceInvitation delegates to the repository and returns a fresh token", async () => {
  const { repos, state } = memoryRepositories({
    invitationRowsByWorkspace: { "workspace-team-1": [{ ...OPEN_INVITATION }] },
  });

  const resent = await resendWorkspaceInvitation(repos, "invite-1");

  assert.equal(resent.id, "invite-1");
  assert.ok(resent.token);
  assert.deepEqual(state.calls.at(-1), { method: "workspace.resendInvitation", args: ["invite-1"] });
});

test("resendWorkspaceInvitation propagates a repository error (e.g. already revoked) instead of swallowing it", async () => {
  const { repos } = memoryRepositories({
    invitationRowsByWorkspace: { "workspace-team-1": [{ ...OPEN_INVITATION, revokedAt: "2026-09-02T00:00:00.000Z" }] },
  });
  await assert.rejects(resendWorkspaceInvitation(repos, "invite-1"), /has been revoked/);
});

test("resendWorkspaceInvitation requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(resendWorkspaceInvitation(repos, "invite-1"), UnauthorizedError);
});

test("revokeWorkspaceInvitation delegates to the repository", async () => {
  const { repos, state } = memoryRepositories({
    invitationRowsByWorkspace: { "workspace-team-1": [{ ...OPEN_INVITATION }] },
  });

  await revokeWorkspaceInvitation(repos, "invite-1");

  assert.ok(state.invitationRowsByWorkspace["workspace-team-1"][0].revokedAt);
  assert.deepEqual(state.calls.at(-1), { method: "workspace.revokeInvitation", args: ["invite-1"] });
});

test("revokeWorkspaceInvitation propagates a repository error (e.g. already accepted) instead of swallowing it", async () => {
  const { repos } = memoryRepositories({
    invitationRowsByWorkspace: { "workspace-team-1": [{ ...OPEN_INVITATION, acceptedAt: "2026-09-03T00:00:00.000Z" }] },
  });
  await assert.rejects(revokeWorkspaceInvitation(repos, "invite-1"), /already been accepted/);
});

test("revokeWorkspaceInvitation requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(revokeWorkspaceInvitation(repos, "invite-1"), UnauthorizedError);
});

test("updateWorkspaceInvitationRole delegates to the repository for a valid role", async () => {
  const { repos, state } = memoryRepositories({
    invitationRowsByWorkspace: { "workspace-team-1": [{ ...OPEN_INVITATION }] },
  });

  const updated = await updateWorkspaceInvitationRole(repos, "invite-1", "admin");

  assert.deepEqual(updated, { id: "invite-1", role: "admin" });
  assert.equal(state.invitationRowsByWorkspace["workspace-team-1"][0].role, "admin");
});

test("updateWorkspaceInvitationRole rejects an invalid role before ever reaching the repository", async () => {
  const { repos, state } = memoryRepositories({
    invitationRowsByWorkspace: { "workspace-team-1": [{ ...OPEN_INVITATION }] },
  });
  await assert.rejects(
    // @ts-expect-error deliberately invalid at the boundary, same as the server-side RPC guards against it
    updateWorkspaceInvitationRole(repos, "invite-1", "owner"),
    ValidationError,
  );
  assert.ok(!state.calls.some((call) => call.method === "workspace.updateInvitationRole"));
});

test("updateWorkspaceInvitationRole requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(updateWorkspaceInvitationRole(repos, "invite-1", "admin"), UnauthorizedError);
});

// Ticket 117 — Workspace-Einstellungen.
const DEFAULT_SETTINGS: WorkspaceSettings = {
  id: "workspace-team-1",
  name: "SettingsCo",
  timezone: "UTC",
  defaultLanguage: "de",
  weekStart: "monday",
  dateFormat: "DD.MM.YYYY",
  timeFormat: "24h",
  logoPath: null,
};

test("getWorkspaceSettings requires authentication and delegates to the repository", async () => {
  const { repos, state } = memoryRepositories({
    settingsByWorkspace: { "workspace-team-1": { ...DEFAULT_SETTINGS } },
  });

  const settings = await getWorkspaceSettings(repos, "workspace-team-1");

  assert.deepEqual(settings, DEFAULT_SETTINGS);
  assert.deepEqual(state.calls.at(-1), { method: "workspace.getSettings", args: ["workspace-team-1"] });
});

test("getWorkspaceSettings requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(getWorkspaceSettings(repos, "workspace-team-1"), UnauthorizedError);
});

test("updateWorkspaceSettings trims the name and delegates to the repository", async () => {
  const { repos, state } = memoryRepositories({
    settingsByWorkspace: { "workspace-team-1": { ...DEFAULT_SETTINGS } },
  });

  const updated = await updateWorkspaceSettings(repos, "workspace-team-1", {
    name: "  Renamed Co  ",
    timezone: "Europe/Berlin",
    defaultLanguage: "en",
    weekStart: "sunday",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h",
  });

  assert.equal(updated.name, "Renamed Co");
  assert.equal(state.settingsByWorkspace["workspace-team-1"].timezone, "Europe/Berlin");
});

test("updateWorkspaceSettings rejects a blank name before ever reaching the repository", async () => {
  const { repos, state } = memoryRepositories({
    settingsByWorkspace: { "workspace-team-1": { ...DEFAULT_SETTINGS } },
  });
  await assert.rejects(
    updateWorkspaceSettings(repos, "workspace-team-1", { name: "   ", timezone: "UTC", defaultLanguage: "de", weekStart: "monday", dateFormat: "DD.MM.YYYY", timeFormat: "24h" }),
    ValidationError,
  );
  assert.ok(!state.calls.some((call) => call.method === "workspace.updateSettings"));
});

test("updateWorkspaceSettings requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(
    updateWorkspaceSettings(repos, "workspace-team-1", { name: "x", timezone: "UTC", defaultLanguage: "de", weekStart: "monday", dateFormat: "DD.MM.YYYY", timeFormat: "24h" }),
    UnauthorizedError,
  );
});

function fakeImageFile(sizeBytes: number, type: string): File {
  return new File([new Uint8Array(sizeBytes)], "logo.png", { type });
}

test("uploadWorkspaceLogo delegates to the repository for a valid image", async () => {
  const { repos, state } = memoryRepositories({
    settingsByWorkspace: { "workspace-team-1": { ...DEFAULT_SETTINGS } },
  });

  const path = await uploadWorkspaceLogo(repos, "workspace-team-1", fakeImageFile(1024, "image/png"));

  assert.equal(path, "workspace-team-1/logo");
  assert.equal(state.settingsByWorkspace["workspace-team-1"].logoPath, "workspace-team-1/logo");
});

test("uploadWorkspaceLogo rejects an unsupported file type before ever reaching the repository", async () => {
  const { repos, state } = memoryRepositories({
    settingsByWorkspace: { "workspace-team-1": { ...DEFAULT_SETTINGS } },
  });
  await assert.rejects(uploadWorkspaceLogo(repos, "workspace-team-1", fakeImageFile(1024, "image/svg+xml")), ValidationError);
  assert.ok(!state.calls.some((call) => call.method === "workspace.uploadLogo"));
});

test("uploadWorkspaceLogo rejects a file over 2 MB before ever reaching the repository", async () => {
  const { repos, state } = memoryRepositories({
    settingsByWorkspace: { "workspace-team-1": { ...DEFAULT_SETTINGS } },
  });
  await assert.rejects(uploadWorkspaceLogo(repos, "workspace-team-1", fakeImageFile(3 * 1024 * 1024, "image/png")), ValidationError);
  assert.ok(!state.calls.some((call) => call.method === "workspace.uploadLogo"));
});

test("uploadWorkspaceLogo requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(uploadWorkspaceLogo(repos, "workspace-team-1", fakeImageFile(1024, "image/png")), UnauthorizedError);
});

test("removeWorkspaceLogo delegates to the repository", async () => {
  const { repos, state } = memoryRepositories({
    settingsByWorkspace: { "workspace-team-1": { ...DEFAULT_SETTINGS, logoPath: "workspace-team-1/logo" } },
  });

  await removeWorkspaceLogo(repos, "workspace-team-1");

  assert.equal(state.settingsByWorkspace["workspace-team-1"].logoPath, null);
});

test("removeWorkspaceLogo requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(removeWorkspaceLogo(repos, "workspace-team-1"), UnauthorizedError);
});

test("getWorkspaceLogoUrl requires authentication and delegates to the repository", async () => {
  const { repos, state } = memoryRepositories();
  const url = await getWorkspaceLogoUrl(repos, "workspace-team-1/logo");
  assert.equal(url, "https://signed.example.test/workspace-team-1/logo");
  assert.deepEqual(state.calls.at(-1), { method: "workspace.getLogoUrl", args: ["workspace-team-1/logo"] });
});

test("getWorkspaceLogoUrl requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(getWorkspaceLogoUrl(repos, "workspace-team-1/logo"), UnauthorizedError);
});

// Ticket 121 — Team-Zeiten für Admins.
const TEAM_TIME_ROW: TeamTimeRow = {
  userId: "user-2",
  email: "colleague@example.test",
  displayName: "Colleague",
  day: "2026-01-01",
  totalSeconds: 7200,
};

test("getTeamTime requires authentication and delegates to the repository with the filter object", async () => {
  const { repos, state } = memoryRepositories({
    teamTimeRowsByWorkspace: { "workspace-team-1": [TEAM_TIME_ROW] },
  });

  const rows = await getTeamTime(repos, "workspace-team-1", "2026-01-01", "2026-01-02", { userId: "user-2" });

  assert.deepEqual(rows, [TEAM_TIME_ROW]);
  assert.deepEqual(state.calls.at(-1), {
    method: "workspace.listTeamTime",
    args: ["workspace-team-1", "2026-01-01", "2026-01-02", { userId: "user-2" }],
  });
});

test("getTeamTime works without an explicit filter", async () => {
  const { repos } = memoryRepositories({
    teamTimeRowsByWorkspace: { "workspace-team-1": [TEAM_TIME_ROW] },
  });
  assert.deepEqual(await getTeamTime(repos, "workspace-team-1", "2026-01-01", "2026-01-02"), [TEAM_TIME_ROW]);
});

test("getTeamTime propagates a repository error (e.g. caller isn't an owner/admin) instead of swallowing it", async () => {
  const { repos } = memoryRepositories();
  // No fixture registered for "workspace-other-1" — the fake still
  // returns an empty array (see its own comment: real filtering/
  // authorization is the RPC's job, verified at the adapter level), so
  // this test only proves requireUser() gates the call — the RPC-error
  // propagation itself is proven in workspace.repository.test.ts.
  await assert.rejects(getTeamTime({ ...repos, workspace: { ...repos.workspace, listTeamTime: async () => { throw new Error("Only workspace owners/admins may view team time"); } } }, "workspace-team-1", "2026-01-01", "2026-01-02"), /owners\/admins may view team time/);
});

test("getTeamTime requires an authenticated user", async () => {
  const { repos } = memoryRepositories({ userId: null });
  await assert.rejects(getTeamTime(repos, "workspace-team-1", "2026-01-01", "2026-01-02"), UnauthorizedError);
});

test("full data export includes all personal records once and excludes system projects", async () => {
  const { repos, state } = memoryRepositories({ projects: [DEFAULT_PROJECT, MANAGED_PROJECT] });
  const before = Date.now();
  const result = await getFullDataExport(repos);
  const after = Date.now();
  assert.deepEqual(result.profile, state.profile);
  assert.deepEqual(result.projects, [MANAGED_PROJECT]);
  assert.deepEqual(result.timeEntries, [ENTRY]);
  assert.deepEqual(result.subscription, state.subscription);
  assert.ok(Date.parse(result.exportedAt) >= before && Date.parse(result.exportedAt) <= after);
  const range = state.calls.find(({ method }) => method === "entries.range");
  assert.equal(range?.args[0], "2025-01-02");
  assert.match(String(range?.args[1]), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(state.calls.filter(({ method }) => method === "auth.profile").length, 1);
  assert.equal(state.calls.filter(({ method }) => method === "projects.getAll").length, 1);
  assert.equal(state.calls.filter(({ method }) => method === "entries.range").length, 1);
  assert.equal(state.calls.filter(({ method }) => method === "subscription.get").length, 1);
});
