import { decode, encode } from '@msgpack/msgpack'
import {
  decodeCell,
  decodeChemistry,
  decodeEfficiencyPreset,
  efficiencyPresetById,
  encodeCell,
  encodeChemistry,
  encodeEfficiencyPreset,
  isLegacyBatteryEncoding,
} from '@/lib/batteryPresets'
import { FREQUENCY_UNITS } from '@/lib/units'
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
/**
 * Layout version for the link. Independent of the JSON file version.
 * Schema 1 still accepts the original 3-number battery. That short form is
 * 100% efficiency, Custom chemistry, and the “already at the battery” preset.
 * Any other preset state is a 7-number battery on the same schema.
 */
const HASH_SCHEMA = 1

const CURRENT_UNITS = ['nA', 'µA', 'mA', 'A'] as const satisfies readonly CurrentUnit[]
const DURATION_UNITS = ['ms', 's', 'min', 'h'] as const satisfies readonly DurationUnit[]
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
    ) &&
    (left.leakageEnabled !== false) === (right.leakageEnabled !== false)
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
  const positional: unknown[] = [
    HASH_SCHEMA,
    batteryPositional(state.battery),
    state.phases.map((phase) => {
      const head: unknown[] = [
        phase.name,
        phase.isDeepSleep ? 1 : 0,
        phase.current,
        unitCode(CURRENT_UNITS, phase.currentUnit),
      ]
      const row = phase.isDeepSleep
        ? head
        : [
            ...head,
            phase.duration,
            unitCode(DURATION_UNITS, phase.durationUnit),
            phase.frequency,
            unitCode(FREQUENCY_UNITS, phase.frequencyUnit),
          ]
      if (phase.enabled === false) {
        row.push(0)
      }
      return row
    }),
    state.leakageCurrents.map((leakage) => [
      leakage.label,
      leakage.current,
      unitCode(CURRENT_UNITS, leakage.currentUnit),
    ]),
  ]
  if (state.leakageEnabled === false) {
    positional.push(0)
  }
  return positional
}

function expandPositional(value: unknown): CalculatorState {
  if (!Array.isArray(value) || (value.length !== 4 && value.length !== 5)) {
    throw new ConfigImportError('importInvalidJson')
  }

  const [schema, battery, phases, leakages] = value
  if (schema !== HASH_SCHEMA) {
    throw new ConfigImportError('importUnsupportedVersion')
  }
  if (
    !Array.isArray(battery) ||
    (battery.length !== 3 && battery.length !== 7) ||
    !Array.isArray(phases) ||
    !Array.isArray(leakages)
  ) {
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
    battery: expandBattery(
      capacity_mAh,
      usablePercent,
      selfDischargePercentPerMonth,
      battery,
    ),
    phases: phases.map((row, index) => expandPhase(row, index)),
    leakageCurrents: leakages.map((row, index) => expandLeakage(row, index)),
    leakageEnabled: value.length === 5 ? value[4] !== 0 : true,
  }
}

function expandPhase(row: unknown, index: number): Phase {
  if (!Array.isArray(row) || ![4, 5, 8, 9].includes(row.length)) {
    throw new ConfigImportError('importInvalidPhase', { index: String(index + 1) })
  }

  const [name, sleepFlag, current, currentUnitCode] = row
  const isDeepSleep = sleepFlag === 1 || sleepFlag === true
  if (typeof name !== 'string' || !isFiniteNumber(current) || (sleepFlag !== 0 && sleepFlag !== 1 && sleepFlag !== false && sleepFlag !== true)) {
    throw new ConfigImportError('importInvalidPhaseValues', { index: String(index + 1) })
  }

  const currentUnit = unitAt(CURRENT_UNITS, currentUnitCode, index, 'importInvalidPhaseValues')
  if (isDeepSleep && (row.length === 4 || row.length === 5)) {
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
      enabled: row.length === 5 ? row[4] !== 0 : true,
    }
  }

  if (row.length !== 8 && row.length !== 9) {
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
    enabled: row.length === 9 ? row[8] !== 0 : true,
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

function batteryPositional(battery: BatteryConfig): number[] {
  const head = [
    battery.capacity_mAh,
    battery.usablePercent,
    battery.selfDischargePercentPerMonth,
  ]
  if (isLegacyBatteryEncoding(battery)) {
    return head
  }
  return [
    ...head,
    battery.efficiencyPercent,
    encodeChemistry(battery.chemistryId),
    encodeCell(battery.chemistryId, battery.cellId),
    encodeEfficiencyPreset(battery.efficiencyPresetId),
  ]
}

function expandBattery(
  capacity_mAh: number,
  usablePercent: number,
  selfDischargePercentPerMonth: number,
  battery: unknown[],
): BatteryConfig {
  if (battery.length === 3) {
    return {
      capacity_mAh,
      usablePercent,
      selfDischargePercentPerMonth,
      efficiencyPercent: 100,
      chemistryId: null,
      cellId: null,
      efficiencyPresetId: 'at-battery',
    }
  }

  const efficiencyPercent = battery[3]
  const chemistryCode = battery[4]
  const cellCode = battery[5]
  const presetCode = battery[6]
  if (
    !isFiniteNumber(efficiencyPercent) ||
    typeof chemistryCode !== 'number' ||
    typeof cellCode !== 'number' ||
    typeof presetCode !== 'number'
  ) {
    throw new ConfigImportError('importInvalidBatteryNumbers')
  }

  const chemistryId = decodeChemistry(chemistryCode)
  const cellId = chemistryId === undefined ? undefined : decodeCell(chemistryId, cellCode)
  let efficiencyPresetId = decodeEfficiencyPreset(presetCode)
  if (chemistryId === undefined || cellId === undefined || efficiencyPresetId === undefined) {
    throw new ConfigImportError('importInvalidBattery')
  }
  if (
    efficiencyPresetId !== null &&
    efficiencyPresetById(efficiencyPresetId).percent !== efficiencyPercent
  ) {
    efficiencyPresetId = null
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

function batteryEqual(left: BatteryConfig, right: BatteryConfig): boolean {
  return (
    left.capacity_mAh === right.capacity_mAh &&
    left.usablePercent === right.usablePercent &&
    left.selfDischargePercentPerMonth === right.selfDischargePercentPerMonth &&
    left.efficiencyPercent === right.efficiencyPercent &&
    left.chemistryId === right.chemistryId &&
    left.cellId === right.cellId &&
    left.efficiencyPresetId === right.efficiencyPresetId
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
    left.frequencyUnit === right.frequencyUnit &&
    (left.enabled !== false) === (right.enabled !== false)
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
