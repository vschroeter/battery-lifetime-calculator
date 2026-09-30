import type {
  BatteryConfig,
  CalculatorState,
  ChemistryId,
  CurrentUnit,
  DurationUnit,
  EfficiencyPresetId,
  FrequencyUnit,
  LeakageCurrent,
  Phase,
} from '@/types/calculator'
import {
  efficiencyPresetById,
  findCell,
  isChemistryId,
  isEfficiencyPresetId,
} from '@/lib/batteryPresets'
import { CONFIG_FORMAT_VERSION } from '@/lib/export'
import { FREQUENCY_UNITS } from '@/lib/units'

export class ConfigImportError extends Error {
  readonly code: string
  readonly params: Record<string, string>

  constructor(code: string, params: Record<string, string> = {}) {
    super(code)
    this.name = 'ConfigImportError'
    this.code = code
    this.params = params
  }
}

export type ImportNotice =
  | { code: 'droppedDeepSleep'; count: number }
  | { code: 'addedDefaultDeepSleep' }

export interface ImportResult {
  state: CalculatorState
  notices: ImportNotice[]
}

const DEFAULT_DEEP_SLEEP: Omit<Phase, 'id'> = {
  name: 'DeepSleep',
  isDeepSleep: true,
  current: 0.01,
  currentUnit: 'mA',
  duration: 0,
  durationUnit: 's',
  frequency: 0,
  frequencyUnit: 'perHour',
}

const CURRENT_UNITS = new Set<CurrentUnit>(['nA', 'µA', 'mA', 'A'])
const DURATION_UNITS = new Set<DurationUnit>(['ms', 's', 'min', 'h'])
const FREQUENCY_UNIT_SET = new Set<FrequencyUnit>(FREQUENCY_UNITS)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isCurrentUnit(value: unknown): value is CurrentUnit {
  return typeof value === 'string' && CURRENT_UNITS.has(value as CurrentUnit)
}

function isDurationUnit(value: unknown): value is DurationUnit {
  return typeof value === 'string' && DURATION_UNITS.has(value as DurationUnit)
}

function isFrequencyUnit(value: unknown): value is FrequencyUnit {
  return typeof value === 'string' && FREQUENCY_UNIT_SET.has(value as FrequencyUnit)
}

function parseNullableId(value: unknown, known: (id: string) => boolean): string | null {
  if (value === undefined || value === null || value === '') {
    return null
  }
  if (typeof value !== 'string' || !known(value)) {
    throw new ConfigImportError('importInvalidBattery')
  }
  return value
}

/**
 * A file from before presets omits efficiency entirely and loads as 100%
 * with the “already at the battery” preset. A stored percent keeps an empty
 * preset empty, including when that percent is 100.
 */
function parseBatteryConfig(value: unknown): BatteryConfig {
  if (!isRecord(value)) {
    throw new ConfigImportError('importInvalidBattery')
  }

  const { capacity_mAh, usablePercent, selfDischargePercentPerMonth } = value

  if (
    !isFiniteNumber(capacity_mAh) ||
    !isFiniteNumber(usablePercent) ||
    !isFiniteNumber(selfDischargePercentPerMonth)
  ) {
    throw new ConfigImportError('importInvalidBatteryNumbers')
  }

  const chemistryId = parseNullableId(value.chemistryId, isChemistryId) as ChemistryId | null
  const cellId = parseNullableId(value.cellId, (id) => findCell(chemistryId, id) !== null)
  if (cellId !== null && chemistryId === null) {
    throw new ConfigImportError('importInvalidBattery')
  }

  let efficiencyPercent = 100
  let efficiencyPresetId: EfficiencyPresetId | null = 'at-battery'
  if ('efficiencyPercent' in value) {
    if (!isFiniteNumber(value.efficiencyPercent)) {
      throw new ConfigImportError('importInvalidBatteryNumbers')
    }
    efficiencyPercent = value.efficiencyPercent
    efficiencyPresetId = parseNullableId(
      value.efficiencyPresetId,
      isEfficiencyPresetId,
    ) as EfficiencyPresetId | null
    if (
      efficiencyPresetId !== null &&
      efficiencyPresetById(efficiencyPresetId).percent !== efficiencyPercent
    ) {
      efficiencyPresetId = null
    }
  }

  return {
    capacity_mAh,
    usablePercent,
    selfDischargePercentPerMonth,
    efficiencyPercent,
    chemistryId,
    cellId,
    efficiencyPresetId,
  }
}

function parsePhase(value: unknown, index: number): Phase {
  if (!isRecord(value)) {
    throw new ConfigImportError('importInvalidPhase', { index: String(index + 1) })
  }

  const {
    id,
    name,
    isDeepSleep,
    current,
    currentUnit,
    duration,
    durationUnit,
    frequency,
    frequencyUnit,
    enabled,
  } = value

  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof isDeepSleep !== 'boolean' ||
    !isFiniteNumber(current) ||
    !isCurrentUnit(currentUnit) ||
    !isFiniteNumber(duration) ||
    !isDurationUnit(durationUnit) ||
    !isFiniteNumber(frequency) ||
    !isFrequencyUnit(frequencyUnit)
  ) {
    throw new ConfigImportError('importInvalidPhaseValues', { index: String(index + 1) })
  }

  return {
    id,
    name,
    isDeepSleep,
    current,
    currentUnit,
    duration,
    durationUnit,
    frequency,
    frequencyUnit,
    enabled: typeof enabled === 'boolean' ? enabled : true,
  }
}

function parseLeakageCurrent(value: unknown, index: number): LeakageCurrent {
  if (!isRecord(value)) {
    throw new ConfigImportError('importInvalidLeakage', { index: String(index + 1) })
  }

  const { id, label, current, currentUnit } = value

  if (
    typeof id !== 'string' ||
    typeof label !== 'string' ||
    !isFiniteNumber(current) ||
    !isCurrentUnit(currentUnit)
  ) {
    throw new ConfigImportError('importInvalidLeakageValues', { index: String(index + 1) })
  }

  return {
    id,
    label,
    current,
    currentUnit,
  }
}

function nextId(prefix: 'phase' | 'leakage', used: Set<string>): string {
  let id = ''
  do {
    id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  } while (used.has(id))
  used.add(id)
  return id
}

function withUniqueIds<T extends { id: string }>(
  items: T[],
  prefix: 'phase' | 'leakage',
): T[] {
  const used = new Set<string>()

  return items.map((item) => {
    const id = item.id.trim()
    if (id !== '' && !used.has(id)) {
      used.add(id)
      return id === item.id ? item : { ...item, id }
    }

    return { ...item, id: nextId(prefix, used) }
  })
}

function keepFirstDeepSleep(phases: Phase[]): { phases: Phase[]; dropped: number } {
  let keptDeepSleep = false
  let dropped = 0
  const kept: Phase[] = []

  for (const phase of phases) {
    if (!phase.isDeepSleep) {
      kept.push(phase)
      continue
    }

    if (!keptDeepSleep) {
      keptDeepSleep = true
      kept.push(phase)
      continue
    }

    dropped += 1
  }

  return { phases: kept, dropped }
}

export function importConfigFromJSON(jsonText: string): ImportResult {
  let parsed: unknown

  // Parse the exported config file before validating its shape.
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new ConfigImportError('importInvalidJson')
  }

  if (!isRecord(parsed)) {
    throw new ConfigImportError('importNotConfig')
  }

  if ('version' in parsed && parsed.version !== CONFIG_FORMAT_VERSION) {
    throw new ConfigImportError('importUnsupportedVersion')
  }

  const { battery, phases, leakageCurrents, leakageEnabled } = parsed

  if (!Array.isArray(phases) || !Array.isArray(leakageCurrents)) {
    throw new ConfigImportError('importFormatMismatch')
  }

  const notices: ImportNotice[] = []
  const parsedPhases = phases.map((phase, index) => parsePhase(phase, index))
  const { phases: withOneDeepSleep, dropped } = keepFirstDeepSleep(parsedPhases)

  if (dropped > 0) {
    notices.push({ code: 'droppedDeepSleep', count: dropped })
  }

  if (!withOneDeepSleep.some((phase) => phase.isDeepSleep)) {
    withOneDeepSleep.push({ ...DEFAULT_DEEP_SLEEP, id: '' })
    notices.push({ code: 'addedDefaultDeepSleep' })
  }

  // Rebuild a fully typed calculator state from the exported JSON structure.
  const nextState: CalculatorState = {
    battery: parseBatteryConfig(battery),
    phases: withUniqueIds(withOneDeepSleep, 'phase'),
    leakageCurrents: withUniqueIds(
      leakageCurrents.map((leakage, index) => parseLeakageCurrent(leakage, index)),
      'leakage',
    ),
    leakageEnabled: typeof leakageEnabled === 'boolean' ? leakageEnabled : true,
  }

  return {
    state: nextState,
    notices,
  }
}
