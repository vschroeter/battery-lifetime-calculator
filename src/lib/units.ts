import type {
  CurrentUnit,
  DurationUnit,
  FrequencyUnit,
} from '@/types/calculator'

/**
 * Convert current to milliamps
 */
export function convertCurrentTo_mA(
  value: number,
  unit: CurrentUnit,
): number {
  switch (unit) {
    case 'nA':
      return value / 1000000
    case 'µA':
      return value / 1000
    case 'mA':
      return value
    case 'A':
      return value * 1000
    default:
      return value
  }
}

/**
 * Convert duration to hours
 */
export function convertDurationToHours(
  value: number,
  unit: DurationUnit,
): number {
  switch (unit) {
    case 'ms':
      return value / (1000 * 3600)
    case 's':
      return value / 3600
    case 'min':
      return value / 60
    case 'h':
      return value
    default:
      return value
  }
}

/**
 * Convert duration to seconds
 */
export function convertDurationToSeconds(
  value: number,
  unit: DurationUnit,
): number {
  switch (unit) {
    case 'ms':
      return value / 1000
    case 's':
      return value
    case 'min':
      return value * 60
    case 'h':
      return value * 3600
    default:
      return value
  }
}

/**
 * Convert frequency to events per day
 */
export function convertFrequencyToEventsPerDay(
  value: number,
  unit: FrequencyUnit,
): number {
  switch (unit) {
    case 'perHour':
      return value * 24
    case 'perDay':
      return value
    case 'perWeek':
      return value / 7
    default:
      return value
  }
}

