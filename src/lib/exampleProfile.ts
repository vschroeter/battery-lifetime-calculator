import type { CalculatorState } from '@/types/calculator'

/** The profile shown when the address has no configuration hash. */
export function createExampleProfile(): CalculatorState {
  return {
    battery: {
      capacity_mAh: 1000,
      usablePercent: 80,
      selfDischargePercentPerMonth: 0,
      efficiencyPercent: 100,
      chemistryId: null,
      cellId: null,
      efficiencyPresetId: 'at-battery',
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
        frequencyUnit: 'everyHour',
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
  }
}
