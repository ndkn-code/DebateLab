export const APP_THEME_STORAGE_KEY = "thinkfy-theme";
export const APP_THEME_COOKIE_NAME = "thinkfy_theme";
export const APP_THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const APP_THEMES = ["light", "dark"] as const;
export type AppTheme = (typeof APP_THEMES)[number];

export function isAppTheme(value: unknown): value is AppTheme {
  return APP_THEMES.includes(value as AppTheme);
}

export function coerceAppTheme(value: unknown, fallback: AppTheme = "light") {
  return isAppTheme(value) ? value : fallback;
}

export function getOppositeTheme(theme: AppTheme): AppTheme {
  return theme === "dark" ? "light" : "dark";
}
