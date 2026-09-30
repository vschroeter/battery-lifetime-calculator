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

/** Same month the lifetime note rounds to 30.44 days. */
export const MONTH_DAYS = 30.44

/**
 * Link and file order. The first three indexes are the original rate units.
 */
export const FREQUENCY_UNITS = [
  'perHour',
  'perDay',
  'perWeek',
  'perMonth',
  'everyMinute',
  'everyHour',
  'everyDay',
  'everyWeek',
  'everyMonth',
  'perMinute',
  'everySecond',
] as const satisfies readonly FrequencyUnit[]

export const RATE_UNITS = [
  'perMinute',
  'perHour',
  'perDay',
  'perWeek',
  'perMonth',
] as const satisfies readonly FrequencyUnit[]

export const INTERVAL_UNITS = [
  'everySecond',
  'everyMinute',
  'everyHour',
  'everyDay',
  'everyWeek',
  'everyMonth',
] as const satisfies readonly FrequencyUnit[]

export function isIntervalUnit(unit: FrequencyUnit): boolean {
  return (INTERVAL_UNITS as readonly FrequencyUnit[]).includes(unit)
}

/**
 * Convert frequency to events per day.
 * Interval units read as "every N of this unit".
 */
export function convertFrequencyToEventsPerDay(
  value: number,
  unit: FrequencyUnit,
): number {
  switch (unit) {
    case 'perMinute':
      return value * 1440
    case 'perHour':
      return value * 24
    case 'perDay':
      return value
    case 'perWeek':
      return value / 7
    case 'perMonth':
      return value / MONTH_DAYS
    case 'everySecond':
      return 86400 / value
    case 'everyMinute':
      return 1440 / value
    case 'everyHour':
      return 24 / value
    case 'everyDay':
      return 1 / value
    case 'everyWeek':
      return 1 / (value * 7)
    case 'everyMonth':
      return 1 / (value * MONTH_DAYS)
  }
}

/** Inverse of {@link convertFrequencyToEventsPerDay}. */
export function frequencyFromEventsPerDay(eventsPerDay: number, unit: FrequencyUnit): number {
  switch (unit) {
    case 'perMinute':
      return eventsPerDay / 1440
    case 'perHour':
      return eventsPerDay / 24
    case 'perDay':
      return eventsPerDay
    case 'perWeek':
      return eventsPerDay * 7
    case 'perMonth':
      return eventsPerDay * MONTH_DAYS
    case 'everySecond':
      return 86400 / eventsPerDay
    case 'everyMinute':
      return 1440 / eventsPerDay
    case 'everyHour':
      return 24 / eventsPerDay
    case 'everyDay':
      return 1 / eventsPerDay
    case 'everyWeek':
      return 1 / (eventsPerDay * 7)
    case 'everyMonth':
      return 1 / (eventsPerDay * MONTH_DAYS)
  }
}

