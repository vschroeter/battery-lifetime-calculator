import type {
  BatteryConfig,
  CalculatorState,
  CurrentUnit,
  DurationUnit,
  FrequencyUnit,
  LeakageCurrent,
  Phase,
} from '@/types/calculator'

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
const FREQUENCY_UNITS = new Set<FrequencyUnit>(['perHour', 'perDay', 'perWeek'])

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
  return typeof value === 'string' && FREQUENCY_UNITS.has(value as FrequencyUnit)
}

function parseBatteryConfig(value: unknown): BatteryConfig {
  if (!isRecord(value)) {
    throw new Error('Battery configuration is missing or invalid.')
  }

  const { capacity_mAh, usablePercent, selfDischargePercentPerMonth } = value

  if (
    !isFiniteNumber(capacity_mAh) ||
    !isFiniteNumber(usablePercent) ||
    !isFiniteNumber(selfDischargePercentPerMonth)
  ) {
    throw new Error('Battery configuration contains invalid numeric values.')
  }

  return {
    capacity_mAh,
    usablePercent,
    selfDischargePercentPerMonth,
  }
}

function parsePhase(value: unknown, index: number): Phase {
  if (!isRecord(value)) {
    throw new Error(`Phase ${index + 1} is invalid.`)
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
    throw new Error(`Phase ${index + 1} contains invalid values.`)
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
  }
}

function parseLeakageCurrent(value: unknown, index: number): LeakageCurrent {
  if (!isRecord(value)) {
    throw new Error(`Leakage current ${index + 1} is invalid.`)
  }

  const { id, label, current, currentUnit } = value

  if (
    typeof id !== 'string' ||
    typeof label !== 'string' ||
    !isFiniteNumber(current) ||
    !isCurrentUnit(currentUnit)
  ) {
    throw new Error(`Leakage current ${index + 1} contains invalid values.`)
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
    throw new Error('The selected file is not valid JSON.')
  }

  if (!isRecord(parsed)) {
    throw new Error('The selected file does not contain a calculator configuration.')
  }

  const { battery, phases, leakageCurrents } = parsed

  if (!Array.isArray(phases) || !Array.isArray(leakageCurrents)) {
    throw new Error('The selected file does not match the exported configuration format.')
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
  }

  return {
    state: nextState,
    notices,
  }
}
