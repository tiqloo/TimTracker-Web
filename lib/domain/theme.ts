export const APP_THEMES = ["system", "light", "dark"] as const;
export type AppTheme = (typeof APP_THEMES)[number];

export const THEME_STORAGE_KEY = "tiqloo-theme";

export function parseTheme(value: string | null): AppTheme {
  return APP_THEMES.includes(value as AppTheme) ? (value as AppTheme) : "system";
}
