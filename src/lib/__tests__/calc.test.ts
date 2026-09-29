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
      ],
    )

    const selfDischarge = result.phaseResults.find((phase) => phase.phaseId === 'self-discharge-virtual')
    expect(selfDischarge).toBeDefined()
    expect(selfDischarge!.mAhPerDay).toBeGreaterThan(0)
    expect(selfDischarge!.mAhPerDay).toBeLessThan(0.001)
  })
})
