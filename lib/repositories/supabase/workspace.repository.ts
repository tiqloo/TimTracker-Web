import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InvitationRole,
  WorkspaceMemberStatus,
  WorkspaceRepository,
  WorkspaceRole,
  WorkspaceType,
} from "../workspace.repository.ts";
import { ReauthenticationFailedError } from "../auth.repository.ts";

interface MembershipRow {
  workspace_id: string;
  role: WorkspaceRole;
}

interface MembershipSummaryRow {
  workspace_id: string;
  role: WorkspaceRole;
  workspaces: { name: string; workspace_type: WorkspaceType };
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

    async listMemberships(userId) {
      // Ordered PERSONAL-first (`order("workspaces(workspace_type)")` isn't
      // reliably sortable this way via PostgREST's embed syntax, so this
      // sorts client-side instead — the row count here is always small,
      // one per workspace a single user belongs to) — the workspace
      // switcher always shows "Persönlich" first, then organizations,
      // matching this ticket's own example UI.
      const { data, error } = await client
        .from("workspace_memberships")
        .select("workspace_id, role, workspaces!inner(name, workspace_type)")
        .eq("user_id", userId);
      if (error) throw error;
      const rows = (data ?? []) as unknown as MembershipSummaryRow[];
      return rows
        .map((row) => ({
          workspaceId: row.workspace_id,
          workspaceName: row.workspaces.name,
          workspaceType: row.workspaces.workspace_type,
          role: row.role,
        }))
        .sort((a, b) => (a.workspaceType === b.workspaceType ? 0 : a.workspaceType === "PERSONAL" ? -1 : 1));
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

    async listPendingInvitations() {
      const { data, error } = await client.rpc("list_pending_invitations_for_current_user");
      if (error) throw error;
      const rows = data as { id: string; workspace_id: string; workspace_name: string; role: InvitationRole }[];
      return rows.map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        workspaceName: row.workspace_name,
        role: row.role,
      }));
    },

    async acceptPendingInvitation(invitationId) {
      const { data, error } = await client.rpc("accept_pending_invitation", {
        target_invitation_id: invitationId,
      });
      if (error) throw error;
      const rows = data as { workspace_id: string; workspace_name: string; role: InvitationRole }[];
      const row = rows[0];
      if (!row) throw new Error("accept_pending_invitation returned no row");
      return { workspaceId: row.workspace_id, workspaceName: row.workspace_name, role: row.role };
    },

    async listMembers(workspaceId) {
      const { data, error } = await client.rpc("list_workspace_members", {
        target_workspace_id: workspaceId,
      });
      if (error) throw error;
      const rows = data as {
        user_id: string | null;
        email: string;
        display_name: string | null;
        role: WorkspaceRole;
        status: WorkspaceMemberStatus;
        since: string;
      }[];
      return rows.map((row) => ({
        userId: row.user_id,
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        status: row.status,
        since: row.since,
      }));
    },

    async updateMemberRole(workspaceId, userId, role) {
      const { data, error } = await client.rpc("update_workspace_member_role", {
        target_workspace_id: workspaceId,
        target_user_id: userId,
        new_role: role,
      });
      if (error) throw error;
      const rows = data as { user_id: string; role: InvitationRole }[];
      const row = rows[0];
      if (!row) throw new Error("update_workspace_member_role returned no row");
      return { userId: row.user_id, role: row.role };
    },

    async removeMember(workspaceId, userId) {
      const { error } = await client.rpc("remove_workspace_member", {
        target_workspace_id: workspaceId,
        target_user_id: userId,
      });
      if (error) throw error;
    },

    async leaveWorkspace(workspaceId) {
      const { error } = await client.rpc("leave_workspace", {
        target_workspace_id: workspaceId,
      });
      if (error) throw error;
    },

    async transferOwnership(workspaceId, newOwnerUserId, currentPassword) {
      // Re-authentication FIRST — exact same pattern as changeEmail/
      // changePassword (auth.repository.ts): confirms the caller actually
      // knows the account's current password before this security-sensitive
      // action, using the session's OWN email (never anything caller-supplied).
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      const currentEmail = userData.user.email;
      if (!currentEmail) {
        throw new Error("Current session has no email address on file.");
      }
      const { error: reauthError } = await client.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword,
      });
      if (reauthError) throw new ReauthenticationFailedError();

      const { error } = await client.rpc("transfer_workspace_ownership", {
        target_workspace_id: workspaceId,
        new_owner_user_id: newOwnerUserId,
      });
      if (error) throw error;
    },

    async listInvitations(workspaceId) {
      const { data, error } = await client.rpc("list_workspace_invitations", {
        target_workspace_id: workspaceId,
      });
      if (error) throw error;
      const rows = data as {
        id: string;
        email: string;
        role: InvitationRole;
        sent_at: string;
        expires_at: string;
        revoked_at: string | null;
        accepted_at: string | null;
      }[];
      return rows.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        sentAt: row.sent_at,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
        acceptedAt: row.accepted_at,
      }));
    },

    async resendInvitation(invitationId) {
      const { data, error } = await client.rpc("resend_workspace_invitation", {
        target_invitation_id: invitationId,
      });
      if (error) throw error;
      const rows = data as { id: string; token: string; email: string; role: InvitationRole; expires_at: string }[];
      const row = rows[0];
      if (!row) throw new Error("resend_workspace_invitation returned no row");
      return { id: row.id, token: row.token, email: row.email, role: row.role, expiresAt: row.expires_at };
    },

    async revokeInvitation(invitationId) {
      const { error } = await client.rpc("revoke_workspace_invitation", {
        target_invitation_id: invitationId,
      });
      if (error) throw error;
    },

    async updateInvitationRole(invitationId, role) {
      const { data, error } = await client.rpc("update_workspace_invitation_role", {
        target_invitation_id: invitationId,
        new_role: role,
      });
      if (error) throw error;
      const rows = data as { id: string; role: InvitationRole }[];
      const row = rows[0];
      if (!row) throw new Error("update_workspace_invitation_role returned no row");
      return { id: row.id, role: row.role };
    },

    async getSettings(workspaceId) {
      const { data, error } = await client.rpc("get_workspace_settings", {
        target_workspace_id: workspaceId,
      });
      if (error) throw error;
      const rows = data as {
        id: string;
        name: string;
        timezone: string;
        default_language: "de" | "en";
        week_start: "monday" | "sunday";
        date_format: "DD.MM.YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
        time_format: "24h" | "12h";
        logo_path: string | null;
      }[];
      const row = rows[0];
      if (!row) throw new Error("get_workspace_settings returned no row");
      return {
        id: row.id,
        name: row.name,
        timezone: row.timezone,
        defaultLanguage: row.default_language,
        weekStart: row.week_start,
        dateFormat: row.date_format,
        timeFormat: row.time_format,
        logoPath: row.logo_path,
      };
    },

    async updateSettings(workspaceId, input) {
      const { data, error } = await client.rpc("update_workspace_settings", {
        target_workspace_id: workspaceId,
        new_name: input.name,
        new_timezone: input.timezone,
        new_default_language: input.defaultLanguage,
        new_week_start: input.weekStart,
        new_date_format: input.dateFormat,
        new_time_format: input.timeFormat,
      });
      if (error) throw error;
      const rows = data as {
        id: string;
        name: string;
        timezone: string;
        default_language: "de" | "en";
        week_start: "monday" | "sunday";
        date_format: "DD.MM.YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
        time_format: "24h" | "12h";
      }[];
      const row = rows[0];
      if (!row) throw new Error("update_workspace_settings returned no row");
      return {
        id: row.id,
        name: row.name,
        timezone: row.timezone,
        defaultLanguage: row.default_language,
        weekStart: row.week_start,
        dateFormat: row.date_format,
        timeFormat: row.time_format,
      };
    },

    async uploadLogo(workspaceId, file) {
      const path = `${workspaceId}/logo`;
      const { error: uploadError } = await client.storage
        .from("workspace-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { error: rpcError } = await client.rpc("update_workspace_logo", {
        target_workspace_id: workspaceId,
        new_logo_path: path,
      });
      if (rpcError) throw rpcError;
      return path;
    },

    async removeLogo(workspaceId) {
      const path = `${workspaceId}/logo`;
      const { error: rpcError } = await client.rpc("update_workspace_logo", {
        target_workspace_id: workspaceId,
        new_logo_path: null,
      });
      if (rpcError) throw rpcError;
      // Best-effort: the pointer is already cleared above, so a failure
      // here only leaves a harmless orphaned object, never a broken image.
      await client.storage.from("workspace-logos").remove([path]);
    },

    async getLogoUrl(logoPath) {
      const { data, error } = await client.storage
        .from("workspace-logos")
        .createSignedUrl(logoPath, 60 * 5);
      if (error) throw error;
      return data.signedUrl;
    },

    async listTeamTime(workspaceId, fromDay, toDay, filter) {
      const { data, error } = await client.rpc("list_workspace_team_time", {
        target_workspace_id: workspaceId,
        from_day: fromDay,
        to_day: toDay,
        filter_user_id: filter?.userId ?? null,
        filter_project_id: filter?.projectId ?? null,
        page_limit: filter?.limit ?? 200,
        page_offset: filter?.offset ?? 0,
      });
      if (error) throw error;
      const rows = data as { user_id: string; email: string; display_name: string | null; day: string; total_seconds: number }[];
      return rows.map((row) => ({
        userId: row.user_id,
        email: row.email,
        displayName: row.display_name,
        day: row.day.slice(0, 10),
        totalSeconds: row.total_seconds,
      }));
    },

    async listRunningEntries(workspaceId) {
      const { data, error } = await client.rpc("list_workspace_running_entries", {
        target_workspace_id: workspaceId,
      });
      if (error) throw error;
      const rows = data as {
        user_id: string;
        email: string;
        display_name: string | null;
        project_id: string;
        project_name: string;
        start_time: string;
      }[];
      return rows.map((row) => ({
        userId: row.user_id,
        email: row.email,
        displayName: row.display_name,
        projectId: row.project_id,
        projectName: row.project_name,
        startTime: row.start_time,
      }));
    },

    async listMemberTimeEntries(workspaceId, userId, fromDay, toDay, filter) {
      const { data, error } = await client.rpc("list_workspace_member_time_entries", {
        target_workspace_id: workspaceId,
        target_user_id: userId,
        from_day: fromDay,
        to_day: toDay,
        filter_project_id: filter?.projectId ?? null,
        page_limit: filter?.limit ?? 200,
        page_offset: filter?.offset ?? 0,
      });
      if (error) throw error;
      const rows = data as {
        id: string;
        project_id: string;
        project_name: string;
        day: string;
        start_time: string;
        end_time: string | null;
      }[];
      return rows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        projectName: row.project_name,
        day: row.day.slice(0, 10),
        startTime: row.start_time,
        endTime: row.end_time,
      }));
    },
  };
}
