// Application core (use case) — Ticket 046 (TimTracker-Starter repo):
// DSGVO/GDPR Art. 20 "Recht auf Datenübertragbarkeit". Complements
// deleteAccount() in lib/application/auth.ts (Art. 17, "Recht auf
// Löschung") — that ticket's own comment calls this out as the missing
// counterpart: a user can already erase everything, but had no way to
// take a copy of it first.
//
// Deliberately NOT the same data shape as lib/application/export.ts's
// getExportRows() (the CSV/PDF "Historie" export, Ticket 003/021): that
// one is a human-readable, date-range-scoped, per-session view joined
// with each entry's project name — optimized for reading a printed/
// spreadsheet report. This one is a full, machine-readable data dump
// (raw domain records, every project incl. archived, every time entry
// ever recorded, not just a chosen period) — the actual portability
// requirement Art. 20 asks for, not a duplicate of the existing export.
// Projects are returned separately with their own `id`, so the raw
// `projectId` on each time entry is enough to join them back together —
// no need to duplicate export.ts's project-name-resolution logic here.
import type { Repositories } from "@/lib/repositories/repositories";
import type { Profile } from "@/lib/domain/profile";
import type { Project } from "@/lib/domain/project";
import type { TimeEntry } from "@/lib/domain/time-entry";
import type { Subscription } from "@/lib/domain/subscription";
import { getProfile } from "./auth.ts";
import { listProjects } from "./projects.ts";
import { getSubscriptionStatus } from "./billing.ts";
import { isoToday } from "./dashboard.ts";

// Only what this app's own Supabase schema actually holds (per the
// ticket's own "Bewusst außerhalb" note: Stripe-side raw data like
// invoices/payment methods is deliberately NOT included — already
// available to the user directly through the Stripe billing portal,
// Ticket 007) — a single current-status snapshot, since
// SubscriptionRepository only ever exposes `getCurrent()`, there is no
// separate subscription-history table/port to read from.
export interface DataExport {
  // ISO datetime this export was generated — lets the user (or whoever
  // they hand the file to) tell how fresh a given copy is.
  exportedAt: string;
  profile: Profile;
  projects: Project[];
  timeEntries: TimeEntry[];
  subscription: Subscription;
}

// Gathers the full personal-data picture for the CURRENT session's user,
// across the existing repository ports — no new repository methods
// needed, every piece is already exposed for another feature:
// - profile: getProfile() (Ticket 024)
// - projects: listProjects() (Ticket 018) — already excludes only the two
//   system pseudo-projects ("Arbeitszeit"/"Pause"), keeps archived ones,
//   see that function's own comment
// - timeEntries: repos.timeEntries.getForRange(), bounded by the
//   account's own creation date through today rather than a fixed
//   lookback window or an arbitrary "early enough" constant — no time
//   entry can predate the account itself, so this is a real bound, not a
//   guess, and covers "alle Zeiteinträge" (the ticket's own AK) instead
//   of a chosen period like the CSV/PDF export
// - subscription: getSubscriptionStatus() (Ticket 011)
export async function getFullDataExport(repos: Repositories): Promise<DataExport> {
  const profile = await getProfile(repos);
  const accountCreatedDay = profile.createdAt.slice(0, 10);

  const [projects, timeEntries, subscription] = await Promise.all([
    listProjects(repos),
    repos.timeEntries.getForRange(accountCreatedDay, isoToday()),
    getSubscriptionStatus(repos),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile,
    projects,
    timeEntries,
    subscription,
  };
}
