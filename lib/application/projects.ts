// Application core (use cases) — mirrors CreateProjectUseCase.swift /
// UpdateProjectUseCase.swift / ArchiveProjectUseCase.swift. This is the
// ONLY layer allowed to depend on repository ports; driving adapters
// (pages) call these functions, never a repository directly.
import type { Repositories } from "@/lib/repositories/repositories";
import type { NewProject, Project } from "@/lib/domain/project";

// Excludes the two system pseudo-projects ("Arbeitszeit"/"Pause",
// is_default = true) — they're FK targets for automatically-tracked time,
// not real user-managed projects, and showing them in a CRUD list would be
// confusing (rename/archive make no sense for them). Mirrors
// ProjectService.swift's managedProjects() = allProjects().filter {
// !$0.isDefault }.
//
// This filter is defense-in-depth, not the only thing doing the work:
// repos.projects.getAll() already never returns these two rows in
// practice, because RLS's `projects_select_own` policy
// (`auth.uid() = user_id`) can never match their `user_id = NULL` rows —
// see 0004_time_entries_project_fk.sql's own comment, and the identical
// finding written up in lib/application/export.ts when Phase 1c hit the
// same underlying data fact from the export side. Kept here anyway so the
// business rule ("this list is user-managed projects only") is explicit at
// the layer that owns it, not an accident of an unrelated RLS policy.
export async function listProjects(repos: Repositories): Promise<Project[]> {
  const projects = await repos.projects.getAll();
  return projects.filter((project) => !project.isDefault);
}

export async function createProject(
  repos: Repositories,
  input: NewProject,
): Promise<Project> {
  const name = input.name.trim();
  if (!name) throw new Error("Projektname darf nicht leer sein");
  return repos.projects.create({ ...input, name });
}

export async function renameProject(
  repos: Repositories,
  id: string,
  name: string,
  notes: string,
): Promise<Project> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Projektname darf nicht leer sein");
  return repos.projects.rename(id, trimmed, notes);
}

export async function archiveProject(
  repos: Repositories,
  id: string,
  isArchived: boolean,
): Promise<void> {
  return repos.projects.setArchived(id, isArchived);
}
