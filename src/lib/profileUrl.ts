import { decode, encode } from '@msgpack/msgpack'
import { ConfigImportError, importConfigFromJSON, type ImportNotice } from '@/lib/import'
import type {
  BatteryConfig,
  CalculatorState,
  CurrentUnit,
  DurationUnit,
  FrequencyUnit,
  LeakageCurrent,
  Phase,
} from '@/types/calculator'

const HASH_KEY = 'cfg='
/** Layout version for the link. Independent of the JSON file version. */
const HASH_SCHEMA = 1

const CURRENT_UNITS = ['nA', 'µA', 'mA', 'A'] as const satisfies readonly CurrentUnit[]
const DURATION_UNITS = ['ms', 's', 'min', 'h'] as const satisfies readonly DurationUnit[]
const FREQUENCY_UNITS = ['perHour', 'perDay', 'perWeek'] as const satisfies readonly FrequencyUnit[]

const SLEEP_DURATION = 0
const SLEEP_DURATION_UNIT: DurationUnit = 's'
const SLEEP_FREQUENCY = 0
const SLEEP_FREQUENCY_UNIT: FrequencyUnit = 'perHour'

export interface DecodedProfile {
  state: CalculatorState
  notices: ImportNotice[]
  /** True when import dropped, added, or rewrote something in the payload. */
  changedByParser: boolean
}

export function profilesEqual(left: CalculatorState, right: CalculatorState): boolean {
  return (
    batteryEqual(left.battery, right.battery) &&
    left.phases.length === right.phases.length &&
    left.phases.every((phase, index) => phaseEqual(phase, right.phases[index]!)) &&
    left.leakageCurrents.length === right.leakageCurrents.length &&
    left.leakageCurrents.every((leakage, index) =>
      leakageEqual(leakage, right.leakageCurrents[index]!),
    )
  )
}

/**
 * Hash fragment for a profile, including the leading `#`.
 * MessagePack of a positional layout, then URL-safe base64.
 * Phase and leakage ids are not stored; row order is the identity.
 */
export function encodeProfileHash(state: CalculatorState): string {
  return `#${HASH_KEY}${encodeProfileValue(toPositional(state))}`
}

/** URL-safe token for a MessagePack value. */
export function encodeProfileValue(value: unknown): string {
  return bytesToToken(encode(value))
}

/** Returns the base64 payload, or null when the hash is not a profile link. */
export function profileTokenFromHash(hash: string): string | null {
  const body = hash.startsWith('#') ? hash.slice(1) : hash
  if (!body.startsWith(HASH_KEY)) {
    return null
  }
  return body.slice(HASH_KEY.length)
}

export function decodeProfileToken(token: string): DecodedProfile {
  const expanded = expandPositional(decodeProfileValue(token))
  const imported = importConfigFromJSON(JSON.stringify(expanded))

  return {
    state: imported.state,
    notices: imported.notices,
    changedByParser: !profilesEqual(expanded, imported.state),
  }
}

function toPositional(state: CalculatorState): unknown[] {
  return [
    HASH_SCHEMA,
    [
      state.battery.capacity_mAh,
      state.battery.usablePercent,
      state.battery.selfDischargePercentPerMonth,
    ],
    state.phases.map((phase) => {
      const head: unknown[] = [
        phase.name,
        phase.isDeepSleep ? 1 : 0,
        phase.current,
        unitCode(CURRENT_UNITS, phase.currentUnit),
      ]
      if (phase.isDeepSleep) {
        return head
      }
      return [
        ...head,
        phase.duration,
        unitCode(DURATION_UNITS, phase.durationUnit),
        phase.frequency,
        unitCode(FREQUENCY_UNITS, phase.frequencyUnit),
      ]
    }),
    state.leakageCurrents.map((leakage) => [
      leakage.label,
      leakage.current,
      unitCode(CURRENT_UNITS, leakage.currentUnit),
    ]),
  ]
}

function expandPositional(value: unknown): CalculatorState {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new ConfigImportError('importInvalidJson')
  }

  const [schema, battery, phases, leakages] = value
  if (schema !== HASH_SCHEMA) {
    throw new ConfigImportError('importUnsupportedVersion')
  }
  if (!Array.isArray(battery) || battery.length !== 3 || !Array.isArray(phases) || !Array.isArray(leakages)) {
    throw new ConfigImportError('importInvalidJson')
  }

  const [capacity_mAh, usablePercent, selfDischargePercentPerMonth] = battery
  if (
    !isFiniteNumber(capacity_mAh) ||
    !isFiniteNumber(usablePercent) ||
    !isFiniteNumber(selfDischargePercentPerMonth)
  ) {
    throw new ConfigImportError('importInvalidBatteryNumbers')
  }

  return {
    battery: { capacity_mAh, usablePercent, selfDischargePercentPerMonth },
    phases: phases.map((row, index) => expandPhase(row, index)),
    leakageCurrents: leakages.map((row, index) => expandLeakage(row, index)),
  }
}

function expandPhase(row: unknown, index: number): Phase {
  if (!Array.isArray(row) || (row.length !== 4 && row.length !== 8)) {
    throw new ConfigImportError('importInvalidPhase', { index: String(index + 1) })
  }

  const [name, sleepFlag, current, currentUnitCode] = row
  const isDeepSleep = sleepFlag === 1 || sleepFlag === true
  if (typeof name !== 'string' || !isFiniteNumber(current) || (sleepFlag !== 0 && sleepFlag !== 1 && sleepFlag !== false && sleepFlag !== true)) {
    throw new ConfigImportError('importInvalidPhaseValues', { index: String(index + 1) })
  }

  const currentUnit = unitAt(CURRENT_UNITS, currentUnitCode, index, 'importInvalidPhaseValues')
  if (isDeepSleep && row.length === 4) {
    return {
      id: `phase-${index}`,
      name,
      isDeepSleep: true,
      current,
      currentUnit,
      duration: SLEEP_DURATION,
      durationUnit: SLEEP_DURATION_UNIT,
      frequency: SLEEP_FREQUENCY,
      frequencyUnit: SLEEP_FREQUENCY_UNIT,
    }
  }

  if (row.length !== 8) {
    throw new ConfigImportError('importInvalidPhase', { index: String(index + 1) })
  }

  const [, , , , duration, durationUnitCode, frequency, frequencyUnitCode] = row
  if (!isFiniteNumber(duration) || !isFiniteNumber(frequency)) {
    throw new ConfigImportError('importInvalidPhaseValues', { index: String(index + 1) })
  }

  return {
    id: `phase-${index}`,
    name,
    isDeepSleep,
    current,
    currentUnit,
    duration: isDeepSleep ? SLEEP_DURATION : duration,
    durationUnit: isDeepSleep
      ? SLEEP_DURATION_UNIT
      : unitAt(DURATION_UNITS, durationUnitCode, index, 'importInvalidPhaseValues'),
    frequency: isDeepSleep ? SLEEP_FREQUENCY : frequency,
    frequencyUnit: isDeepSleep
      ? SLEEP_FREQUENCY_UNIT
      : unitAt(FREQUENCY_UNITS, frequencyUnitCode, index, 'importInvalidPhaseValues'),
  }
}

function expandLeakage(row: unknown, index: number): LeakageCurrent {
  if (!Array.isArray(row) || row.length !== 3) {
    throw new ConfigImportError('importInvalidLeakage', { index: String(index + 1) })
  }

  const [label, current, currentUnitCode] = row
  if (typeof label !== 'string' || !isFiniteNumber(current)) {
    throw new ConfigImportError('importInvalidLeakageValues', { index: String(index + 1) })
  }

  return {
    id: `leak-${index}`,
    label,
    current,
    currentUnit: unitAt(CURRENT_UNITS, currentUnitCode, index, 'importInvalidLeakageValues'),
  }
}

function decodeProfileValue(token: string): unknown {
  try {
    return decode(tokenToBytes(token))
  } catch (error) {
    if (error instanceof ConfigImportError) {
      throw error
    }
    throw new ConfigImportError('importInvalidJson')
  }
}

function bytesToToken(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
}

function tokenToBytes(token: string): Uint8Array {
  if (token === '' || /[^A-Za-z0-9_-]/u.test(token)) {
    throw new ConfigImportError('importInvalidJson')
  }

  try {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/')
    const padLength = (4 - (padded.length % 4)) % 4
    const binary = atob(padded + '='.repeat(padLength))
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch {
    throw new ConfigImportError('importInvalidJson')
  }
}

function unitCode<T extends string>(table: readonly T[], unit: T): number {
  const code = table.indexOf(unit)
  if (code < 0) {
    throw new ConfigImportError('importInvalidJson')
  }
  return code
}

function unitAt<T extends string>(
  table: readonly T[],
  code: unknown,
  index: number,
  errorCode: 'importInvalidPhaseValues' | 'importInvalidLeakageValues',
): T {
  if (typeof code !== 'number' || !Number.isInteger(code) || code < 0 || code >= table.length) {
    throw new ConfigImportError(errorCode, { index: String(index + 1) })
  }
  return table[code]!
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function batteryEqual(left: BatteryConfig, right: BatteryConfig): boolean {
  return (
    left.capacity_mAh === right.capacity_mAh &&
    left.usablePercent === right.usablePercent &&
    left.selfDischargePercentPerMonth === right.selfDischargePercentPerMonth
  )
}

function phaseEqual(left: Phase, right: Phase): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.isDeepSleep === right.isDeepSleep &&
    left.current === right.current &&
    left.currentUnit === right.currentUnit &&
    left.duration === right.duration &&
    left.durationUnit === right.durationUnit &&
    left.frequency === right.frequency &&
    left.frequencyUnit === right.frequencyUnit
  )
}

function leakageEqual(left: LeakageCurrent, right: LeakageCurrent): boolean {
  return (
    left.id === right.id &&
    left.label === right.label &&
    left.current === right.current &&
    left.currentUnit === right.currentUnit
  )
}
