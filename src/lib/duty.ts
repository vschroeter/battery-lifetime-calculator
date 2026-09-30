import type { Locale } from '@/i18n/messages'
import { getMessage } from '@/i18n/messages'
import { formatCanonical } from '@/lib/numericInput'
import type { FrequencyUnit } from '@/types/calculator'
import {
  convertFrequencyToEventsPerDay,
  frequencyFromEventsPerDay,
  INTERVAL_UNITS,
  isIntervalUnit,
  RATE_UNITS,
} from '@/lib/units'

/** Coarse to fine, so the first integer hit is the coarsest one. */
const RATE_COARSE_TO_FINE = [
  'perMonth',
  'perWeek',
  'perDay',
  'perHour',
  'perMinute',
] as const satisfies readonly FrequencyUnit[]
const INTERVAL_COARSE_TO_FINE = [
  'everyMonth',
  'everyWeek',
  'everyDay',
  'everyHour',
  'everyMinute',
  'everySecond',
] as const satisfies readonly FrequencyUnit[]

export interface DutyValue {
  frequency: number
  frequencyUnit: FrequencyUnit
}

export function dutyMenuUnits(unit: FrequencyUnit): readonly FrequencyUnit[] {
  return isIntervalUnit(unit) ? INTERVAL_UNITS : RATE_UNITS
}

/**
 * The other sentence for a positive duty.
 * Among exact integers of at least 1, pick the smallest count.
 * That is 1 hour rather than 60 minutes, and 6 per hour rather than 1008 per week.
 * Otherwise an interval uses the coarsest unit of at least 1 (minutes before seconds),
 * and a rate uses the finest unit of at least 1.
 */
export function swappedDuty(frequency: number, unit: FrequencyUnit): DutyValue | null {
  if (!isShownDuty(frequency)) {
    return null
  }

  const eventsPerDay = convertFrequencyToEventsPerDay(frequency, unit)
  if (!Number.isFinite(eventsPerDay) || eventsPerDay <= 0) {
    return null
  }

  const candidates = isIntervalUnit(unit) ? RATE_COARSE_TO_FINE : INTERVAL_COARSE_TO_FINE
  let best: DutyValue | null = null
  for (const candidate of candidates) {
    const exact = frequencyFromEventsPerDay(eventsPerDay, candidate)
    if (!isExactInteger(exact)) {
      continue
    }
    const count = Math.round(exact)
    if (!best || count < best.frequency) {
      best = { frequency: count, frequencyUnit: candidate }
    }
  }
  if (best) {
    return best
  }

  const finest = candidates[candidates.length - 1]!
  let chosen = finest
  if (isIntervalUnit(unit)) {
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const candidate = candidates[index]!
      if (frequencyFromEventsPerDay(eventsPerDay, candidate) >= 1) {
        chosen = candidate
        break
      }
    }
  } else {
    for (const candidate of candidates) {
      if (frequencyFromEventsPerDay(eventsPerDay, candidate) >= 1) {
        chosen = candidate
        break
      }
    }
  }

  return {
    frequency: quantize(frequencyFromEventsPerDay(eventsPerDay, chosen)),
    frequencyUnit: chosen,
  }
}

/** Button label for a duty that is already the sentence being shown. */
export function formatDutySentence(frequency: number, unit: FrequencyUnit, locale: Locale): string | null {
  if (!isShownDuty(frequency)) {
    return null
  }

  if (isBareOne(frequency)) {
    return getMessage(locale, bareOneKey(unit))
  }

  const amount = formatCanonical(frequency, locale)
  if (isIntervalUnit(unit)) {
    return `${getMessage(locale, 'every')} ${amount} ${closedUnitWord(unit, frequency, locale)}`
  }
  return `${amount} ${getMessage(locale, unit)}`
}

/** Word shown on the closed unit menu. Day, week, and month follow the number. */
export function closedUnitWord(unit: FrequencyUnit, frequency: number, locale: Locale): string {
  switch (unit) {
    case 'everySecond':
      return getMessage(locale, 'dutySecond')
    case 'everyMinute':
      return getMessage(locale, 'dutyMin')
    case 'everyHour':
      return getMessage(locale, 'dutyHour')
    case 'everyDay':
      return getMessage(locale, isBareOne(frequency) ? 'dayOne' : 'dayMany')
    case 'everyWeek':
      return getMessage(locale, isBareOne(frequency) ? 'weekOne' : 'weekMany')
    case 'everyMonth':
      return getMessage(locale, isBareOne(frequency) ? 'monthOne' : 'monthMany')
    case 'perMinute':
    case 'perHour':
    case 'perDay':
    case 'perWeek':
    case 'perMonth':
      return getMessage(locale, unit)
  }
}

/** Plural (or the symbol) used while the unit menu is open. */
export function menuUnitWord(unit: FrequencyUnit, locale: Locale): string {
  switch (unit) {
    case 'everyDay':
      return getMessage(locale, 'dayMany')
    case 'everyWeek':
      return getMessage(locale, 'weekMany')
    case 'everyMonth':
      return getMessage(locale, 'monthMany')
    default:
      return closedUnitWord(unit, 2, locale)
  }
}

function bareOneKey(unit: FrequencyUnit): string {
  switch (unit) {
    case 'everySecond':
      return 'everyOneSecond'
    case 'everyMinute':
      return 'everyOneMinute'
    case 'everyHour':
      return 'everyOneHour'
    case 'everyDay':
      return 'everyOneDay'
    case 'everyWeek':
      return 'everyOneWeek'
    case 'everyMonth':
      return 'everyOneMonth'
    case 'perMinute':
      return 'oncePerMinute'
    case 'perHour':
      return 'oncePerHour'
    case 'perDay':
      return 'oncePerDay'
    case 'perWeek':
      return 'oncePerWeek'
    case 'perMonth':
      return 'oncePerMonth'
  }
}

function isShownDuty(frequency: number): boolean {
  return Number.isFinite(frequency) && frequency > 0
}

function isBareOne(frequency: number): boolean {
  return Math.abs(frequency - 1) <= 1e-9
}

function isExactInteger(value: number): boolean {
  if (!Number.isFinite(value) || value < 1) {
    return false
  }
  const nearest = Math.round(value)
  return Math.abs(value - nearest) <= 1e-6 * Math.max(1, nearest)
}

function quantize(exact: number): number {
  const hundredths = roundHalfAwayFromZero(exact, 2)
  if (hundredths > 0) {
    return hundredths
  }
  const significant = Number(exact.toPrecision(2))
  if (Number.isFinite(significant) && significant > 0) {
    return significant
  }
  return exact
}

function roundHalfAwayFromZero(value: number, decimals: number): number {
  const factor = 10 ** decimals
  const sign = value < 0 ? -1 : 1
  const shifted = Math.abs(value) * factor
  const rounded = Math.floor(shifted + 0.5 + Number.EPSILON)
  return (sign * rounded) / factor
}
