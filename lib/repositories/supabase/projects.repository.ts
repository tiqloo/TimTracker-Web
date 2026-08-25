import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectsRepository } from "../projects.repository";
import type { NewProject, Project } from "@/lib/types/project";

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
      const { data, error } = await client
        .from("projects")
        .update({ name, notes })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return toDomain(data as ProjectRow);
    },

    async setArchived(id: string, isArchived: boolean) {
      const { error } = await client
        .from("projects")
        .update({ is_archived: isArchived })
        .eq("id", id);
      if (error) throw error;
    },
  };
}
