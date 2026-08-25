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
}

export type NewProject = Pick<Project, "name" | "colorHex"> &
  Partial<Pick<Project, "customer" | "notes">>;
