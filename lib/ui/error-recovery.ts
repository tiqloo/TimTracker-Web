import type { Lang, Translated } from "@/lib/i18n";

export const errorRecovery = {
  dashboardTitle: {
    de: "Das Dashboard konnte nicht geladen werden.",
    en: "The dashboard could not be loaded.",
  },
  globalTitle: {
    de: "Tiqloo konnte nicht geladen werden.",
    en: "Tiqloo could not be loaded.",
  },
  body: {
    de: "Deine Daten sind weiterhin sicher. Versuche es erneut oder kehre zum Dashboard zurück.",
    en: "Your data is still safe. Try again or return to the dashboard.",
  },
  globalBody: {
    de: "Bitte versuche es erneut. Falls der Fehler bestehen bleibt, lade die Seite neu.",
    en: "Please try again. If the problem persists, reload the page.",
  },
  retry: { de: "Erneut versuchen", en: "Try again" },
  dashboard: { de: "Zum Dashboard", en: "Go to dashboard" },
  reference: { de: "Fehlerreferenz", en: "Error reference" },
} satisfies Record<string, Translated>;

/**
 * Error boundaries are client components and cannot read the server-side
 * language repository. The root layout already writes the effective locale
 * to <html lang>, so it remains the single source of truth here too.
 */
export function languageFromDocument(documentLanguage: string | null | undefined): Lang {
  return documentLanguage?.toLowerCase().startsWith("en") ? "en" : "de";
}
