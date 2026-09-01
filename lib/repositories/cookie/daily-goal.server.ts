import { cookies } from "next/headers";
import type { DailyGoalRepository } from "../daily-goal.repository";

const COOKIE_NAME = "tt_daily_goal_hours";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

// Server half of the daily-goal-hours adapter — see
// lib/repositories/cookie/language.server.ts for why the two are split and
// why the ACTUAL write in this app always happens client-side (this file's
// set() is kept for interface completeness only, same as that file's own
// comment explains; get() is the only method actually exercised
// server-side, by app/(dashboard)/dashboard/page.tsx and settings/page.tsx).
export function createCookieDailyGoalRepository(): DailyGoalRepository {
  return {
    async get() {
      const store = await cookies();
      const value = store.get(COOKIE_NAME)?.value;
      if (value === undefined) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    },
    async set(hours: number | null) {
      const store = await cookies();
      if (hours === null) {
        store.delete(COOKIE_NAME);
        return;
      }
      store.set(COOKIE_NAME, String(hours), {
        path: "/",
        maxAge: COOKIE_MAX_AGE_SECONDS,
        sameSite: "lax",
      });
    },
  };
}
