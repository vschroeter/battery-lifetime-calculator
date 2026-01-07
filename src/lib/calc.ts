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
  convertIntervalToSeconds,
  convertFrequencyToEventsPerDay,
} from '@/lib/units'

const SECONDS_PER_DAY = 86400
const DAYS_PER_WEEK = 7
const DAYS_PER_MONTH = 30.44

/**
 * Calculate events per day for a phase
 */
function calculateEventsPerDay(phase: Phase): number {
  if (phase.isDeepSleep) {
    return 0 // DeepSleep is calculated separately
  }

  if (phase.mode === 'interval') {
    if (!phase.interval || !phase.intervalUnit) {
      return 0
    }
    const intervalSeconds = convertIntervalToSeconds(
      phase.interval,
      phase.intervalUnit,
    )
    if (intervalSeconds <= 0) {
      return 0
    }
    return SECONDS_PER_DAY / intervalSeconds
  } else {
    // mode === 'frequency'
    if (!phase.frequency || !phase.frequencyUnit) {
      return 0
    }
    return convertFrequencyToEventsPerDay(
      phase.frequency,
      phase.frequencyUnit,
    )
  }
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

  // Validate phases
  for (const phase of phases) {
    if (phase.current <= 0) {
      errors.push(`Phase "${phase.name}": Current must be greater than 0`)
    }
    if (!phase.isDeepSleep) {
      if (phase.duration <= 0) {
        errors.push(`Phase "${phase.name}": Duration must be greater than 0`)
      }
      if (phase.mode === 'interval') {
        if (!phase.interval || phase.interval <= 0) {
          errors.push(
            `Phase "${phase.name}": Interval must be greater than 0`,
          )
        } else {
          const intervalSeconds = convertIntervalToSeconds(
            phase.interval,
            phase.intervalUnit!,
          )
          const durationSeconds = convertDurationToSeconds(
            phase.duration,
            phase.durationUnit,
          )
          if (durationSeconds > intervalSeconds) {
            warnings.push(
              `Phase "${phase.name}": Duration (${phase.duration} ${phase.durationUnit}) exceeds interval (${phase.interval} ${phase.intervalUnit})`,
            )
          }
        }
      } else {
        // mode === 'frequency'
        if (!phase.frequency || phase.frequency <= 0) {
          errors.push(
            `Phase "${phase.name}": Frequency must be greater than 0`,
          )
        }
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

  // Calculate totals
  const totalmAhPerDay = phaseResults.reduce(
    (sum, r) => sum + r.mAhPerDay,
    0,
  )
  const averageCurrent_mA = totalmAhPerDay / 24

  // Calculate runtime
  const usableCapacity_mAh =
    battery.capacity_mAh * (battery.usablePercent / 100)
  const runtimeDays =
    totalmAhPerDay > 0 ? usableCapacity_mAh / totalmAhPerDay : 0
  const runtimeWeeks = runtimeDays / DAYS_PER_WEEK
  const runtimeMonths = runtimeDays / DAYS_PER_MONTH

  return {
    phaseResults,
    totalmAhPerDay,
    averageCurrent_mA,
    runtimeDays,
    runtimeWeeks,
    runtimeMonths,
    errors,
    warnings,
  }
}

