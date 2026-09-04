import assert from "node:assert/strict";
import test from "node:test";
import {
  changeEmail,
  changePassword,
  completeOAuthSignIn,
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
  createProject,
  listProjects,
  renameProject,
} from "./projects.ts";
import { requireWorkspaceMembership, resolveActiveWorkspaceId } from "./workspace.ts";
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
    calls: [],
    ...overrides,
  };
  const record = (method: string, ...args: unknown[]) => state.calls.push({ method, args });

  const repos: Repositories = {
    auth: {
      async getAuthenticatedUserId() { record("auth.userId"); return state.userId; },
      async register(email, password) { record("auth.register", email, password); return { emailConfirmationRequired: true }; },
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
