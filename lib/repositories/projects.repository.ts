import type { NewProject, Project } from "@/lib/domain/project";
import type { WorkspaceRole } from "@/lib/repositories/workspace.repository";

// Ticket 123 — one row of "who is explicitly assigned to a restricted
// project" (RestrictProject#isRestricted's own doc). `role` is that
// person's WORKSPACE role (owner/admin/member), not a project-specific
// one — this ticket's own scope deliberately has no project-level roles
// (see Ticket 124, which V1-defines exactly one project_member role and
// explicitly keeps project/workspace membership separate concepts).
export interface ProjectMemberRow {
  userId: string;
  email: string;
  displayName: string | null;
  role: WorkspaceRole;
}

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

  // Ticket 123 — toggles a project between "every workspace member sees
  // it" (false, the default) and "only owner/admin plus explicitly
  // assigned members see it" (true). Own method (not folded into rename)
  // since it's an independent, less frequently used action with its own
  // RPC-backed authorization on the server side.
  setRestricted(id: string, isRestricted: boolean): Promise<void>;

  // Backed by SECURITY DEFINER RPCs (TimTracker-Starter repo:
  // list_project_members/assign_project_member/unassign_project_member)
  // that are themselves the sole authority on who may call them
  // (owner/admin of the project's workspace) and on "target must be an
  // ACTIVE member of that same workspace" — this port makes no promises
  // about either check.
  listProjectMembers(id: string): Promise<ProjectMemberRow[]>;
  assignProjectMember(id: string, userId: string): Promise<void>;
  unassignProjectMember(id: string, userId: string): Promise<void>;
}
