import { describe, expect, it } from 'vitest'
import { evaluateProfile, legalSnapshot, phaseFieldKey } from '@/lib/fields'
import type { CalculatorState } from '@/types/calculator'

function state(overrides: Partial<CalculatorState> = {}): CalculatorState {
  return {
    battery: {
      capacity_mAh: 1000,
      usablePercent: 80,
      selfDischargePercentPerMonth: 0,
    },
    phases: [
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
    ],
    leakageCurrents: [],
    ...overrides,
  }
}

describe('evaluateProfile', () => {
  it('substitutes the last legal value and still calculates', () => {
    const legal = legalSnapshot(state())
    const edited = state()
    edited.phases[0]!.current = -5

    const evaluated = evaluateProfile(edited, legal)

    expect(evaluated.withheld).toBe(false)
    expect(evaluated.issues).toEqual([
      { key: phaseFieldKey('active-1', 'current'), rule: 'nonNegative' },
    ])
    expect(evaluated.model?.phases[0]!.current).toBe(80)
    expect(edited.phases[0]!.current).toBe(-5)
  })

  it('withholds when an illegal field has no last legal value', () => {
    const edited = state()
    edited.battery.capacity_mAh = 0

    const evaluated = evaluateProfile(edited, {})

    expect(evaluated.withheld).toBe(true)
    expect(evaluated.model).toBeNull()
    expect(evaluated.issues.map((issue) => issue.key)).toContain('battery.capacity')
  })

  it('accepts zero current on an active phase', () => {
    const edited = state()
    edited.phases[0]!.current = 0
    const evaluated = evaluateProfile(edited, legalSnapshot(state()))

    expect(evaluated.issues).toEqual([])
    expect(evaluated.model?.phases[0]!.current).toBe(0)
  })
})
