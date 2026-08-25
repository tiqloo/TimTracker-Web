import type { NewProject, Project } from "@/lib/types/project";

// This interface is the swap point for a future custom backend. Pages/
// components must only ever depend on this type — never import
// lib/supabase/* or @supabase/supabase-js directly. Today's only
// implementation is SupabaseProjectsRepository (./supabase/projects.repository.ts),
// wired up in ./index.ts.
export interface ProjectsRepository {
  getAll(): Promise<Project[]>;
  create(input: NewProject): Promise<Project>;
  rename(id: string, name: string, notes: string): Promise<Project>;
  setArchived(id: string, isArchived: boolean): Promise<void>;
}
