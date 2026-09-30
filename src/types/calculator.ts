export type CurrentUnit = 'nA' | 'µA' | 'mA' | 'A'
export type DurationUnit = 'ms' | 's' | 'min' | 'h'
export type FrequencyUnit = 'perHour' | 'perDay' | 'perWeek'

export interface BatteryConfig {
  capacity_mAh: number
  usablePercent: number
  selfDischargePercentPerMonth: number
}

export interface Phase {
  id: string
  name: string
  isDeepSleep: boolean
  current: number
  currentUnit: CurrentUnit
  duration: number
  durationUnit: DurationUnit
  frequency: number
  frequencyUnit: FrequencyUnit
}

export interface LeakageCurrent {
  id: string
  label: string
  current: number
  currentUnit: CurrentUnit
}

export interface CalculatorState {
  battery: BatteryConfig
  phases: Phase[]
  leakageCurrents: LeakageCurrent[]
}

/** One entered leakage source. Present on the leakage total, and not a separate share of the day. */
export interface LeakageSourceResult {
  id: string
  label: string
  mAhPerDay: number
}

export interface PhaseResult {
  phaseId: string
  phaseName: string
  mAhPerDay: number
  eventsPerDay: number
  activeTimePerDaySeconds: number
  /**
   * Entered leakage sources, in editor order, including a source at 0.
   * Only the parent `mAhPerDay` is part of the daily total.
   */
  leakageSources?: LeakageSourceResult[]
}

export interface CalculationResult {
  phaseResults: PhaseResult[]
  totalmAhPerDay: number
  averageCurrent_mA: number
  runtimeDays: number
  runtimeWeeks: number
  runtimeMonths: number
  runtimeYears: number
  errors: string[]
  warnings: string[]
  /**
   * True when the sum of active-phase daily averages exceeds 24 h by more than 1 ms.
   * Phase rows stay; lifetime aggregates stay at 0. This is separate from `errors`.
   */
  dayBudgetExceeded: boolean
  /** Sum of active-phase daily averages, in seconds. Deep sleep and leakage are not included. */
  activeTimePerDaySeconds: number
}

