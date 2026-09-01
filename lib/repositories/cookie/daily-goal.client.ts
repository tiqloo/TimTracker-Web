"use client";

import type { DailyGoalRepository } from "../daily-goal.repository";

const COOKIE_NAME = "tt_daily_goal_hours";
// ~1 year — a persisted preference, same intent/value as
// language.client.ts's COOKIE_MAX_AGE_SECONDS (this port's own precedent).
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

// Browser half of the daily-goal-hours adapter — same split/reasoning as
// lib/repositories/cookie/language.client.ts (its own comment has the full
// "why a plain, non-httpOnly, next/headers-readable-too cookie, and why
// split from the server half" story; not repeated here). A plain
// document.cookie write, no Route Handler round trip, readable by the very
// next server-rendered request.
export function createCookieDailyGoalRepository(): DailyGoalRepository {
  return {
    async get() {
      const match = document.cookie.match(/(?:^|;\s*)tt_daily_goal_hours=([^;]*)/);
      const value = match ? decodeURIComponent(match[1]) : null;
      if (value === null) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    },
    async set(hours: number | null) {
      if (hours === null) {
        // max-age=0 deletes the cookie — same "no goal" representation
        // get() above already treats a missing cookie as, so there's no
        // stale "0" value left behind for a later get() to misread.
        document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
        return;
      }
      document.cookie = `${COOKIE_NAME}=${hours}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    },
  };
}
