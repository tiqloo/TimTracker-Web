"use client";

import { isAppLanguage, type AppLanguage } from "@/lib/domain/language";
import type { LanguageRepository } from "../language.repository";

const COOKIE_NAME = "tt_language";
// ~1 year — a persisted preference, same intent as UserDefaults on the
// native app (survives until the visitor changes it again).
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

// Browser half of the language-preference adapter. Deliberately a plain
// (non-httpOnly) cookie set directly via document.cookie — readable by
// BOTH this Client Component code and the server
// (lib/repositories/cookie/language.server.ts reads it via next/headers),
// so a change here is visible to the very next server-rendered request
// with no Route Handler round trip. Split into its own file from the
// server half for the exact reason composition-root.client.ts/server.ts
// are split (see that file's comment): a module that imports next/headers
// must never be reachable from a "use client" module, and this repo has
// already hit that real npm run build failure once — not repeating it.
export function createCookieLanguageRepository(): LanguageRepository {
  return {
    async get() {
      const match = document.cookie.match(/(?:^|;\s*)tt_language=([^;]*)/);
      const value = match ? decodeURIComponent(match[1]) : null;
      return isAppLanguage(value) ? value : "system";
    },
    async set(language: AppLanguage) {
      document.cookie = `${COOKIE_NAME}=${language}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    },
  };
}
