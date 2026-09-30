import { describe, expect, it } from 'vitest'
import { parseThemePreference, resolveTheme } from '@/lib/themePreference'

describe('parseThemePreference', () => {
  it('keeps system, light, and dark', () => {
    expect(parseThemePreference('system')).toBe('system')
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('dark')).toBe('dark')
  })

  it('treats anything else as system', () => {
    expect(parseThemePreference(null)).toBe('system')
    expect(parseThemePreference('')).toBe('system')
    expect(parseThemePreference('auto')).toBe('system')
  })
})

describe('resolveTheme', () => {
  it('follows an explicit light or dark choice', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('follows the OS for system, and uses light when the OS is not dark', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})
