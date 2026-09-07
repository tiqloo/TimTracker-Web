import { cookies } from "next/headers";
import type { ActiveWorkspaceRepository } from "../active-workspace.repository";

const COOKIE_NAME = "tt_active_workspace";
// ~1 year — same persisted-preference intent as language.server.ts's own
// cookie (Ticket 103's own AC: survives a reload/new login, no falling
// back to the personal workspace on every page load).
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

// Server half of the active-workspace adapter — see
// lib/repositories/cookie/language.server.ts for why the two are split and
// why the ACTUAL write in this app always happens client-side (this file's
// set() is kept for interface completeness only, same as that file's own
// comment explains). get() returns the RAW cookie value, unvalidated — see
// active-workspace.repository.ts's own doc for why that's this port's job,
// not resolveWorkspaceIdWithFallback()'s.
export function createCookieActiveWorkspaceRepository(): ActiveWorkspaceRepository {
  return {
    async get() {
      const store = await cookies();
      return store.get(COOKIE_NAME)?.value ?? null;
    },
    async set(workspaceId: string) {
      const store = await cookies();
      store.set(COOKIE_NAME, workspaceId, {
        path: "/",
        maxAge: COOKIE_MAX_AGE_SECONDS,
        sameSite: "lax",
      });
    },
  };
}
