export type CurrentUnit = 'nA' | 'µA' | 'mA' | 'A'
export type DurationUnit = 'ms' | 's' | 'min' | 'h'
export type FrequencyUnit =
  | 'perMinute'
  | 'perHour'
  | 'perDay'
  | 'perWeek'
  | 'perMonth'
  | 'everySecond'
  | 'everyMinute'
  | 'everyHour'
  | 'everyDay'
  | 'everyWeek'
  | 'everyMonth'

export type ChemistryId =
  | 'li-socl2'
  | 'li-mno2'
  | 'li-fes2'
  | 'alkaline'
  | 'li-ion'
  | 'lifepo4'
  | 'nimh-lsd'

/** null means the matching preset button is not selected. */
export type EfficiencyPresetId = 'at-battery' | 'buck' | 'buck-boost'

export interface BatteryConfig {
  capacity_mAh: number
  usablePercent: number
  selfDischargePercentPerMonth: number
  /** Load-side phase charge is divided by this percent. 100 leaves phases unchanged. */
  efficiencyPercent: number
  /** null is Custom: the selects write nothing and the self-discharge slider uses the generic band. */
  chemistryId: ChemistryId | null
  /** null is Custom. A cell belongs to the selected chemistry. */
  cellId: string | null
  /** null means the percent was typed or dragged, even when it equals 80, 90, or 100. */
  efficiencyPresetId: EfficiencyPresetId | null
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
  /** Omitted or true counts toward lifetime. False keeps the row but drops its load. */
  enabled?: boolean
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
  /** Omitted or true counts leakage. False keeps the sources but drops their load. */
  leakageEnabled?: boolean
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

