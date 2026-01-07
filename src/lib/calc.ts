import type {
  Phase,
  BatteryConfig,
  PhaseResult,
  CalculationResult,
} from '@/types/calculator'
import {
  convertCurrentTo_mA,
  convertDurationToHours,
  convertDurationToSeconds,
  convertFrequencyToEventsPerDay,
} from '@/lib/units'

const SECONDS_PER_DAY = 86400
const DAYS_PER_WEEK = 7
const DAYS_PER_MONTH = 30.44
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
 * Calculate DeepSleep consumption
 */
function calculateDeepSleepConsumption(
  phases: Phase[],
  deepSleepPhase: Phase,
): {
  mAhPerDay: number
  activeTimePerDaySeconds: number
} {
  // Calculate total active time per day from all non-DeepSleep phases
  let totalActiveTimeSeconds = 0

  for (const phase of phases) {
    if (!phase.isDeepSleep) {
      const result = calculatePhaseConsumption(phase)
      totalActiveTimeSeconds += result.activeTimePerDaySeconds
    }
  }

  const deepSleepTimeSeconds = Math.max(
    0,
    SECONDS_PER_DAY - totalActiveTimeSeconds,
  )
  const deepSleepTimeHours = deepSleepTimeSeconds / 3600
  const deepSleepCurrent_mA = convertCurrentTo_mA(
    deepSleepPhase.current,
    deepSleepPhase.currentUnit,
  )

  const mAhPerDay = deepSleepCurrent_mA * deepSleepTimeHours

  return {
    mAhPerDay,
    activeTimePerDaySeconds: deepSleepTimeSeconds,
  }
}

/**
 * Main calculation function
 */
export function calculate(
  battery: BatteryConfig,
  phases: Phase[],
): CalculationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate battery
  if (battery.capacity_mAh <= 0) {
    errors.push('Battery capacity must be greater than 0')
  }
  if (battery.usablePercent < 1 || battery.usablePercent > 100) {
    errors.push('Usable capacity percentage must be between 1 and 100')
  }
  if (battery.selfDischargePercentPerMonth < 0 || battery.selfDischargePercentPerMonth >= 100) {
    errors.push('Self-discharge rate must be between 0 and 100 (exclusive)')
  }

  // Validate phases
  for (const phase of phases) {
    if (phase.current <= 0) {
      errors.push(`Phase "${phase.name}": Current must be greater than 0`)
    }
    if (!phase.isDeepSleep) {
      if (phase.duration <= 0) {
        errors.push(`Phase "${phase.name}": Duration must be greater than 0`)
      }
      if (!phase.frequency || phase.frequency <= 0) {
        errors.push(
          `Phase "${phase.name}": Frequency must be greater than 0`,
        )
      }
    }
  }

  // If there are errors, return early
  if (errors.length > 0) {
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
    }
  }

  // Calculate phase results
  const phaseResults: PhaseResult[] = []
  let totalActiveTimeSeconds = 0

  // Process non-DeepSleep phases
  for (const phase of phases) {
    if (!phase.isDeepSleep) {
      const result = calculatePhaseConsumption(phase)
      totalActiveTimeSeconds += result.activeTimePerDaySeconds

      phaseResults.push({
        phaseId: phase.id,
        phaseName: phase.name,
        mAhPerDay: result.mAhPerDay,
        eventsPerDay: result.eventsPerDay,
        activeTimePerDaySeconds: result.activeTimePerDaySeconds,
      })
    }
  }

  // Check if active time exceeds 24 hours
  if (totalActiveTimeSeconds > SECONDS_PER_DAY) {
    warnings.push(
      `Total active time per day (${(totalActiveTimeSeconds / 3600).toFixed(2)} h) exceeds 24 hours. DeepSleep will be 0.`,
    )
  }

  // Process DeepSleep phase(s)
  const deepSleepPhases = phases.filter((p) => p.isDeepSleep)
  for (const deepSleepPhase of deepSleepPhases) {
    const result = calculateDeepSleepConsumption(phases, deepSleepPhase)
    phaseResults.push({
      phaseId: deepSleepPhase.id,
      phaseName: deepSleepPhase.name,
      mAhPerDay: result.mAhPerDay,
      eventsPerDay: 0,
      activeTimePerDaySeconds: result.activeTimePerDaySeconds,
    })
    totalActiveTimeSeconds += result.activeTimePerDaySeconds
  }

  // Calculate load consumption from phases
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
      // Combined load + self-discharge: Q(t) = Q0 * e^(-k*t) - (L/k) * (1 - e^(-k*t))
      // Solve for t when Q(t) = 0:
      // Q0 * e^(-k*t) = (L/k) * (1 - e^(-k*t))
      // Q0 * e^(-k*t) = (L/k) - (L/k) * e^(-k*t)
      // e^(-k*t) * (Q0 + L/k) = L/k
      // e^(-k*t) = L / (k*Q0 + L)
      // -k*t = ln(L / (k*Q0 + L))
      // t = -ln(L / (k*Q0 + L)) / k
      // t = ln((k*Q0 + L) / L) / k
      // t = (1/k) * ln(1 + k*Q0/L)
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

  // Add self-discharge as a virtual phase result if it's significant
  if (selfDischargeAvg_mAhPerDay > 0.001) {
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
  }
}

