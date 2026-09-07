"use client";

import type { ActiveWorkspaceRepository } from "../active-workspace.repository";

const COOKIE_NAME = "tt_active_workspace";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

// Browser half of the active-workspace adapter. Deliberately a plain
// (non-httpOnly) cookie set directly via document.cookie — readable by
// BOTH this Client Component code and the server (active-workspace.server.ts
// reads it via next/headers), same split/reasoning as
// lib/repositories/cookie/language.client.ts (module boundary: a module
// that imports next/headers must never be reachable from a "use client"
// module, and this repo has already hit that real npm run build failure
// once — not repeating it).
export function createCookieActiveWorkspaceRepository(): ActiveWorkspaceRepository {
  return {
    async get() {
      const match = document.cookie.match(/(?:^|;\s*)tt_active_workspace=([^;]*)/);
      return match ? decodeURIComponent(match[1]) : null;
    },
    async set(workspaceId: string) {
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(workspaceId)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    },
  };
}
