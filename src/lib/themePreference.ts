export const THEME_STORAGE_KEY = 'blc-theme'

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const

export type ThemePreference = (typeof THEME_PREFERENCES)[number]

export type ResolvedTheme = 'light' | 'dark'

export function parseThemePreference(value: string | null): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value
  }
  return 'system'
}

/** No OS preference resolves to light. `prefersDark` is true only for `prefers-color-scheme: dark`. */
export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') {
    return preference
  }
  return prefersDark ? 'dark' : 'light'
}

export function readInitialResolvedTheme(): ResolvedTheme {
  if (typeof document === 'undefined') {
    return 'light'
  }
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}
