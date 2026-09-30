import { describe, expect, it } from 'vitest'
import { formatDutySentence, menuUnitWord, swappedDuty } from '@/lib/duty'
import { convertFrequencyToEventsPerDay, FREQUENCY_UNITS, MONTH_DAYS } from '@/lib/units'

describe('swappedDuty', () => {
  it('turns 6 per hour into every 10 minutes', () => {
    expect(swappedDuty(6, 'perHour')).toEqual({ frequency: 10, frequencyUnit: 'everyMinute' })
  })

  it('turns every 10 minutes back into 6 per hour', () => {
    expect(swappedDuty(10, 'everyMinute')).toEqual({ frequency: 6, frequencyUnit: 'perHour' })
  })

  it('rounds 7 per hour to every 8.57 minutes', () => {
    expect(swappedDuty(7, 'perHour')).toEqual({ frequency: 8.57, frequencyUnit: 'everyMinute' })
  })

  it('keeps 90 minutes in minutes', () => {
    expect(swappedDuty(16, 'perDay')).toEqual({ frequency: 90, frequencyUnit: 'everyMinute' })
  })

  it('collapses a half-week rate onto every 2 weeks', () => {
    expect(swappedDuty(0.5, 'perWeek')).toEqual({ frequency: 2, frequencyUnit: 'everyWeek' })
  })

  it('reads every hour as once per hour', () => {
    expect(swappedDuty(1, 'everyHour')).toEqual({ frequency: 1, frequencyUnit: 'perHour' })
  })

  it('opens 1 per hour as every hour', () => {
    expect(swappedDuty(1, 'perHour')).toEqual({ frequency: 1, frequencyUnit: 'everyHour' })
  })

  it('keeps 7 per hour in minutes when seconds are available', () => {
    expect(swappedDuty(7, 'perHour')).toEqual({ frequency: 8.57, frequencyUnit: 'everyMinute' })
  })

  it('uses seconds when the gap is under a minute', () => {
    expect(swappedDuty(120, 'perMinute')).toEqual({ frequency: 0.5, frequencyUnit: 'everySecond' })
  })

  it('uses two significant digits when two decimals would be zero', () => {
    expect(swappedDuty(900000, 'perHour')).toEqual({ frequency: 0.004, frequencyUnit: 'everySecond' })
  })

  it('returns nothing for an empty duty', () => {
    expect(swappedDuty(0, 'perHour')).toBeNull()
    expect(swappedDuty(Number.NaN, 'everyHour')).toBeNull()
  })
})

describe('formatDutySentence', () => {
  it('drops a bare 1 and keeps every other digit', () => {
    expect(formatDutySentence(1, 'everyHour', 'en')).toBe('every hour')
    expect(formatDutySentence(1, 'perHour', 'en')).toBe('once per hour')
    expect(formatDutySentence(1, 'everyDay', 'de')).toBe('jeder Tag')
    expect(formatDutySentence(1, 'perMonth', 'de')).toBe('einmal pro Monat')
    expect(formatDutySentence(10, 'everyMinute', 'en')).toBe('every 10 min')
    expect(formatDutySentence(8.57, 'everyMinute', 'de')).toBe('alle 8,57 min')
    expect(formatDutySentence(6, 'perHour', 'de')).toBe('6 pro Stunde')
    expect(formatDutySentence(2, 'everyDay', 'en')).toBe('every 2 days')
    expect(formatDutySentence(2, 'everyWeek', 'de')).toBe('alle 2 Wochen')
  })

  it('lists day, week, and month in the plural', () => {
    expect(menuUnitWord('everyDay', 'en')).toBe('days')
    expect(menuUnitWord('everyMonth', 'de')).toBe('Monate')
    expect(menuUnitWord('everyMinute', 'en')).toBe('min')
    expect(menuUnitWord('perWeek', 'de')).toBe('pro Woche')
  })
})

describe('frequency units', () => {
  it('keeps the original link indexes and appends the new units', () => {
    expect(FREQUENCY_UNITS.slice(0, 3)).toEqual(['perHour', 'perDay', 'perWeek'])
    expect(FREQUENCY_UNITS).toEqual([
      'perHour',
      'perDay',
      'perWeek',
      'perMonth',
      'everyMinute',
      'everyHour',
      'everyDay',
      'everyWeek',
      'everyMonth',
      'perMinute',
      'everySecond',
    ])
  })

  it('treats one every hour as 24 events per day and one per month as 1/30.44', () => {
    expect(convertFrequencyToEventsPerDay(1, 'everyHour')).toBe(24)
    expect(convertFrequencyToEventsPerDay(1, 'perHour')).toBe(24)
    expect(convertFrequencyToEventsPerDay(1, 'perMonth')).toBeCloseTo(1 / MONTH_DAYS, 12)
    expect(convertFrequencyToEventsPerDay(1, 'everyMonth')).toBeCloseTo(1 / MONTH_DAYS, 12)
    expect(convertFrequencyToEventsPerDay(2, 'everyWeek')).toBeCloseTo(1 / 14, 12)
    expect(convertFrequencyToEventsPerDay(1, 'perMinute')).toBe(1440)
    expect(convertFrequencyToEventsPerDay(1, 'everySecond')).toBe(86400)
  })
})
