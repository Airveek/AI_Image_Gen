export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "airveek-theme";
export const THEME_CHANGE_EVENT = "airveek-theme-change";

export function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(storedTheme) ? storedTheme : "light";
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new CustomEvent<Theme>(THEME_CHANGE_EVENT, { detail: theme }));
}
