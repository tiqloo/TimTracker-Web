// Application core (use case) — Ticket 044 (TimTracker-Starter repo,
// follow-up to 033). Mirrors lib/application/language.ts's
// getLanguagePreference()/setLanguagePreference() shape 1:1, per the
// ticket's own explicit precedent: a brand-new per-user setting gets its
// own port/use-case, no ad-hoc persistence logic in the component. Driving
// adapters (pages) call these functions, never lib/repositories/* directly.
import type { Repositories } from "@/lib/repositories/repositories";
import { normalizeDailyGoalHoursInput } from "../domain/daily-goal.ts";

export async function getDailyGoalHours(repos: Repositories): Promise<number | null> {
  return repos.dailyGoal.get();
}

// Normalizes the raw hours value (from the Settings number input) before
// persisting — same "normalize once, at the use-case boundary" shape as
// lib/application/auth.ts#updateDisplayName, so a caller doesn't have to
// duplicate lib/domain/daily-goal.ts#normalizeDailyGoalHoursInput's rule
// itself (clamp into [0, 24], blank/0/negative -> null = "no goal").
export async function setDailyGoalHours(
  repos: Repositories,
  rawHours: number,
): Promise<void> {
  return repos.dailyGoal.set(normalizeDailyGoalHoursInput(rawHours));
}
