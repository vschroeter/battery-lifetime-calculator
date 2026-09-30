import { describe, expect, it } from 'vitest'
import { calculate } from '@/lib/calc'
import { createExampleProfile } from '@/lib/exampleProfile'
import type { BatteryConfig, Phase } from '@/types/calculator'

const battery: BatteryConfig = createExampleProfile().battery

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

describe('example profile', () => {
  it('lasts 2307.8 days at 0.346653 mAh/day with no self-discharge', () => {
    const profile = createExampleProfile()
    const result = calculate(profile.battery, profile.phases, profile.leakageCurrents)
    const active = result.phaseResults.find((row) => row.phaseId === 'active-1')

    expect(result.errors).toEqual([])
    expect(result.dayBudgetExceeded).toBe(false)
    expect(active!.activeTimePerDaySeconds).toBeCloseTo(4.8, 9)
    expect(active!.mAhPerDay).toBeCloseTo(0.10666666666666667, 10)
    expect(result.totalmAhPerDay).toBeCloseTo(0.3466533333333333, 9)
    expect(result.runtimeDays).toBeCloseTo(2307.7810685026348, 6)
    expect(result.phaseResults.some((row) => row.phaseId === 'self-discharge-virtual')).toBe(false)
  })
})

describe('self-discharge limit', () => {
  const cell: BatteryConfig = {
    ...battery,
    capacity_mAh: 1000,
    usablePercent: 80,
    efficiencyPercent: 100,
    selfDischargePercentPerMonth: 0,
  }
  const load: Phase[] = [
    phase({
      id: 'load',
      name: 'Load',
      current: 10,
      duration: 1,
      durationUnit: 'h',
      frequency: 1,
      frequencyUnit: 'perDay',
    }),
    phase({
      id: 'sleep',
      name: 'DeepSleep',
      isDeepSleep: true,
      current: 0,
      duration: 0,
      frequency: 0,
    }),
  ]

  it('drains 800 mAh at 10 mAh/day in exactly 80 days when the rate is zero', () => {
    const result = calculate(cell, load)

    expect(result.runtimeDays).toBe(80)
    expect(result.totalmAhPerDay).toBe(10)
    expect(result.phaseResults.some((row) => row.phaseId === 'self-discharge-virtual')).toBe(false)
  })

  it('approaches 80 days from below as the monthly rate approaches zero', () => {
    const result = calculate(cell, load)
    const fading = calculate(
      { ...cell, selfDischargePercentPerMonth: 0.000001 },
      load,
    )

    expect(fading.runtimeDays).toBeLessThan(result.runtimeDays)
    expect(fading.runtimeDays).toBeCloseTo(80, 5)
    const selfDischarge = fading.phaseResults.find((row) => row.phaseId === 'self-discharge-virtual')
    expect(selfDischarge!.mAhPerDay).toBeGreaterThan(0)
    expect(selfDischarge!.mAhPerDay).toBeLessThan(0.001)
  })

  it('shortens that same load to 77.948 days at 2% per month', () => {
    const result = calculate(
      { ...cell, selfDischargePercentPerMonth: 2 },
      load,
    )

    expect(result.runtimeDays).toBeCloseTo(77.94829259445403, 8)
    expect(result.runtimeDays).toBeLessThan(80)
    const selfDischarge = result.phaseResults.find((row) => row.phaseId === 'self-discharge-virtual')
    expect(selfDischarge!.mAhPerDay).toBeCloseTo(0.26321389952958896, 8)
  })
})

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
        ...battery,
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

  it('drops a switched-off phase, deep sleep, and leakage from the load', () => {
    const on = calculate(battery, [phase({ id: 'a', name: 'A' }), sleep], [
      { id: 'leak', label: 'probe', current: 1, currentUnit: 'mA' },
    ])
    const off = calculate(
      battery,
      [
        phase({ id: 'a', name: 'A', enabled: false }),
        { ...sleep, enabled: false },
      ],
      [{ id: 'leak', label: 'probe', current: 1, currentUnit: 'mA' }],
      false,
    )

    expect(on.phaseResults.map((row) => row.phaseId)).toEqual(['a', 'sleep', 'leakage-currents-virtual'])
    expect(off.phaseResults.map((row) => row.phaseId)).toEqual(['sleep'])
    expect(off.phaseResults[0]!.mAhPerDay).toBe(0)
    expect(off.totalmAhPerDay).toBe(0)
  })

  it('scales phase charge by efficiency and leaves leakage unscaled', () => {
    const load: Phase = {
      id: 'load',
      name: 'Load',
      isDeepSleep: false,
      current: 10,
      currentUnit: 'mA',
      duration: 1,
      durationUnit: 'h',
      frequency: 1,
      frequencyUnit: 'perDay',
    }
    const sleep: Phase = {
      id: 'sleep',
      name: 'DeepSleep',
      isDeepSleep: true,
      current: 0,
      currentUnit: 'mA',
      duration: 0,
      durationUnit: 's',
      frequency: 0,
      frequencyUnit: 'perHour',
    }
    const result = calculate(
      { ...battery, efficiencyPercent: 80, efficiencyPresetId: 'buck-boost' },
      [load, sleep],
      [{ id: 'leak', label: 'probe', current: 1, currentUnit: 'mA' }],
    )

    const phase = result.phaseResults.find((row) => row.phaseId === 'load')
    const leakage = result.phaseResults.find((row) => row.phaseId === 'leakage-currents-virtual')
    expect(phase!.mAhPerDay).toBeCloseTo(12.5)
    expect(leakage!.mAhPerDay).toBeCloseTo(24)
    expect(result.totalmAhPerDay).toBeCloseTo(phase!.mAhPerDay + leakage!.mAhPerDay)
  })

  it('rejects a negative leakage current', () => {
    const result = calculate(battery, phases, [
      { id: 'leak', label: 'probe', current: -1, currentUnit: 'µA' },
    ])

    expect(result.phaseResults).toEqual([])
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
