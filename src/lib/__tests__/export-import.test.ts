import { describe, expect, it } from 'vitest'
import { calculate } from '@/lib/calc'
import { buildResultsCsv, CONFIG_FORMAT_VERSION, serializeConfig, type CsvLabels } from '@/lib/export'
import { ConfigImportError, importConfigFromJSON } from '@/lib/import'
import type { BatteryConfig, CalculatorState, Phase } from '@/types/calculator'

const labels: CsvLabels = {
  metric: 'Metric',
  value: 'Value',
  unit: 'Unit',
  capacity: 'Capacity',
  usableCapacity: 'Usable Capacity',
  selfDischarge: 'Self-Discharge',
  averageCurrent: 'Average Current',
  consumptionPerDay: 'Consumption per Day',
  runtime: 'Estimated Runtime',
  days: 'days',
  weeks: 'weeks',
  months: 'months',
  years: 'years',
  phase: 'Phase',
  eventsPerDay: 'Events/day',
  activeTimePerDay: 'Active Time/day',
  notAvailable: 'N/A',
  auto: 'Auto',
  unitMilliampHours: 'mAh',
  unitPercent: '%',
  unitPercentPerMonth: '%/month',
}

const battery: BatteryConfig = {
  capacity_mAh: 1000,
  usablePercent: 80,
  selfDischargePercentPerMonth: 1,
}

const phases: Phase[] = [
  {
    id: 'active-1',
    name: 'Say "hi"',
    isDeepSleep: false,
    current: 80,
    currentUnit: 'mA',
    duration: 0.2,
    durationUnit: 's',
    frequency: 1,
    frequencyUnit: 'perHour',
  },
  {
    id: 'formula',
    name: '=2+2',
    isDeepSleep: false,
    current: 1,
    currentUnit: 'mA',
    duration: 1,
    durationUnit: 's',
    frequency: 1,
    frequencyUnit: 'perDay',
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

describe('buildResultsCsv', () => {
  const result = calculate(battery, phases, [])
  const csv = buildResultsCsv(result, battery, labels)

  it('includes battery settings and years', () => {
    expect(csv).toContain('"Capacity","1000","mAh"')
    expect(csv).toContain('"Usable Capacity","80","%"')
    expect(csv).toContain('"Self-Discharge","1","%/month"')
    expect(csv).toContain('"years"')
    expect(csv).not.toContain('0.00 h')
  })

  it('escapes quotes and neutralizes formula names', () => {
    expect(csv).toContain('"Say ""hi"""')
    expect(csv).toContain(`"'=2+2"`)
  })
})

function stateJson(state: CalculatorState, version?: number): string {
  return JSON.stringify(version === undefined ? state : { version, ...state })
}

const state: CalculatorState = {
  battery,
  phases: phases.slice(0, 1).concat(phases[2]!),
  leakageCurrents: [],
}

describe('importConfigFromJSON', () => {
  it('accepts a versioned file and a legacy file without a version', () => {
    const versioned = importConfigFromJSON(stateJson(state, CONFIG_FORMAT_VERSION))
    const legacy = importConfigFromJSON(stateJson(state))

    expect(versioned.state.battery.capacity_mAh).toBe(1000)
    expect(legacy.state.phases).toHaveLength(2)
  })

  it('rejects an unsupported format version with a translatable code', () => {
    expect(() => importConfigFromJSON(stateJson(state, 99))).toThrow(ConfigImportError)
    try {
      importConfigFromJSON(stateJson(state, 99))
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigImportError)
      expect((error as ConfigImportError).code).toBe('importUnsupportedVersion')
    }
  })

  it('rejects invalid JSON with a translatable code', () => {
    expect(() => importConfigFromJSON('{')).toThrow(ConfigImportError)
    try {
      importConfigFromJSON('{')
    } catch (error) {
      expect((error as ConfigImportError).code).toBe('importInvalidJson')
    }
  })

  it('round-trips the serialized config', () => {
    const imported = importConfigFromJSON(serializeConfig(state))
    expect(imported.state.battery).toEqual(state.battery)
    expect(imported.state.phases.map((phase) => phase.name)).toEqual(['Say "hi"', 'DeepSleep'])
    expect(imported.notices).toEqual([])
  })
})
