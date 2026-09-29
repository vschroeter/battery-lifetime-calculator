import { describe, expect, it } from 'vitest'
import { formatCanonical, parseDraft } from '@/lib/numericInput'

describe('parseDraft', () => {
  it('keeps a trailing zero after the separator as the number 0', () => {
    expect(parseDraft('0,0')).toEqual({ status: 'number', value: 0 })
    expect(parseDraft('0.0')).toEqual({ status: 'number', value: 0 })
  })

  it('holds a trailing separator', () => {
    expect(parseDraft('0,')).toEqual({ status: 'unfinished' })
    expect(parseDraft('0.')).toEqual({ status: 'unfinished' })
    expect(parseDraft('-')).toEqual({ status: 'unfinished' })
    expect(parseDraft('.')).toEqual({ status: 'unfinished' })
  })

  it('reads a finished decimal in either separator', () => {
    expect(parseDraft('0,01')).toEqual({ status: 'number', value: 0.01 })
    expect(parseDraft('-1')).toEqual({ status: 'number', value: -1 })
  })

  it('treats an empty field as empty', () => {
    expect(parseDraft('')).toEqual({ status: 'empty' })
    expect(parseDraft('   ')).toEqual({ status: 'empty' })
  })
})

describe('formatCanonical', () => {
  it('collapses a zero decimal on blur', () => {
    expect(formatCanonical(0, 'de')).toBe('0')
    expect(formatCanonical(0, 'en')).toBe('0')
  })

  it('uses the app locale separator', () => {
    expect(formatCanonical(0.01, 'de')).toBe('0,01')
    expect(formatCanonical(0.01, 'en')).toBe('0.01')
  })
})
