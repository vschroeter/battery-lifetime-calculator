import type { Locale } from '@/i18n/messages'

export type ParsedDraft =
  | { status: 'empty' }
  | { status: 'unfinished' }
  | { status: 'number'; value: number }

/**
 * A trailing separator or exponent marker is still being typed.
 * "0,0" and "0.0" are already the number 0.
 */
export function parseDraft(raw: string): ParsedDraft {
  const text = raw.trim()
  if (text === '') {
    return { status: 'empty' }
  }
  if (isUnfinished(text)) {
    return { status: 'unfinished' }
  }

  const normalized = text.replace(',', '.')
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) {
    return { status: 'unfinished' }
  }

  const value = Number(normalized)
  if (!Number.isFinite(value)) {
    return { status: 'unfinished' }
  }
  return { status: 'number', value }
}

function isUnfinished(text: string): boolean {
  if (/^[+-]?[.,]?$/.test(text)) {
    return true
  }
  if (/[.,]$/.test(text)) {
    return true
  }
  if (/[eE][+-]?$/.test(text)) {
    return true
  }
  return false
}

export function formatCanonical(value: number, locale: Locale): string {
  if (!Number.isFinite(value)) {
    return '0'
  }

  const tag = locale === 'de' ? 'de-DE' : 'en-US'
  const abs = Math.abs(value)
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e15)) {
    return value.toLocaleString(tag, {
      maximumSignificantDigits: 15,
      useGrouping: false,
      notation: 'scientific',
    })
  }

  return value.toLocaleString(tag, {
    maximumFractionDigits: 12,
    useGrouping: false,
  })
}
