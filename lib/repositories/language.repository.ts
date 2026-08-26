import type { AppLanguage } from "@/lib/domain/language";

// Driven port for the persisted language preference. Swap point for a
// future backend the same way every other *.repository.ts here is (see
// projects.repository.ts) — today's adapter is a plain cookie
// (lib/repositories/cookie/*), not Supabase, but the shape is identical:
// a pure interface with no storage mechanism leaked into it.
export interface LanguageRepository {
  get(): Promise<AppLanguage>;
  set(language: AppLanguage): Promise<void>;
}
