export type CurrentUnit = 'µA' | 'mA' | 'A'
export type DurationUnit = 'ms' | 's' | 'min' | 'h'
export type IntervalUnit = 's' | 'min' | 'h'
export type FrequencyUnit = 'perHour' | 'perDay' | 'perWeek'

export type PhaseMode = 'interval' | 'frequency'

export interface BatteryConfig {
  capacity_mAh: number
  usablePercent: number
}

export interface Phase {
  id: string
  name: string
  isDeepSleep: boolean
  current: number
  currentUnit: CurrentUnit
  duration: number
  durationUnit: DurationUnit
  mode: PhaseMode
  // Mode A: interval
  interval?: number
  intervalUnit?: IntervalUnit
  // Mode B: frequency
  frequency?: number
  frequencyUnit?: FrequencyUnit
}

export interface CalculatorState {
  battery: BatteryConfig
  phases: Phase[]
  defaultPhaseMode: PhaseMode
}

export interface PhaseResult {
  phaseId: string
  phaseName: string
  mAhPerDay: number
  eventsPerDay: number
  activeTimePerDaySeconds: number
}

export interface CalculationResult {
  phaseResults: PhaseResult[]
  totalmAhPerDay: number
  averageCurrent_mA: number
  runtimeDays: number
  runtimeWeeks: number
  runtimeMonths: number
  errors: string[]
  warnings: string[]
}

