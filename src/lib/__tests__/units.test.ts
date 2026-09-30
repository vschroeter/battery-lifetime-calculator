import { describe, expect, it } from 'vitest'
import {
  convertCurrentTo_mA,
  convertDurationToHours,
  convertDurationToSeconds,
  frequencyFromEventsPerDay,
  MONTH_DAYS,
} from '@/lib/units'

describe('convertCurrentTo_mA', () => {
  it('scales amps, microamps, and nanoamps onto milliamps', () => {
    expect(convertCurrentTo_mA(2.5, 'A')).toBe(2500)
    expect(convertCurrentTo_mA(80, 'mA')).toBe(80)
    expect(convertCurrentTo_mA(500, 'µA')).toBe(0.5)
    expect(convertCurrentTo_mA(20, 'nA')).toBe(0.00002)
  })
})

describe('duration conversion', () => {
  it('turns 90 minutes into 1.5 hours and 5400 seconds', () => {
    expect(convertDurationToHours(90, 'min')).toBe(1.5)
    expect(convertDurationToSeconds(90, 'min')).toBe(5400)
  })

  it('turns 200 ms into seconds and hours', () => {
    expect(convertDurationToSeconds(200, 'ms')).toBe(0.2)
    expect(convertDurationToHours(200, 'ms')).toBeCloseTo(0.2 / 3600, 12)
  })

  it('keeps hours and expands them to seconds', () => {
    expect(convertDurationToHours(2, 'h')).toBe(2)
    expect(convertDurationToSeconds(2, 'h')).toBe(7200)
  })
})

describe('frequencyFromEventsPerDay', () => {
  it('reads 24 events per day as one per hour and one per month as 30.44 days', () => {
    expect(frequencyFromEventsPerDay(24, 'perHour')).toBe(1)
    expect(frequencyFromEventsPerDay(1, 'everyDay')).toBe(1)
    expect(frequencyFromEventsPerDay(1 / MONTH_DAYS, 'perMonth')).toBeCloseTo(1, 12)
    expect(frequencyFromEventsPerDay(1 / (2 * MONTH_DAYS), 'everyMonth')).toBeCloseTo(2, 12)
  })
})
