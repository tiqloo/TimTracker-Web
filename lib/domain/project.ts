// Domain model — mirrors Domain/Models/Project.swift in TimTracker-Starter.
// Deliberately framework-free: no Supabase types leak in here, matching
// the "Domain has no framework imports" rule from the native app's
// Clean Architecture audit.
export interface Project {
  id: string;
  name: string;
  colorHex: string;
  customer: string;
  notes: string;
  isDefault: boolean;
  isArchived: boolean;
  updatedAt: string;
  // Ticket 123 — "öffentliche Workspace-Projekte bleiben als expliziter
  // Modus möglich": false (the default, and every pre-123 project) means
  // every workspace member sees it, exactly Ticket 122's own behavior.
  // true means only the workspace's owner/admin plus whoever is
  // explicitly assigned (see WorkspaceRepository#listProjectMembers/
  // assignProjectMember/unassignProjectMember) can see or use it — the
  // RPC/RLS layer (TimTracker-Starter repo) is the sole authority, this
  // flag on its own grants nothing.
  isRestricted: boolean;
}

export type NewProject = Pick<Project, "name" | "colorHex"> &
  Partial<Pick<Project, "customer" | "notes">>;

// Mirrors Shared/Constants/ProjectColorPalette.swift in TimTracker-Starter
// verbatim (same 8 hex values, same order) so a project created on the web
// looks the same in the native apps' timeline/charts and vice versa. Kept
// here (not lib/format.ts) because it's a fixed set tied to the Project
// domain model itself, not a display-formatting helper.
export const PROJECT_COLOR_PALETTE = [
  "B4592E", // Rost
  "7A6FB4", // Violett
  "4C8FBF", // Blau
  "B4A23A", // Oliv
  "C4577A", // Beere
  "3F9E7A", // Smaragd
  "8A6D4B", // Braun
  "5B6660", // Grau
] as const;

// Suggests a not-yet-used color in round-robin fashion — mirrors
// ProjectColorPalette.suggestedColor(usedCount:).
export function suggestedProjectColor(usedCount: number): string {
  return PROJECT_COLOR_PALETTE[usedCount % PROJECT_COLOR_PALETTE.length];
}

// Mirrors Project.nameExists(_:excluding:in:) — a trimmed, case-sensitive
// comparison against the given project list. Duplicate names are
// deliberately ALLOWED (e.g. the same project name for two different
// customers, see docs/tickets/005-edit-project.md's 2026-08-25 addendum in
// TimTracker-Starter) — this is a non-blocking UX warning, never
// validation. `excludingId` leaves the project currently being edited out
// of its own comparison.
export function projectNameExists(
  trimmedName: string,
  projects: Project[],
  excludingId?: string,
): boolean {
  return projects.some(
    (project) => project.id !== excludingId && project.name === trimmedName,
  );
}
