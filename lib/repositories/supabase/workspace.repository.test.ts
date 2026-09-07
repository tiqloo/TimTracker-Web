// Ticket 099 — server-side workspace-membership checks. Same fake
// query-builder-chain convention as repository-contract.test.ts (own,
// smaller fake here since this port's query shape — select/eq/eq/limit/
// maybeSingle — differs from that file's range()-based ones).
import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseWorkspaceRepository } from "./workspace.repository.ts";
import { ReauthenticationFailedError } from "../auth.repository.ts";

type QueryResult = { data: unknown; error: unknown };
type QueryCall = { method: string; args: unknown[] };

function queryClient(result: QueryResult): { client: SupabaseClient; calls: QueryCall[] } {
  const calls: QueryCall[] = [];
  const record = (method: string, ...args: unknown[]) => {
    calls.push({ method, args });
    return query;
  };
  const query = {
    select: (...args: unknown[]) => record("select", ...args),
    eq: (...args: unknown[]) => record("eq", ...args),
    limit: (...args: unknown[]) => record("limit", ...args),
    maybeSingle: async () => {
      calls.push({ method: "maybeSingle", args: [] });
      return result;
    },
  };
  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return query;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

function methodCalls(calls: QueryCall[], method: string): unknown[][] {
  return calls.filter((call) => call.method === method).map((call) => call.args);
}

test("getMembership returns the membership row when one exists", async () => {
  const { client, calls } = queryClient({ data: { workspace_id: "ws-1", role: "admin" }, error: null });
  const membership = await createSupabaseWorkspaceRepository(client).getMembership("user-1", "ws-1");
  assert.deepEqual(membership, { workspaceId: "ws-1", role: "admin" });
  assert.deepEqual(methodCalls(calls, "from"), [["workspace_memberships"]]);
  assert.deepEqual(methodCalls(calls, "eq"), [["user_id", "user-1"], ["workspace_id", "ws-1"]]);
});

test("getMembership returns null (never throws) when no membership row exists — the same result for a foreign workspace and a nonexistent one", async () => {
  const { client } = queryClient({ data: null, error: null });
  const membership = await createSupabaseWorkspaceRepository(client).getMembership("user-1", "ws-not-mine");
  assert.equal(membership, null);
});

test("getMembership propagates a real query error instead of treating it as null", async () => {
  const { client } = queryClient({ data: null, error: new Error("connection reset") });
  await assert.rejects(createSupabaseWorkspaceRepository(client).getMembership("user-1", "ws-1"), /connection reset/);
});

test("getPersonalWorkspaceId filters on workspace_type = PERSONAL and returns its id", async () => {
  const { client, calls } = queryClient({ data: { workspace_id: "ws-personal-1" }, error: null });
  const id = await createSupabaseWorkspaceRepository(client).getPersonalWorkspaceId("user-1");
  assert.equal(id, "ws-personal-1");
  assert.deepEqual(methodCalls(calls, "eq"), [["user_id", "user-1"], ["workspaces.workspace_type", "PERSONAL"]]);
  assert.deepEqual(methodCalls(calls, "limit"), [[1]]);
});

test("getPersonalWorkspaceId throws rather than silently returning an unusable value when Ticket 097's guarantee somehow doesn't hold", async () => {
  const { client } = queryClient({ data: null, error: null });
  await assert.rejects(createSupabaseWorkspaceRepository(client).getPersonalWorkspaceId("user-1"), /No personal workspace found/);
});

// Ticket 103 — listMemberships awaits the query builder chain directly
// (no .maybeSingle()/.single(), it's a multi-row select), which real
// supabase-js resolves via the builder itself being thenable — queryClient
// above only supports the .maybeSingle()-terminated shape, hence this own
// smaller fake (same "own, smaller fake" precedent this file's top comment
// already establishes for a differently-shaped query).
function listMembershipsClient(result: QueryResult): { client: SupabaseClient; calls: QueryCall[] } {
  const calls: QueryCall[] = [];
  const record = (method: string, ...args: unknown[]) => {
    calls.push({ method, args });
    return query;
  };
  const query = {
    select: (...args: unknown[]) => record("select", ...args),
    eq: (...args: unknown[]) => record("eq", ...args),
    then: (resolve: (value: QueryResult) => void) => resolve(result),
  };
  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return query;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

test("listMemberships maps every membership row and sorts the personal workspace first", async () => {
  const { client, calls } = listMembershipsClient({
    data: [
      { workspace_id: "ws-org", role: "member", workspaces: { name: "PROMOS Consult", workspace_type: "ORGANIZATION" } },
      { workspace_id: "ws-personal", role: "owner", workspaces: { name: "Persönlich", workspace_type: "PERSONAL" } },
    ],
    error: null,
  });
  const memberships = await createSupabaseWorkspaceRepository(client).listMemberships("user-1");
  assert.deepEqual(memberships, [
    { workspaceId: "ws-personal", workspaceName: "Persönlich", workspaceType: "PERSONAL", role: "owner" },
    { workspaceId: "ws-org", workspaceName: "PROMOS Consult", workspaceType: "ORGANIZATION", role: "member" },
  ]);
  assert.deepEqual(methodCalls(calls, "eq"), [["user_id", "user-1"]]);
});

test("listMemberships returns an empty array (never throws) for a user somehow found with no memberships", async () => {
  const { client } = listMembershipsClient({ data: null, error: null });
  const memberships = await createSupabaseWorkspaceRepository(client).listMemberships("user-1");
  assert.deepEqual(memberships, []);
});

test("listMemberships propagates a real query error instead of swallowing it", async () => {
  const { client } = listMembershipsClient({ data: null, error: new Error("connection reset") });
  await assert.rejects(createSupabaseWorkspaceRepository(client).listMemberships("user-1"), /connection reset/);
});

// Ticket 100 — createOrganization calls the create_organization_workspace
// RPC (a SECURITY DEFINER Postgres function, TimTracker-Starter repo),
// never a raw table insert.
function rpcClient(result: { data: unknown; error: unknown }): { client: SupabaseClient; calls: { fn: string; args: unknown }[] } {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return Promise.resolve(result);
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

test("createOrganization calls create_organization_workspace with the given name and maps the returned row", async () => {
  const { client, calls } = rpcClient({
    data: [{ id: "ws-1", name: "PROMOS Consult", slug: "promos-consult", workspace_type: "ORGANIZATION" }],
    error: null,
  });
  const workspace = await createSupabaseWorkspaceRepository(client).createOrganization("PROMOS Consult");
  assert.deepEqual(workspace, { id: "ws-1", name: "PROMOS Consult", slug: "promos-consult", workspaceType: "ORGANIZATION" });
  assert.deepEqual(calls, [{ fn: "create_organization_workspace", args: { workspace_name: "PROMOS Consult" } }]);
});

test("createOrganization propagates an RPC error (e.g. the server-side name validation failing) instead of swallowing it", async () => {
  const { client } = rpcClient({ data: null, error: new Error("Workspace name must not be empty") });
  await assert.rejects(createSupabaseWorkspaceRepository(client).createOrganization(""), /must not be empty/);
});

test("createOrganization throws rather than returning an unusable value if the RPC unexpectedly returns no row", async () => {
  const { client } = rpcClient({ data: [], error: null });
  await assert.rejects(createSupabaseWorkspaceRepository(client).createOrganization("x"), /no row/);
});

// Ticket 102 — the three invitation RPCs, same "SECURITY DEFINER RPC, not
// a raw table read/write" shape as createOrganization above.
test("createInvitation calls create_workspace_invitation and maps the returned row, including the one-time plaintext token", async () => {
  const { client, calls } = rpcClient({
    data: [{ id: "invite-1", token: "a".repeat(64), email: "colleague@example.test", role: "member", expires_at: "2026-09-14T00:00:00.000Z" }],
    error: null,
  });
  const invitation = await createSupabaseWorkspaceRepository(client).createInvitation("ws-1", "colleague@example.test", "member");
  assert.deepEqual(invitation, {
    id: "invite-1",
    token: "a".repeat(64),
    email: "colleague@example.test",
    role: "member",
    expiresAt: "2026-09-14T00:00:00.000Z",
  });
  assert.deepEqual(calls, [
    { fn: "create_workspace_invitation", args: { target_workspace_id: "ws-1", invitee_email: "colleague@example.test", invitee_role: "member" } },
  ]);
});

test("createInvitation propagates an RPC error (e.g. caller isn't an owner/admin) instead of swallowing it", async () => {
  const { client } = rpcClient({ data: null, error: new Error("Only a workspace owner or admin can invite members") });
  await assert.rejects(createSupabaseWorkspaceRepository(client).createInvitation("ws-1", "x@example.test", "member"), /owner or admin/);
});

test("previewInvitation calls preview_workspace_invitation and maps the returned row", async () => {
  const { client, calls } = rpcClient({
    data: [{ email: "colleague@example.test", workspace_name: "PROMOS Consult", role: "admin", is_valid: true }],
    error: null,
  });
  const preview = await createSupabaseWorkspaceRepository(client).previewInvitation("some-token");
  assert.deepEqual(preview, { email: "colleague@example.test", workspaceName: "PROMOS Consult", role: "admin", isValid: true });
  assert.deepEqual(calls, [{ fn: "preview_workspace_invitation", args: { invitation_token: "some-token" } }]);
});

test("previewInvitation propagates an RPC error (e.g. an invalid/made-up token) instead of swallowing it", async () => {
  const { client } = rpcClient({ data: null, error: new Error("This invitation link is invalid") });
  await assert.rejects(createSupabaseWorkspaceRepository(client).previewInvitation("bogus"), /invalid/);
});

test("acceptInvitation calls accept_workspace_invitation and maps the returned row", async () => {
  const { client, calls } = rpcClient({
    data: [{ workspace_id: "ws-1", workspace_name: "PROMOS Consult", role: "member" }],
    error: null,
  });
  const accepted = await createSupabaseWorkspaceRepository(client).acceptInvitation("some-token");
  assert.deepEqual(accepted, { workspaceId: "ws-1", workspaceName: "PROMOS Consult", role: "member" });
  assert.deepEqual(calls, [{ fn: "accept_workspace_invitation", args: { invitation_token: "some-token" } }]);
});

test("acceptInvitation propagates an RPC error (e.g. already accepted) instead of swallowing it", async () => {
  const { client } = rpcClient({ data: null, error: new Error("This invitation has already been accepted") });
  await assert.rejects(createSupabaseWorkspaceRepository(client).acceptInvitation("some-token"), /already been accepted/);
});

test("listMembers calls list_workspace_members and maps every row, including a pending invitation with no user_id", async () => {
  const { client, calls } = rpcClient({
    data: [
      { user_id: "user-1", email: "owner@example.test", display_name: "Owner Person", role: "owner", status: "active", since: "2026-09-01T00:00:00.000Z" },
      { user_id: null, email: "pending@example.test", display_name: null, role: "member", status: "invited", since: "2026-09-05T00:00:00.000Z" },
    ],
    error: null,
  });
  const members = await createSupabaseWorkspaceRepository(client).listMembers("ws-1");
  assert.deepEqual(members, [
    { userId: "user-1", email: "owner@example.test", displayName: "Owner Person", role: "owner", status: "active", since: "2026-09-01T00:00:00.000Z" },
    { userId: null, email: "pending@example.test", displayName: null, role: "member", status: "invited", since: "2026-09-05T00:00:00.000Z" },
  ]);
  assert.deepEqual(calls, [{ fn: "list_workspace_members", args: { target_workspace_id: "ws-1" } }]);
});

test("listMembers propagates an RPC error (e.g. caller isn't an owner/admin) instead of swallowing it", async () => {
  const { client } = rpcClient({ data: null, error: new Error("Only workspace owners/admins may view the member list") });
  await assert.rejects(createSupabaseWorkspaceRepository(client).listMembers("ws-1"), /owners\/admins may view/);
});

test("updateMemberRole calls update_workspace_member_role and maps the returned row", async () => {
  const { client, calls } = rpcClient({ data: [{ user_id: "user-2", role: "admin" }], error: null });
  const updated = await createSupabaseWorkspaceRepository(client).updateMemberRole("ws-1", "user-2", "admin");
  assert.deepEqual(updated, { userId: "user-2", role: "admin" });
  assert.deepEqual(calls, [{ fn: "update_workspace_member_role", args: { target_workspace_id: "ws-1", target_user_id: "user-2", new_role: "admin" } }]);
});

test("updateMemberRole propagates an RPC error (e.g. target isn't a member) instead of swallowing it", async () => {
  const { client } = rpcClient({ data: null, error: new Error("This user is not a member of this workspace") });
  await assert.rejects(createSupabaseWorkspaceRepository(client).updateMemberRole("ws-1", "user-2", "admin"), /not a member/);
});

test("removeMember calls remove_workspace_member with the workspace and target user", async () => {
  const { client, calls } = rpcClient({ data: null, error: null });
  await createSupabaseWorkspaceRepository(client).removeMember("ws-1", "user-2");
  assert.deepEqual(calls, [{ fn: "remove_workspace_member", args: { target_workspace_id: "ws-1", target_user_id: "user-2" } }]);
});

test("removeMember propagates an RPC error (e.g. target is the owner) instead of swallowing it", async () => {
  const { client } = rpcClient({ data: null, error: new Error("An owner cannot be removed this way — transfer ownership first") });
  await assert.rejects(createSupabaseWorkspaceRepository(client).removeMember("ws-1", "user-2"), /cannot be removed/);
});

test("leaveWorkspace calls leave_workspace with the workspace id", async () => {
  const { client, calls } = rpcClient({ data: null, error: null });
  await createSupabaseWorkspaceRepository(client).leaveWorkspace("ws-1");
  assert.deepEqual(calls, [{ fn: "leave_workspace", args: { target_workspace_id: "ws-1" } }]);
});

test("leaveWorkspace propagates an RPC error (e.g. caller is the sole owner) instead of swallowing it", async () => {
  const { client } = rpcClient({ data: null, error: new Error("Cannot remove, demote or delete the last owner of a workspace — transfer ownership first") });
  await assert.rejects(createSupabaseWorkspaceRepository(client).leaveWorkspace("ws-1"), /transfer ownership first/);
});

// Ticket 113 — transferOwnership re-authenticates (client.auth.getUser() +
// signInWithPassword()) BEFORE ever calling the RPC, same pattern as
// AuthRepository#changeEmail/changePassword — needs its own fake, the
// shared rpcClient() above has no `.auth` at all.
function transferOwnershipClient(options: {
  currentEmail?: string | null;
  reauthSucceeds?: boolean;
  rpcResult?: { data: unknown; error: unknown };
}): { client: SupabaseClient; rpcCalls: { fn: string; args: unknown }[]; signInCalls: unknown[] } {
  const rpcCalls: { fn: string; args: unknown }[] = [];
  const signInCalls: unknown[] = [];
  const currentEmail = options.currentEmail === undefined ? "owner@example.test" : options.currentEmail;
  const reauthSucceeds = options.reauthSucceeds ?? true;
  const rpcResult = options.rpcResult ?? { data: null, error: null };
  const client = {
    auth: {
      getUser: async () => ({ data: { user: currentEmail === null ? { email: null } : { email: currentEmail } }, error: null }),
      signInWithPassword: async (args: unknown) => {
        signInCalls.push(args);
        return reauthSucceeds ? { data: {}, error: null } : { data: null, error: new Error("Invalid login credentials") };
      },
    },
    rpc: (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpcResult);
    },
  } as unknown as SupabaseClient;
  return { client, rpcCalls, signInCalls };
}

test("transferOwnership re-authenticates against the session's own email, then calls the RPC", async () => {
  const { client, rpcCalls, signInCalls } = transferOwnershipClient({ currentEmail: "owner@example.test" });
  await createSupabaseWorkspaceRepository(client).transferOwnership("ws-1", "user-2", "correct-password");
  assert.deepEqual(signInCalls, [{ email: "owner@example.test", password: "correct-password" }]);
  assert.deepEqual(rpcCalls, [{ fn: "transfer_workspace_ownership", args: { target_workspace_id: "ws-1", new_owner_user_id: "user-2" } }]);
});

test("transferOwnership throws ReauthenticationFailedError on a wrong password, without ever calling the RPC", async () => {
  const { client, rpcCalls } = transferOwnershipClient({ reauthSucceeds: false });
  await assert.rejects(
    createSupabaseWorkspaceRepository(client).transferOwnership("ws-1", "user-2", "wrong-password"),
    ReauthenticationFailedError,
  );
  assert.deepEqual(rpcCalls, [], "the RPC must never be reached if re-authentication failed");
});

test("transferOwnership propagates an RPC error (e.g. target is not an admin) instead of swallowing it", async () => {
  const { client } = transferOwnershipClient({
    rpcResult: { data: null, error: new Error("Ownership can only be transferred to an existing admin of this workspace") },
  });
  await assert.rejects(
    createSupabaseWorkspaceRepository(client).transferOwnership("ws-1", "user-2", "correct-password"),
    /existing admin/,
  );
});

// Ticket 115 — the four invitation-management RPCs, same "SECURITY
// DEFINER RPC, not a raw table read/write" shape as listMembers etc. above.
test("listInvitations calls list_workspace_invitations and maps every row, including a still-open invitation", async () => {
  const { client, calls } = rpcClient({
    data: [
      { id: "invite-1", email: "pending@example.test", role: "member", sent_at: "2026-09-01T00:00:00.000Z", expires_at: "2026-09-08T00:00:00.000Z", revoked_at: null, accepted_at: null },
      { id: "invite-2", email: "revoked@example.test", role: "admin", sent_at: "2026-09-02T00:00:00.000Z", expires_at: "2026-09-09T00:00:00.000Z", revoked_at: "2026-09-03T00:00:00.000Z", accepted_at: null },
    ],
    error: null,
  });
  const invitations = await createSupabaseWorkspaceRepository(client).listInvitations("ws-1");
  assert.deepEqual(invitations, [
    { id: "invite-1", email: "pending@example.test", role: "member", sentAt: "2026-09-01T00:00:00.000Z", expiresAt: "2026-09-08T00:00:00.000Z", revokedAt: null, acceptedAt: null },
    { id: "invite-2", email: "revoked@example.test", role: "admin", sentAt: "2026-09-02T00:00:00.000Z", expiresAt: "2026-09-09T00:00:00.000Z", revokedAt: "2026-09-03T00:00:00.000Z", acceptedAt: null },
  ]);
  assert.deepEqual(calls, [{ fn: "list_workspace_invitations", args: { target_workspace_id: "ws-1" } }]);
});

test("listInvitations propagates an RPC error (e.g. caller isn't an owner/admin) instead of swallowing it", async () => {
  const { client } = rpcClient({ data: null, error: new Error("Only workspace owners/admins may view invitations") });
  await assert.rejects(createSupabaseWorkspaceRepository(client).listInvitations("ws-1"), /may view invitations/);
});

test("resendInvitation calls resend_workspace_invitation and maps the returned row, including the fresh plaintext token", async () => {
  const { client, calls } = rpcClient({
    data: [{ id: "invite-1", token: "b".repeat(64), email: "pending@example.test", role: "member", expires_at: "2026-09-15T00:00:00.000Z" }],
    error: null,
  });
  const resent = await createSupabaseWorkspaceRepository(client).resendInvitation("invite-1");
  assert.deepEqual(resent, { id: "invite-1", token: "b".repeat(64), email: "pending@example.test", role: "member", expiresAt: "2026-09-15T00:00:00.000Z" });
  assert.deepEqual(calls, [{ fn: "resend_workspace_invitation", args: { target_invitation_id: "invite-1" } }]);
});

test("resendInvitation propagates an RPC error (e.g. already revoked) instead of swallowing it", async () => {
  const { client } = rpcClient({ data: null, error: new Error("This invitation has been revoked") });
  await assert.rejects(createSupabaseWorkspaceRepository(client).resendInvitation("invite-1"), /has been revoked/);
});

test("resendInvitation throws rather than returning an unusable value if the RPC unexpectedly returns no row", async () => {
  const { client } = rpcClient({ data: [], error: null });
  await assert.rejects(createSupabaseWorkspaceRepository(client).resendInvitation("invite-1"), /no row/);
});

test("revokeInvitation calls revoke_workspace_invitation with the invitation id", async () => {
  const { client, calls } = rpcClient({ data: null, error: null });
  await createSupabaseWorkspaceRepository(client).revokeInvitation("invite-1");
  assert.deepEqual(calls, [{ fn: "revoke_workspace_invitation", args: { target_invitation_id: "invite-1" } }]);
});

test("revokeInvitation propagates an RPC error (e.g. already accepted) instead of swallowing it", async () => {
  const { client } = rpcClient({ data: null, error: new Error("This invitation has already been accepted") });
  await assert.rejects(createSupabaseWorkspaceRepository(client).revokeInvitation("invite-1"), /already been accepted/);
});

test("updateInvitationRole calls update_workspace_invitation_role and maps the returned row", async () => {
  const { client, calls } = rpcClient({ data: [{ id: "invite-1", role: "admin" }], error: null });
  const updated = await createSupabaseWorkspaceRepository(client).updateInvitationRole("invite-1", "admin");
  assert.deepEqual(updated, { id: "invite-1", role: "admin" });
  assert.deepEqual(calls, [{ fn: "update_workspace_invitation_role", args: { target_invitation_id: "invite-1", new_role: "admin" } }]);
});

test("updateInvitationRole propagates an RPC error (e.g. invitation revoked) instead of swallowing it", async () => {
  const { client } = rpcClient({ data: null, error: new Error("This invitation has been revoked") });
  await assert.rejects(createSupabaseWorkspaceRepository(client).updateInvitationRole("invite-1", "admin"), /has been revoked/);
});
