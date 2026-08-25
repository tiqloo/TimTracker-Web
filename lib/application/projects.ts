// Application core (use cases) — mirrors CreateProjectUseCase.swift /
// UpdateProjectUseCase.swift / ArchiveProjectUseCase.swift. This is the
// ONLY layer allowed to depend on repository ports; driving adapters
// (pages) call these functions, never a repository directly.
import type { Repositories } from "@/lib/repositories/repositories";
import type { NewProject, Project } from "@/lib/domain/project";

export async function listProjects(repos: Repositories): Promise<Project[]> {
  return repos.projects.getAll();
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
