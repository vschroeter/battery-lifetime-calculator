import { describe, expect, it } from 'vitest'
import { calculate } from '@/lib/calc'
import type { BatteryConfig, Phase } from '@/types/calculator'

const battery: BatteryConfig = {
  capacity_mAh: 1000,
  usablePercent: 80,
  selfDischargePercentPerMonth: 0,
}

const phases: Phase[] = [
  {
    id: 'active-1',
    name: 'Active',
    isDeepSleep: false,
    current: 80,
    currentUnit: 'mA',
    duration: 0.2,
    durationUnit: 's',
    frequency: 1,
    frequencyUnit: 'perHour',
  },
  {
    id: 'deepsleep-1',
    name: 'DeepSleep',
    isDeepSleep: true,
    current: 0.01,
    currentUnit: 'mA',
    duration: 0,
    durationUnit: 's',
    frequency: 0,
    frequencyUnit: 'perHour',
  },
]

describe('calculate leakage and self-discharge', () => {
  it('keeps a 20 nA leakage source in the result', () => {
    const result = calculate(battery, phases, [
      { id: 'probe', label: 'probe', current: 20, currentUnit: 'nA' },
    ])

    const leakage = result.phaseResults.find((phase) => phase.phaseId === 'leakage-currents-virtual')
    expect(leakage).toBeDefined()
    expect(leakage!.mAhPerDay).toBeCloseTo((20 / 1_000_000) * 24, 12)
    expect(leakage!.mAhPerDay).toBeLessThan(0.001)
    expect(leakage!.leakageSources).toEqual([
      {
        id: 'probe',
        label: 'probe',
        mAhPerDay: leakage!.mAhPerDay,
      },
    ])
  })

  it('keeps every source on the leakage total and leaves them out of the daily sum', () => {
    const result = calculate(battery, phases, [
      { id: 'ldo', label: 'LDO', current: 1, currentUnit: 'mA' },
      { id: 'off', label: '', current: 0, currentUnit: 'µA' },
    ])

    const leakage = result.phaseResults.find((phase) => phase.phaseId === 'leakage-currents-virtual')
    expect(leakage!.mAhPerDay).toBeCloseTo(24, 6)
    expect(leakage!.leakageSources).toEqual([
      { id: 'ldo', label: 'LDO', mAhPerDay: 24 },
      { id: 'off', label: '', mAhPerDay: 0 },
    ])
    expect(result.phaseResults.map((row) => row.phaseId)).not.toContain('ldo')
    const summed = result.phaseResults.reduce((sum, row) => sum + row.mAhPerDay, 0)
    expect(result.totalmAhPerDay).toBeCloseTo(summed, 9)
  })

  it('omits leakage when every source is 0', () => {
    const result = calculate(battery, phases, [
      { id: 'off', label: 'LDO', current: 0, currentUnit: 'µA' },
    ])

    expect(result.phaseResults.some((row) => row.phaseId === 'leakage-currents-virtual')).toBe(false)
  })

  it('keeps a self-discharge contribution below 0.001 mAh/day', () => {
    const result = calculate(
      {
        capacity_mAh: 10,
        usablePercent: 100,
        selfDischargePercentPerMonth: 0.01,
      },
      [
        {
          id: 'load',
          name: 'Load',
          isDeepSleep: false,
          current: 1,
          currentUnit: 'mA',
          duration: 1,
          durationUnit: 'h',
          frequency: 24,
          frequencyUnit: 'perDay',
        },
        {
          id: 'sleep',
          name: 'DeepSleep',
          isDeepSleep: true,
          current: 0,
          currentUnit: 'mA',
          duration: 0,
          durationUnit: 's',
          frequency: 0,
          frequencyUnit: 'perHour',
        },
      ],
    )

    const selfDischarge = result.phaseResults.find((phase) => phase.phaseId === 'self-discharge-virtual')
    expect(selfDischarge).toBeDefined()
    expect(selfDischarge!.mAhPerDay).toBeGreaterThan(0)
    expect(selfDischarge!.mAhPerDay).toBeLessThan(0.001)
  })
})

function phase(overrides: Partial<Phase> & Pick<Phase, 'id' | 'name'>): Phase {
  return {
    isDeepSleep: false,
    current: 10,
    currentUnit: 'mA',
    duration: 1,
    durationUnit: 'h',
    frequency: 1,
    frequencyUnit: 'perDay',
    ...overrides,
  }
}

const sleep = phase({
  id: 'sleep',
  name: 'DeepSleep',
  isDeepSleep: true,
  current: 0.01,
  duration: 0,
  frequency: 0,
})

describe('day budget', () => {
  it('bills a 36 h event once a week as its daily average', () => {
    const result = calculate(battery, [
      phase({
        id: 'long',
        name: 'Long',
        duration: 36,
        durationUnit: 'h',
        frequency: 1,
        frequencyUnit: 'perWeek',
      }),
      sleep,
    ])

    expect(result.errors).toEqual([])
    expect(result.dayBudgetExceeded).toBe(false)
    expect(result.activeTimePerDaySeconds).toBeCloseTo((36 * 3600) / 7, 6)
    expect(result.runtimeDays).toBeGreaterThan(0)
    const deepSleep = result.phaseResults.find((row) => row.phaseId === 'sleep')
    expect(deepSleep!.activeTimePerDaySeconds).toBeCloseTo(86400 - (36 * 3600) / 7, 3)
  })

  it('keeps a day that lands within 1 ms of 24 h and shows a zero remainder', () => {
    const result = calculate(battery, [
      phase({
        id: 'full',
        name: 'Full',
        duration: 86400.001,
        durationUnit: 's',
        frequency: 1,
        frequencyUnit: 'perDay',
      }),
      { ...sleep, current: 0 },
    ])

    expect(result.dayBudgetExceeded).toBe(false)
    expect(result.runtimeDays).toBeGreaterThan(0)
    const deepSleep = result.phaseResults.find((row) => row.phaseId === 'sleep')
    expect(deepSleep).toMatchObject({ mAhPerDay: 0, activeTimePerDaySeconds: 0 })
    expect(result.phaseResults.some((row) => row.phaseId === 'self-discharge-virtual')).toBe(false)
  })

  it('withholds the lifetime when two 13 h phases exceed the day, and still lists leakage', () => {
    const result = calculate(
      battery,
      [
        phase({ id: 'a', name: 'A', duration: 13, durationUnit: 'h' }),
        phase({ id: 'b', name: 'B', duration: 13, durationUnit: 'h' }),
        sleep,
      ],
      [{ id: 'leak', label: 'probe', current: 1, currentUnit: 'µA' }],
    )

    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
    expect(result.dayBudgetExceeded).toBe(true)
    expect(result.activeTimePerDaySeconds).toBe(26 * 3600)
    expect(result.runtimeDays).toBe(0)
    expect(result.totalmAhPerDay).toBe(0)
    expect(result.phaseResults.map((row) => row.phaseId)).toEqual(['a', 'b', 'leakage-currents-virtual'])
    expect(result.phaseResults[0]!.mAhPerDay).toBeCloseTo(10 * 13, 6)
    expect(result.phaseResults[1]!.mAhPerDay).toBeCloseTo(10 * 13, 6)
  })

  it('treats 2 ms over 24 h as an open day', () => {
    const result = calculate(battery, [
      phase({
        id: 'over',
        name: 'Over',
        duration: 86400.002,
        durationUnit: 's',
      }),
      sleep,
    ])

    expect(result.dayBudgetExceeded).toBe(true)
    expect(result.runtimeDays).toBe(0)
  })

  it('returns no rows when the deep-sleep count is not one', () => {
    const missing = calculate(battery, [phase({ id: 'a', name: 'A' })])
    expect(missing.errors).toContain('Exactly one DeepSleep phase is required.')
    expect(missing.phaseResults).toEqual([])
    expect(missing.dayBudgetExceeded).toBe(false)

    const extra = calculate(battery, [
      phase({ id: 'a', name: 'A', duration: 13, durationUnit: 'h' }),
      sleep,
      { ...sleep, id: 'sleep-2' },
    ])
    expect(extra.phaseResults).toEqual([])
    expect(extra.runtimeDays).toBe(0)
  })

  it('lets a field error hide an over-budget day', () => {
    const result = calculate(battery, [
      phase({ id: 'a', name: 'A', duration: 13, durationUnit: 'h', current: -1 }),
      phase({ id: 'b', name: 'B', duration: 13, durationUnit: 'h' }),
      sleep,
    ])

    expect(result.phaseResults).toEqual([])
    expect(result.dayBudgetExceeded).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('keeps a zero-current phase in the day budget', () => {
    const result = calculate(battery, [
      phase({ id: 'a', name: 'A', duration: 13, durationUnit: 'h', current: 0 }),
      phase({ id: 'b', name: 'B', duration: 13, durationUnit: 'h' }),
      sleep,
    ])

    expect(result.errors).toEqual([])
    expect(result.dayBudgetExceeded).toBe(true)
    expect(result.phaseResults.map((row) => row.phaseId)).toEqual(['a', 'b'])
    expect(result.phaseResults[0]!.mAhPerDay).toBe(0)
  })

  it('rejects a negative leakage current', () => {
    const result = calculate(battery, phases, [
      { id: 'leak', label: 'probe', current: -1, currentUnit: 'µA' },
    ])

    expect(result.phaseResults).toEqual([])
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
