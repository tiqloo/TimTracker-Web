import type { ProjectsRepository } from "./projects.repository";
import type { TimeEntriesRepository } from "./time-entries.repository";
import type { SubscriptionRepository } from "./subscription.repository";
import type { AuthRepository } from "./auth.repository";
import type { LanguageRepository } from "./language.repository";

// Pure aggregate of the driven ports — no adapter/Supabase import here,
// on purpose. This is what lib/application/* is allowed to depend on.
// The composition root (lib/composition-root.ts) imports THIS file too,
// it doesn't own the type.
export interface Repositories {
  projects: ProjectsRepository;
  timeEntries: TimeEntriesRepository;
  subscription: SubscriptionRepository;
  auth: AuthRepository;
  language: LanguageRepository;
}
