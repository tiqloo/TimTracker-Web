// Driven port for the persisted daily-goal-hours preference (Ticket 044,
// TimTracker-Starter repo). Same shape as language.repository.ts on
// purpose — the ticket explicitly names the language preference
// (lib/application/language.ts's get/setLanguagePreference() against
// LanguageRepository) as the precedent to follow for a brand-new
// per-user setting: its own port/use-case, no ad-hoc persistence logic in
// the component. `null` = no goal set (see lib/domain/daily-goal.ts's
// normalizeDailyGoalHoursInput for what collapses to null); a set value is
// a plain number of hours, not seconds — the unit the Settings input
// itself collects.
export interface DailyGoalRepository {
  get(): Promise<number | null>;
  set(hours: number | null): Promise<void>;
}
