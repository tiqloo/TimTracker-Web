import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceRepository, WorkspaceRole } from "../workspace.repository.ts";

interface MembershipRow {
  workspace_id: string;
  role: WorkspaceRole;
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
  };
}
