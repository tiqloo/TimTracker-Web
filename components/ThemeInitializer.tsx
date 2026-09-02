"use client";

import { useEffect } from "react";
import { parseTheme, THEME_STORAGE_KEY } from "@/lib/domain/theme";

export function applyThemePreference(rawTheme: string | null): void {
  const theme = parseTheme(rawTheme);
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

export function ThemeInitializer() {
  useEffect(() => {
    applyThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));

    function handleStorage(event: StorageEvent) {
      if (event.key === THEME_STORAGE_KEY) applyThemePreference(event.newValue);
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return null;
}
