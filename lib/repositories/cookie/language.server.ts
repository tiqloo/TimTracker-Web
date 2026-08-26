import { cookies } from "next/headers";
import { isAppLanguage, type AppLanguage } from "@/lib/domain/language";
import type { LanguageRepository } from "../language.repository";

const COOKIE_NAME = "tt_language";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

// Server half of the language-preference adapter — see
// language.client.ts for why the two are split and why the ACTUAL write
// in this app always happens client-side (a plain, non-httpOnly cookie
// set directly, then router.refresh() to have the next server render pick
// it up). set() is still implemented here for interface completeness and
// would work correctly if ever called from a Server Action / Route
// Handler (the only contexts Next.js allows a server-side cookie write
// from — calling it from a plain Server Component render throws, by
// Next.js's own design) — nothing in this phase calls it, get() is the
// only method actually exercised server-side.
export function createCookieLanguageRepository(): LanguageRepository {
  return {
    async get() {
      const store = await cookies();
      const value = store.get(COOKIE_NAME)?.value ?? null;
      return isAppLanguage(value) ? value : "system";
    },
    async set(language: AppLanguage) {
      const store = await cookies();
      store.set(COOKIE_NAME, language, {
        path: "/",
        maxAge: COOKIE_MAX_AGE_SECONDS,
        sameSite: "lax",
      });
    },
  };
}
