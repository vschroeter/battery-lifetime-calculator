import type {
  Phase,
  BatteryConfig,
  PhaseResult,
  CalculationResult,
  LeakageCurrent,
} from '@/types/calculator'
import { isLegal } from '@/lib/fields'
import { LEAKAGE_PHASE_ID } from '@/lib/leakage'
import {
  convertCurrentTo_mA,
  convertDurationToHours,
  convertDurationToSeconds,
  convertFrequencyToEventsPerDay,
} from '@/lib/units'

const SECONDS_PER_DAY = 86400
/** A sum this close to 24 h still closes the day, so float noise is not an over-budget profile. */
const DAY_BUDGET_TOLERANCE_SECONDS = 0.001
const DAYS_PER_WEEK = 7
const DAYS_PER_MONTH = 30.4368491667 // From tropical year having 365.24219 days
const MONTHS_PER_YEAR = 12

/**
 * Calculate events per day for a phase
 */
function calculateEventsPerDay(phase: Phase): number {
  if (phase.isDeepSleep) {
    return 0 // DeepSleep is calculated separately
  }

  if (!phase.frequency || !phase.frequencyUnit) {
    return 0
  }
  return convertFrequencyToEventsPerDay(
    phase.frequency,
    phase.frequencyUnit,
  )
}

/**
 * Calculate mAh per day for a single phase (non-DeepSleep)
 */
function calculatePhaseConsumption(phase: Phase): {
  mAhPerDay: number
  eventsPerDay: number
  activeTimePerDaySeconds: number
} {
  if (phase.isDeepSleep) {
    return {
      mAhPerDay: 0,
      eventsPerDay: 0,
      activeTimePerDaySeconds: 0,
    }
  }

  const eventsPerDay = calculateEventsPerDay(phase)
  const current_mA = convertCurrentTo_mA(phase.current, phase.currentUnit)
  const durationHours = convertDurationToHours(
    phase.duration,
    phase.durationUnit,
  )
  const durationSeconds = convertDurationToSeconds(
    phase.duration,
    phase.durationUnit,
  )

  const mAhPerDay = current_mA * durationHours * eventsPerDay
  const activeTimePerDaySeconds = durationSeconds * eventsPerDay

  return {
    mAhPerDay,
    eventsPerDay,
    activeTimePerDaySeconds,
  }
}

/**
 * Deep-sleep remainder when active averages fit in one day.
 * Returns null when the sum is more than 1 ms over 24 h.
 * A sum within 1 ms of 24 h is an empty remainder, not an open day.
 */
function closedDayRemainder(activeTimePerDaySeconds: number): number | null {
  const activeMilliseconds = Math.round(activeTimePerDaySeconds * 1000)
  const dayMilliseconds = SECONDS_PER_DAY * 1000
  const toleranceMilliseconds = DAY_BUDGET_TOLERANCE_SECONDS * 1000
  const excessMilliseconds = activeMilliseconds - dayMilliseconds
  if (excessMilliseconds > toleranceMilliseconds) {
    return null
  }
  if (Math.abs(excessMilliseconds) <= toleranceMilliseconds) {
    return 0
  }
  return (dayMilliseconds - activeMilliseconds) / 1000
}

function emptyResult(errors: string[], warnings: string[]): CalculationResult {
  return {
    phaseResults: [],
    totalmAhPerDay: 0,
    averageCurrent_mA: 0,
    runtimeDays: 0,
    runtimeWeeks: 0,
    runtimeMonths: 0,
    runtimeYears: 0,
    errors,
    warnings,
    dayBudgetExceeded: false,
    activeTimePerDaySeconds: 0,
  }
}

/**
 * Main calculation function
 */
export function calculate(
  battery: BatteryConfig,
  phases: Phase[],
  leakageCurrents: LeakageCurrent[] = [],
  leakageEnabled = true,
): CalculationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate battery
  if (!isLegal('positive', battery.capacity_mAh)) {
    errors.push('Battery capacity must be greater than 0')
  }
  if (!isLegal('usableRange', battery.usablePercent)) {
    errors.push('Usable capacity percentage must be between 1 and 100')
  }
  if (!isLegal('selfDischargeRange', battery.selfDischargePercentPerMonth)) {
    errors.push('Self-discharge rate must be between 0 and 100 (exclusive)')
  }
  if (!isLegal('efficiencyRange', battery.efficiencyPercent)) {
    errors.push('Regulator efficiency must be greater than 0 and at most 100')
  }

  const deepSleepPhases = phases.filter((phase) => phase.isDeepSleep)
  if (deepSleepPhases.length !== 1) {
    errors.push('Exactly one DeepSleep phase is required.')
  }

  // Validate phases. Current may be 0. Duration and frequency may not.
  for (const phase of phases) {
    if (!isLegal('nonNegative', phase.current)) {
      errors.push(`Phase "${phase.name}": Current must be greater than or equal to 0`)
    }
    if (!phase.isDeepSleep) {
      if (!isLegal('positive', phase.duration)) {
        errors.push(`Phase "${phase.name}": Duration must be greater than 0`)
      }
      if (!isLegal('positive', phase.frequency)) {
        errors.push(`Phase "${phase.name}": Frequency must be greater than 0`)
      }
    }
  }

  for (const leakage of leakageCurrents) {
    if (!isLegal('nonNegative', leakage.current)) {
      errors.push(`Leakage "${leakage.label}": Current must be greater than or equal to 0`)
    }
  }

  // Field errors block every row. The day-budget case is handled after this.
  if (errors.length > 0) {
    return emptyResult(errors, warnings)
  }

  // Phase currents are load-side. Efficiency scales them to the battery.
  // Leakage and self-discharge are already battery-side and stay unscaled.
  const phaseScale = 100 / battery.efficiencyPercent

  // Calculate phase results
  const phaseResults: PhaseResult[] = []
  let totalActiveTimeSeconds = 0

  // Process non-DeepSleep phases
  for (const phase of phases) {
    if (!phase.isDeepSleep && phase.enabled !== false) {
      const result = calculatePhaseConsumption(phase)
      totalActiveTimeSeconds += result.activeTimePerDaySeconds

      phaseResults.push({
        phaseId: phase.id,
        phaseName: phase.name,
        mAhPerDay: result.mAhPerDay * phaseScale,
        eventsPerDay: result.eventsPerDay,
        activeTimePerDaySeconds: result.activeTimePerDaySeconds,
      })
    }
  }

  const deepSleepTimeSeconds = closedDayRemainder(totalActiveTimeSeconds)

  function appendLeakage() {
    // Permanent load, outside the 24 h phase budget: current × 24 h.
    // Sources stay on the total. They are not separate rows in the daily sum.
    const leakageSources = leakageCurrents.map((leakage) => ({
      id: leakage.id,
      label: leakage.label,
      mAhPerDay: convertCurrentTo_mA(leakage.current, leakage.currentUnit) * 24,
    }))
    const leakageConsumption_mAhPerDay = leakageSources.reduce(
      (sum, source) => sum + source.mAhPerDay,
      0,
    )

    if (leakageEnabled && leakageCurrents.length > 0 && leakageConsumption_mAhPerDay > 0) {
      phaseResults.push({
        phaseId: LEAKAGE_PHASE_ID,
        phaseName: '',
        mAhPerDay: leakageConsumption_mAhPerDay,
        eventsPerDay: 0,
        activeTimePerDaySeconds: SECONDS_PER_DAY,
        leakageSources,
      })
    }
  }

  if (deepSleepTimeSeconds === null) {
    appendLeakage()
    return {
      phaseResults,
      totalmAhPerDay: 0,
      averageCurrent_mA: 0,
      runtimeDays: 0,
      runtimeWeeks: 0,
      runtimeMonths: 0,
      runtimeYears: 0,
      errors,
      warnings,
      dayBudgetExceeded: true,
      activeTimePerDaySeconds: totalActiveTimeSeconds,
    }
  }

  const deepSleepPhase = deepSleepPhases[0]!
  const deepSleepCurrent_mA = deepSleepPhase.enabled === false
    ? 0
    : convertCurrentTo_mA(deepSleepPhase.current, deepSleepPhase.currentUnit)
  phaseResults.push({
    phaseId: deepSleepPhase.id,
    phaseName: deepSleepPhase.name,
    mAhPerDay: deepSleepCurrent_mA * (deepSleepTimeSeconds / 3600) * phaseScale,
    eventsPerDay: 0,
    activeTimePerDaySeconds: deepSleepTimeSeconds,
  })
  appendLeakage()

  // Calculate load consumption from phases and leakage currents
  const loadConsumption_mAhPerDay = phaseResults.reduce(
    (sum, r) => sum + r.mAhPerDay,
    0,
  )

  // Calculate usable capacity
  const usableCapacity_mAh =
    battery.capacity_mAh * (battery.usablePercent / 100)

  // Calculate runtime with self-discharge (exponential model)
  let runtimeDays = 0
  let selfDischargeAvg_mAhPerDay = 0

  const selfDischargeRate = battery.selfDischargePercentPerMonth / 100

  if (selfDischargeRate > 0) {
    // Convert %/month to exponential decay constant per day
    // If r is the monthly loss rate, then after 30.44 days: Q = Q0 * (1 - r)
    // Exponential decay: Q(t) = Q0 * e^(-k*t)
    // At t=30.44: Q0 * e^(-k*30.44) = Q0 * (1 - r)
    // Therefore: k = -ln(1 - r) / 30.44
    const k = -Math.log(1 - selfDischargeRate) / DAYS_PER_MONTH

    if (loadConsumption_mAhPerDay > 0) {
      // Capacity model with BOTH effects:
      //   1) self-discharge proportional to remaining charge: dQ/dt = -k*Q
      //   2) constant load draw (e.g. average mAh/day):        dQ/dt = -L
      // Combined ODE: dQ/dt = -k*Q - L
      //
      // Closed-form solution (remaining capacity after t days):
      //   Q(t) = Q0 * e^(-k*t) - (L/k) * (1 - e^(-k*t))
      //        = (Q0 + L/k) * e^(-k*t) - L/k
      //
      // We want the "time to empty" (Q(t) = 0). Algebra:
      //
      //   0 = (Q0 + L/k) * e^(-k*t) - L/k
      //   (Q0 + L/k) * e^(-k*t) = L/k
      //   e^(-k*t) = (L/k) / (Q0 + L/k) = L / (k*Q0 + L)
      //
      // Take ln on both sides:
      //
      //   -k*t = ln( L / (k*Q0 + L) )
      //
      // Solve for t (positive result):
      //
      //   t = -ln( L / (k*Q0 + L) ) / k
      //     =  ln( (k*Q0 + L) / L ) / k
      //     = (1/k) * ln( 1 + (k*Q0)/L )
      //
      // Units sanity check:
      //   Q0 in mAh, L in mAh/day, k in 1/day -> (k*Q0)/L is dimensionless, t is in days.
      //
      // Notes / edge cases:
      //   - If k -> 0 (no self-discharge), limit becomes t -> Q0 / L (pure linear drain).
      //   - If L <= 0, "time to empty" is undefined (no consumption / charging).
      //   - This model assumes L is constant and self-discharge rate k stays constant over time.
      runtimeDays = (1 / k) * Math.log(1 + (k * usableCapacity_mAh) / loadConsumption_mAhPerDay)

      // Calculate effective average self-discharge mAh/day for reporting
      // Total consumption = load + self-discharge = usableCapacity / runtimeDays
      const totalConsumption_mAhPerDay = usableCapacity_mAh / runtimeDays
      selfDischargeAvg_mAhPerDay = Math.max(0, totalConsumption_mAhPerDay - loadConsumption_mAhPerDay)
    } else {
      // No load, only self-discharge (exponential decay)
      // Q(t) = Q0 * e^(-k*t)
      // Solve for t when Q(t) reaches a practical threshold (e.g., 1% of initial)
      // Since exponential decay is asymptotic, use 1% threshold
      const threshold = 0.01
      runtimeDays = Math.log(1 / threshold) / k
      warnings.push('Runtime calculated for self-discharge only (no load). Exponential decay is asymptotic; runtime shown is time to reach 1% remaining capacity.')

      // Calculate effective average self-discharge mAh/day
      selfDischargeAvg_mAhPerDay = usableCapacity_mAh / runtimeDays
    }
  } else {
    // No self-discharge, use simple linear model
    runtimeDays =
      loadConsumption_mAhPerDay > 0 ? usableCapacity_mAh / loadConsumption_mAhPerDay : 0
  }

  // Keep self-discharge in the share whenever the model produces any draw.
  if (selfDischargeAvg_mAhPerDay > 0) {
    phaseResults.push({
      phaseId: 'self-discharge-virtual',
      phaseName: 'Self-discharge',
      mAhPerDay: selfDischargeAvg_mAhPerDay,
      eventsPerDay: 0,
      activeTimePerDaySeconds: 0,
    })
  }

  // Calculate totals including self-discharge
  const totalmAhPerDay = phaseResults.reduce(
    (sum, r) => sum + r.mAhPerDay,
    0,
  )
  const averageCurrent_mA = totalmAhPerDay / 24

  const runtimeWeeks = runtimeDays / DAYS_PER_WEEK
  const runtimeMonths = runtimeDays / DAYS_PER_MONTH
  const runtimeYears = runtimeMonths / MONTHS_PER_YEAR

  return {
    phaseResults,
    totalmAhPerDay,
    averageCurrent_mA,
    runtimeDays,
    runtimeWeeks,
    runtimeMonths,
    runtimeYears,
    errors,
    warnings,
    dayBudgetExceeded: false,
    activeTimePerDaySeconds: totalActiveTimeSeconds,
  }
}

