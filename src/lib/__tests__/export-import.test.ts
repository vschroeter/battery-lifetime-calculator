import { describe, expect, it } from 'vitest'
import { calculate } from '@/lib/calc'
import { createExampleProfile } from '@/lib/exampleProfile'
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
  efficiency: 'Efficiency',
  chemistry: 'Chemistry',
  cell: 'Cell',
  chemistryValue: 'Custom',
  cellValue: 'Custom',
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
  leakageGroup: 'Leakage Currents',
  leakageSource: 'Leakage {n}',
}

const battery: BatteryConfig = {
  ...createExampleProfile().battery,
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
    expect(csv).toContain('"Efficiency","100","%"')
    expect(csv).toContain('"Chemistry","Custom",""')
    expect(csv).toContain('"Cell","Custom",""')
    expect(csv).toContain('"years"')
    expect(csv).not.toContain('0.00 h')
  })

  it('escapes quotes and neutralizes formula names', () => {
    expect(csv).toContain('"Say ""hi"""')
    expect(csv).toContain(`"'=2+2"`)
  })

  it('lists the leakage total and then each source, without a second copy of a single source', () => {
    const several = calculate(battery, phases, [
      { id: 'ldo', label: 'LDO', current: 1, currentUnit: 'µA' },
      { id: 'blank', label: '  ', current: 0, currentUnit: 'µA' },
    ])
    const csv = buildResultsCsv(several, battery, labels)
    const parentAt = csv.indexOf('"Leakage Currents","24 µAh/day","N/A","24 h"')
    const namedAt = csv.indexOf('"LDO","24 µAh/day","",""')
    const blankAt = csv.indexOf('"Leakage 2","0 nAh/day","",""')

    expect(parentAt).toBeGreaterThan(-1)
    expect(namedAt).toBeGreaterThan(parentAt)
    expect(blankAt).toBeGreaterThan(namedAt)

    const one = calculate(battery, phases, [
      { id: 'ldo', label: 'LDO', current: 1, currentUnit: 'µA' },
    ])
    const oneCsv = buildResultsCsv(one, battery, labels)
    expect(oneCsv).toContain('"LDO","24 µAh/day","N/A","24 h"')
    expect(oneCsv.match(/"LDO"/g)).toHaveLength(1)

    const silent = calculate(battery, phases, [
      { id: 'ldo', label: 'LDO', current: 0, currentUnit: 'µA' },
    ])
    expect(buildResultsCsv(silent, battery, labels)).not.toContain('Leakage')
    expect(buildResultsCsv(silent, battery, labels)).not.toContain('LDO')
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

  it('keeps an interval unit in a version 1 file', () => {
    const interval = {
      ...state,
      phases: state.phases.map((phase) =>
        phase.isDeepSleep ? phase : { ...phase, frequency: 1, frequencyUnit: 'everyHour' as const },
      ),
    }
    const imported = importConfigFromJSON(stateJson(interval, CONFIG_FORMAT_VERSION))
    expect(imported.state.phases[0]).toMatchObject({ frequency: 1, frequencyUnit: 'everyHour' })
  })

  it('loads a file from before presets as 100% already at the battery', () => {
    const legacy = JSON.parse(stateJson(state)) as {
      battery: Record<string, unknown>
    }
    delete legacy.battery.efficiencyPercent
    delete legacy.battery.chemistryId
    delete legacy.battery.cellId
    delete legacy.battery.efficiencyPresetId

    const imported = importConfigFromJSON(JSON.stringify(legacy))
    expect(imported.state.battery.efficiencyPercent).toBe(100)
    expect(imported.state.battery.efficiencyPresetId).toBe('at-battery')
    expect(imported.state.battery.chemistryId).toBeNull()
    expect(imported.state.battery.cellId).toBeNull()
  })

  it('keeps an explicit 100% with an empty preset empty', () => {
    const cleared = {
      ...state,
      battery: { ...state.battery, efficiencyPercent: 100, efficiencyPresetId: null },
    }
    const imported = importConfigFromJSON(stateJson(cleared))
    expect(imported.state.battery.efficiencyPresetId).toBeNull()
    expect(imported.state.battery.efficiencyPercent).toBe(100)
  })

  it('drops an efficiency preset that does not match its percent', () => {
    const drifted = {
      ...state,
      battery: { ...state.battery, efficiencyPercent: 91, efficiencyPresetId: 'buck' as const },
    }
    const imported = importConfigFromJSON(stateJson(drifted))
    expect(imported.state.battery.efficiencyPercent).toBe(91)
    expect(imported.state.battery.efficiencyPresetId).toBeNull()
  })

  it('drops extra deep-sleep phases and reports how many', () => {
    const extra: CalculatorState = {
      ...state,
      phases: [
        state.phases[0]!,
        state.phases[1]!,
        { ...state.phases[1]!, id: 'deepsleep-2', name: 'Second sleep' },
        { ...state.phases[1]!, id: 'deepsleep-3', name: 'Third sleep' },
      ],
    }

    const imported = importConfigFromJSON(stateJson(extra))

    expect(imported.notices).toEqual([{ code: 'droppedDeepSleep', count: 2 }])
    expect(imported.state.phases.map((phase) => phase.name)).toEqual(['Say "hi"', 'DeepSleep'])
  })

  it('adds the default deep sleep when the file has none', () => {
    const awake: CalculatorState = {
      ...state,
      phases: state.phases.filter((phase) => !phase.isDeepSleep),
    }

    const imported = importConfigFromJSON(stateJson(awake))
    const sleep = imported.state.phases.find((phase) => phase.isDeepSleep)

    expect(imported.notices).toEqual([{ code: 'addedDefaultDeepSleep' }])
    expect(sleep).toMatchObject({
      name: 'DeepSleep',
      isDeepSleep: true,
      current: 0.01,
      currentUnit: 'mA',
      duration: 0,
      durationUnit: 's',
      frequency: 0,
      frequencyUnit: 'perHour',
    })
    expect(sleep!.id).not.toBe('')
    expect(imported.state.phases.filter((phase) => phase.isDeepSleep)).toHaveLength(1)
  })

  it('round-trips the serialized config', () => {
    const imported = importConfigFromJSON(serializeConfig(state))
    expect(imported.state.battery).toEqual(state.battery)
    expect(imported.state.phases.map((phase) => phase.name)).toEqual(['Say "hi"', 'DeepSleep'])
    expect(imported.notices).toEqual([])
  })
})
