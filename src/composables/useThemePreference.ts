import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useTheme } from 'vuetify'
import {
  THEME_STORAGE_KEY,
  parseThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/themePreference'

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function readStoredPreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

function applyResolvedTheme(themeName: ResolvedTheme, vuetifyThemeName: { value: string }) {
  vuetifyThemeName.value = themeName
  document.documentElement.dataset.theme = themeName
  document.documentElement.style.colorScheme = themeName
}

export function useThemePreference() {
  const theme = useTheme()
  const preference = ref<ThemePreference>(readStoredPreference())

  const resolved = computed(() => theme.global.name.value as ResolvedTheme)

  function apply(next: ThemePreference = preference.value) {
    applyResolvedTheme(resolveTheme(next, prefersDark()), theme.global.name)
  }

  function setPreference(next: ThemePreference) {
    preference.value = next
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // The choice still applies for this tab when storage is unavailable.
    }
    apply(next)
  }

  function onStorage(event: StorageEvent) {
    if (event.key !== THEME_STORAGE_KEY) {
      return
    }
    preference.value = parseThemePreference(event.newValue)
    apply(preference.value)
  }

  function onColorSchemeChange() {
    if (preference.value === 'system') {
      apply('system')
    }
  }

  let media: MediaQueryList | null = null

  onMounted(() => {
    apply()
    media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', onColorSchemeChange)
    window.addEventListener('storage', onStorage)
  })

  onUnmounted(() => {
    media?.removeEventListener('change', onColorSchemeChange)
    window.removeEventListener('storage', onStorage)
  })

  return {
    preference,
    resolved,
    setPreference,
  }
}
