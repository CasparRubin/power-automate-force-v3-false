export type ThemePreference = "system" | "light" | "dark";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

export function parseThemePreference(value: unknown): ThemePreference {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return DEFAULT_THEME_PREFERENCE;
}

/**
 * Reads OS dark/light preference. If `matchMedia` is missing or throws, returns
 * `true` (dark) as a safe fallback when using system theme.
 */
export function prefersDarkFromSystem(): boolean {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return true;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return true;
  }
}

export function resolveIsDark(preference: ThemePreference): boolean {
  if (preference === "dark") {
    return true;
  }
  if (preference === "light") {
    return false;
  }
  return prefersDarkFromSystem();
}

export function applyThemeClassToDocument(isDark: boolean): void {
  document.documentElement.classList.toggle("dark", isDark);
}

export function subscribePrefersColorScheme(listener: () => void): () => void {
  try {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  } catch {
    return () => {};
  }
}
