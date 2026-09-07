import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectsRepository } from "../projects.repository";
import type { NewProject, Project } from "@/lib/domain/project";
import { collectAllPages } from "./pagination.ts";
import { requireUpdatedRow } from "./mutation-result.ts";

// Wire-format row shape from the `projects` table (supabase/migrations/
// 0001_init.sql in TimTracker-Starter) — deliberately kept separate from
// the Project domain type, same split as ProjectRemoteDTO/ProjectRemoteMapper
// on the Swift side, so a schema change here can't silently leak into
// every page that uses Project.
interface ProjectRow {
  id: string;
  name: string;
  color_hex: string;
  customer: string;
  notes: string;
  is_default: boolean;
  is_archived: boolean;
  updated_at: string;
}

const PROJECT_COLUMNS =
  "id, name, color_hex, customer, notes, is_default, is_archived, updated_at";

function toDomain(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    colorHex: row.color_hex,
    customer: row.customer,
    notes: row.notes,
    isDefault: row.is_default,
    isArchived: row.is_archived,
    updatedAt: row.updated_at,
  };
}

// Ticket 103 — `getActiveWorkspaceId` is an injected, lazily-invoked async
// thunk rather than a plain workspace id resolved once at construction
// time: this adapter is shared between the server and browser composition
// roots (see those files' own comments), and the browser one's
// getRepositories() must stay synchronous (many Client Components call it
// on every render) — resolving the active workspace itself requires an
// async DB round trip (validating the stored cookie value against the
// caller's actual memberships, see workspace.repository.ts's
// resolveWorkspaceIdWithFallback), so that resolution has to happen lazily
// inside each method call instead of at repository-construction time.
export function createSupabaseProjectsRepository(
  client: SupabaseClient,
  getActiveWorkspaceId: () => Promise<string>,
): ProjectsRepository {
  return {
    async getAll() {
      const workspaceId = await getActiveWorkspaceId();
      const rows = await collectAllPages<ProjectRow>(async (from, to) => {
        const { data, error } = await client
          .from("projects")
          .select(PROJECT_COLUMNS)
          .eq("workspace_id", workspaceId)
          .order("updated_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to);
        if (error) throw error;
        return (data ?? []) as ProjectRow[];
      });
      return rows.map(toDomain);
    },

    async create(input: NewProject) {
      const workspaceId = await getActiveWorkspaceId();
      // Ticket 103 (fixes a real bug flagged in docs/audit-findings.md,
      // TimTracker-Starter repo, and confirmed live against a fresh local
      // stack on 2026-09-07 — the audit finding's own suspicion was
      // correct: this insert 400ed with "null value in column id violates
      // not-null constraint" the moment it was actually exercised end to
      // end): `projects.id` (supabase/migrations/0001_init.sql) is `uuid
      // primary key` with NO default — every existing project in this
      // database was reachable only via whatever OTHER path originally
      // created it (the native Mac app always generates its own id
      // client-side, same offline-first-sync id-generation model the
      // Swift SyncEngine already uses), never through this Web insert
      // path. `user_id`/`workspace_id` were ALSO missing, silently
      // relying entirely on the projects_assign_personal_workspace_when_missing
      // DB trigger and an unverified-against-production column default for
      // `user_id` — meaning a project created here would have always
      // landed in the creator's PERSONAL workspace regardless of which one
      // was actually active, once `id` stopped being the blocker. All
      // three are required by the current RLS insert policy (`(select
      // auth.uid()) = user_id and is_workspace_member(workspace_id)`,
      // supabase/migrations/20260905090000_workspace_scope_projects_and_time_entries.sql)
      // plus the table's own NOT NULL constraint on `id`.
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData.user) throw userError ?? new Error("Not authenticated");
      const { data, error } = await client
        .from("projects")
        .insert({
          id: crypto.randomUUID(),
          user_id: userData.user.id,
          workspace_id: workspaceId,
          name: input.name,
          color_hex: input.colorHex,
          customer: input.customer ?? "",
          notes: input.notes ?? "",
        })
        .select(PROJECT_COLUMNS)
        .maybeSingle();
      if (error) throw error;
      return toDomain(requireUpdatedRow(data as ProjectRow | null, "Project"));
    },

    async rename(id: string, name: string, notes: string) {
      // `updated_at` has no DB trigger (0001_init.sql only defaults it on
      // INSERT) — the native app's UpdateProjectUseCase.swift/
      // ArchiveProjectUseCase.swift explicitly set `project.updatedAt =
      // clock.now()` before saving for exactly this reason: SyncEngine.swift
      // uses `updatedAt` for last-write-wins conflict resolution (`if
      // remote.updatedAt >= local.updatedAt`). Found while testing this
      // phase's rename/archive against real seeded data — without setting it
      // explicitly here too, a web-side rename/archive would leave
      // `updated_at` stale, which would both leave getAll()'s
      // "order by updated_at desc" list ordering wrong AND make a later
      // native-app sync potentially treat the web edit as older than a
      // stale local copy, silently discarding it. Same fix applied to both
      // rename and setArchived below.
      const { data, error } = await client
        .from("projects")
        .update({ name, notes, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select(PROJECT_COLUMNS)
        .maybeSingle();
      if (error) throw error;
      return toDomain(requireUpdatedRow(data as ProjectRow | null, "Project"));
    },

    async setArchived(id: string, isArchived: boolean) {
      const { data, error } = await client
        .from("projects")
        .update({ is_archived: isArchived, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      requireUpdatedRow(data as { id: string } | null, "Project");
    },
  };
}
