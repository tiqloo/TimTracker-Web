// Domain model — mirrors Domain/Enums/AppLanguage.swift in
// TimTracker-Starter (Ticket 004): "system" follows the visitor's
// preferred language (German if their first preference is German, English
// as the fallback otherwise — same rule as AppLanguage.resolveSystemLanguageCode,
// just fed by the browser's Accept-Language header instead of macOS's
// Locale.preferredLanguages); "de"/"en" are explicit, persisted overrides
// that always win once set.
//
// This is the language SETTING itself — storage and resolution to a
// concrete "de" | "en" code. It drives <html lang> (app/layout.tsx),
// Intl-based date/number formatting (lib/format.ts), AND, as of Ticket
// 022, the actual translated UI text across every page/component (see
// lib/i18n.ts — a small own key-value dictionary, deliberately not a
// dependency like next-intl, resolved server-side the same
// getEffectiveLanguageCode() way everywhere). Formerly (Ticket 018, Phase
// 1e) this file's SCOPE NOTE documented UI text as an explicit, known gap
// — Ticket 022 closed it; see lib/i18n.ts's own module comment for the
// full reasoning and Resources/Localizable.xcstrings for the native-app
// terminology it stays consistent with.
export type AppLanguage = "system" | "de" | "en";

export const APP_LANGUAGES: AppLanguage[] = ["system", "de", "en"];

// Resolves an AppLanguage preference to a concrete "de" | "en" code for a
// given request, mirroring AppLanguage.swift's
// effectiveLanguageCode(preferredLanguages:)/resolveSystemLanguageCode(preferredLanguages:)
// 1:1 in spirit: explicit overrides win outright, "system" defers to the
// visitor's first preferred language, German only if THAT starts with
// "de", English as the fallback for everything else (including no header
// at all). `acceptLanguageHeader` is the raw `Accept-Language` request
// header (e.g. "de-DE,de;q=0.9,en;q=0.8") — the web equivalent of
// `Locale.preferredLanguages`'s first entry.
export function resolveLanguageCode(
  language: AppLanguage,
  acceptLanguageHeader: string | null,
): "de" | "en" {
  switch (language) {
    case "de":
      return "de";
    case "en":
      return "en";
    case "system":
      return resolveSystemLanguageCode(acceptLanguageHeader);
  }
}

export function resolveSystemLanguageCode(acceptLanguageHeader: string | null): "de" | "en" {
  const first = acceptLanguageHeader?.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("de") ? "de" : "en";
}

// "de" -> "de-DE", "en" -> "en-US" — the BCP-47 locale identifiers this
// app's Intl/toLocaleString call sites use for date/number formatting.
export function languageCodeToLocale(code: "de" | "en"): "de-DE" | "en-US" {
  return code === "de" ? "de-DE" : "en-US";
}

// Display name for the language picker itself. Deliberately NOT run
// through the current app language (same reasoning as
// AppLanguage.swift's displayName): a user who picked the wrong language
// by accident must always be able to recognize their target language's
// entry, spelled in that language, regardless of what's currently active.
export function languageDisplayName(language: AppLanguage): string {
  switch (language) {
    case "system":
      return "Automatisch (Systemsprache)";
    case "de":
      return "Deutsch";
    case "en":
      return "English";
  }
}

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value === "system" || value === "de" || value === "en";
}
