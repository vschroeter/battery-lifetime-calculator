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
  runtimeYears: number
  errors: string[]
  warnings: string[]
}

