// Domain model — Ticket 044 (TimTracker-Starter repo, follow-up to 033):
// "Tagesziel/Sollzeit" is a brand-new concept, no native-app counterpart to
// mirror (grep over supabase/migrations/*.sql and lib/domain/*.ts at ticket
// creation time confirmed nothing like it existed anywhere yet — see the
// ticket's own "Ausgangslage"). Stored as a plain number of hours
// (fractional allowed, e.g. 7.5) rather than seconds — that's the unit the
// Settings input actually collects, and the one place that needs seconds
// (the progress bar's ratio math below) converts locally rather than
// forcing every caller to think in seconds for a value users type in hours.

// Client-side input guard rail (ticket edge case: "sehr hohes Ziel, z. B.
// versehentlich 80 statt 8 Stunden eingetragen -> keine harte Obergrenze im
// Backend nötig, aber ein sinnvoller clientseitiger Eingabe-Rahmen"). No
// backend/DB constraint mirrors this on purpose — same "guard rail, not a
// hard business rule" call the ticket itself makes.
export const MIN_DAILY_GOAL_HOURS = 0;
export const MAX_DAILY_GOAL_HOURS = 24;

// Normalizes a raw hours value (parsed from the Settings number input)
// into what actually gets persisted: clamps into [0, 24], then treats
// anything <= 0 (including a blank field parsed as 0, NaN from an empty/
// invalid string, or a negative number) as "no goal set" -> null. Same
// "normalize once, at the use-case boundary, blank/0 -> null" shape as
// lib/domain/profile.ts#normalizeDisplayNameInput — this is the one place
// that decides what counts as "no goal", so the save path
// (lib/application/daily-goal.ts) and DayDetail's read path
// (computeDailyGoalProgress below) always agree with each other. Matches
// the AK verbatim: "leer/0 = kein Ziel, Hero-Kennzahl verhält sich dann
// wie heute ohne Fortschrittsanzeige".
export function normalizeDailyGoalHoursInput(rawHours: number): number | null {
  if (!Number.isFinite(rawHours) || rawHours <= 0) return null;
  return Math.min(MAX_DAILY_GOAL_HOURS, rawHours);
}

export interface DailyGoalProgress {
  goalSeconds: number;
  // Clamped to [0, 1] — the progress bar's fill width, never overshoots
  // past 100% even once the goal is exceeded (AK: "Ziel erreicht/
  // überschritten: ruhiger visueller Zustand ... Balken voll").
  ratio: number;
  reached: boolean;
}

// null (or <= 0) `dailyGoalHours` means "no goal set" — returns null so
// DayDetail can decide not to render ANY progress UI at all, rather than a
// degenerate 0-goal division. This is the single source of truth for "is
// there a goal to show progress against", used by both the "Heute" hero
// number and (should a future caller need it) any other day view.
export function computeDailyGoalProgress(
  totalSeconds: number,
  dailyGoalHours: number | null,
): DailyGoalProgress | null {
  if (dailyGoalHours === null || dailyGoalHours <= 0) return null;
  const goalSeconds = dailyGoalHours * 3600;
  const ratio = Math.min(1, Math.max(0, totalSeconds / goalSeconds));
  return { goalSeconds, ratio, reached: totalSeconds >= goalSeconds };
}
