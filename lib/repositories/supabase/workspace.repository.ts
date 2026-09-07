import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvitationRole, WorkspaceRepository, WorkspaceRole, WorkspaceType } from "../workspace.repository.ts";

interface MembershipRow {
  workspace_id: string;
  role: WorkspaceRole;
}

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  workspace_type: WorkspaceType;
}

export function createSupabaseWorkspaceRepository(client: SupabaseClient): WorkspaceRepository {
  return {
    async getMembership(userId, workspaceId) {
      // Explicit `user_id`/`workspace_id` filter, not just RLS: Ticket
      // 099's own AC requires the application layer to check membership
      // itself, never rely on RLS alone (defense in depth).
      const { data, error } = await client
        .from("workspace_memberships")
        .select("workspace_id, role")
        .eq("user_id", userId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as MembershipRow;
      return { workspaceId: row.workspace_id, role: row.role };
    },

    async getPersonalWorkspaceId(userId) {
      const { data, error } = await client
        .from("workspace_memberships")
        .select("workspace_id, workspaces!inner(workspace_type)")
        .eq("user_id", userId)
        .eq("workspaces.workspace_type", "PERSONAL")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        // Should be unreachable — Ticket 097's trigger + backfill
        // guarantee exactly one PERSONAL workspace per user — but this is
        // the one call site every workspace-scoped request ultimately
        // falls back to, so fail loudly instead of returning an
        // unusable/undefined workspace id.
        throw new Error(`No personal workspace found for user ${userId}`);
      }
      return (data as { workspace_id: string }).workspace_id;
    },

    async createOrganization(name) {
      // `create_organization_workspace` (TimTracker-Starter repo,
      // supabase/migrations/20260905120000_create_organization_workspace_rpc.sql)
      // is a SECURITY DEFINER RPC, not a table insert — it atomically
      // creates the workspace row AND the caller's owner-membership row,
      // and generates a unique slug server-side. Returns a single row (the
      // function is declared `returns table (...)`, hence `.select()`
      // giving an array from PostgREST, not `.maybeSingle()`-shaped).
      const { data, error } = await client.rpc("create_organization_workspace", {
        workspace_name: name,
      });
      if (error) throw error;
      const rows = data as WorkspaceRow[];
      const row = rows[0];
      if (!row) throw new Error("create_organization_workspace returned no row");
      return { id: row.id, name: row.name, slug: row.slug, workspaceType: row.workspace_type };
    },

    async createInvitation(workspaceId, email, role) {
      const { data, error } = await client.rpc("create_workspace_invitation", {
        target_workspace_id: workspaceId,
        invitee_email: email,
        invitee_role: role,
      });
      if (error) throw error;
      const rows = data as { id: string; token: string; email: string; role: InvitationRole; expires_at: string }[];
      const row = rows[0];
      if (!row) throw new Error("create_workspace_invitation returned no row");
      return { id: row.id, token: row.token, email: row.email, role: row.role, expiresAt: row.expires_at };
    },

    async previewInvitation(token) {
      const { data, error } = await client.rpc("preview_workspace_invitation", {
        invitation_token: token,
      });
      if (error) throw error;
      const rows = data as { email: string; workspace_name: string; role: InvitationRole; is_valid: boolean }[];
      const row = rows[0];
      if (!row) throw new Error("preview_workspace_invitation returned no row");
      return { email: row.email, workspaceName: row.workspace_name, role: row.role, isValid: row.is_valid };
    },

    async acceptInvitation(token) {
      const { data, error } = await client.rpc("accept_workspace_invitation", {
        invitation_token: token,
      });
      if (error) throw error;
      const rows = data as { workspace_id: string; workspace_name: string; role: InvitationRole }[];
      const row = rows[0];
      if (!row) throw new Error("accept_workspace_invitation returned no row");
      return { workspaceId: row.workspace_id, workspaceName: row.workspace_name, role: row.role };
    },
  };
}
