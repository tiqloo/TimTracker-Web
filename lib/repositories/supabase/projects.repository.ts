import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectsRepository } from "../projects.repository";
import type { NewProject, Project } from "@/lib/domain/project";

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

export function createSupabaseProjectsRepository(
  client: SupabaseClient,
): ProjectsRepository {
  return {
    async getAll() {
      const { data, error } = await client
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as ProjectRow[]).map(toDomain);
    },

    async create(input: NewProject) {
      const { data, error } = await client
        .from("projects")
        .insert({
          name: input.name,
          color_hex: input.colorHex,
          customer: input.customer ?? "",
          notes: input.notes ?? "",
        })
        .select()
        .single();
      if (error) throw error;
      return toDomain(data as ProjectRow);
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
        .select()
        .single();
      if (error) throw error;
      return toDomain(data as ProjectRow);
    },

    async setArchived(id: string, isArchived: boolean) {
      const { error } = await client
        .from("projects")
        .update({ is_archived: isArchived, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
  };
}
