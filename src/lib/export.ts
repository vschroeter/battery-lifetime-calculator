import type { BatteryConfig, CalculationResult, CalculatorState } from '@/types/calculator'
import {
  formatActiveTime,
  formatChargePerDay,
  formatCount,
  formatCurrentFromMilliAmps,
  formatQuantity,
} from '@/lib/format'

export const CONFIG_FORMAT_VERSION = 1

export interface CsvLabels {
  metric: string
  value: string
  unit: string
  capacity: string
  usableCapacity: string
  selfDischarge: string
  averageCurrent: string
  consumptionPerDay: string
  runtime: string
  days: string
  weeks: string
  months: string
  years: string
  phase: string
  eventsPerDay: string
  activeTimePerDay: string
  notAvailable: string
  auto: string
  unitMilliampHours: string
  unitPercent: string
  unitPercentPerMonth: string
}

function downloadText(contents: string, filename: string, mimeType: string): void {
  const dataBlob = new Blob([contents], { type: mimeType })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function fileDate(): string {
  return new Date().toISOString().split('T')[0]!
}

export function serializeConfig(state: CalculatorState): string {
  return JSON.stringify(
    {
      version: CONFIG_FORMAT_VERSION,
      ...state,
    },
    null,
    2,
  )
}

/**
 * Export configuration as JSON
 */
export function exportConfigAsJSON(state: CalculatorState): void {
  downloadText(serializeConfig(state), `battery-config-${fileDate()}.json`, 'application/json')
}

function csvCell(value: string, asText = false): string {
  let text = value
  if (asText && /^[=+\-@]/.test(text)) {
    text = `'${text}`
  }
  return `"${text.replace(/"/g, '""')}"`
}

function csvRow(cells: string[], textColumns: ReadonlySet<number> = new Set()): string {
  return cells.map((cell, index) => csvCell(cell, textColumns.has(index))).join(',')
}

/**
 * Build the results CSV. Phase names are quoted, and names that Excel would
 * treat as formulas are prefixed so the file stays a record of text.
 */
export function buildResultsCsv(
  result: CalculationResult,
  battery: BatteryConfig,
  labels: CsvLabels,
): string {
  const rows: string[] = []
  const textFirstColumn = new Set([0])

  rows.push(csvRow([labels.metric, labels.value, labels.unit], textFirstColumn))
  rows.push(csvRow([
    labels.capacity,
    String(battery.capacity_mAh),
    labels.unitMilliampHours,
  ], textFirstColumn))
  rows.push(csvRow([
    labels.usableCapacity,
    String(battery.usablePercent),
    labels.unitPercent,
  ], textFirstColumn))
  rows.push(csvRow([
    labels.selfDischarge,
    String(battery.selfDischargePercentPerMonth),
    labels.unitPercentPerMonth,
  ], textFirstColumn))
  rows.push(csvRow([
    labels.averageCurrent,
    formatCurrentFromMilliAmps(result.averageCurrent_mA).text,
    formatCurrentFromMilliAmps(result.averageCurrent_mA).unit,
  ], textFirstColumn))
  rows.push(csvRow([
    labels.consumptionPerDay,
    formatChargePerDay(result.totalmAhPerDay).text,
    formatChargePerDay(result.totalmAhPerDay).unit,
  ], textFirstColumn))
  rows.push(csvRow([
    labels.runtime,
    formatCount(result.runtimeDays),
    labels.days,
  ], textFirstColumn))
  rows.push(csvRow([
    labels.runtime,
    formatCount(result.runtimeWeeks),
    labels.weeks,
  ], textFirstColumn))
  rows.push(csvRow([
    labels.runtime,
    formatCount(result.runtimeMonths),
    labels.months,
  ], textFirstColumn))
  rows.push(csvRow([
    labels.runtime,
    formatCount(result.runtimeYears),
    labels.years,
  ], textFirstColumn))

  rows.push('')
  rows.push(csvRow([
    labels.phase,
    labels.consumptionPerDay,
    labels.eventsPerDay,
    labels.activeTimePerDay,
  ], textFirstColumn))

  for (const phaseResult of result.phaseResults) {
    const charge = formatChargePerDay(phaseResult.mAhPerDay)
    const activeTime = phaseResult.activeTimePerDaySeconds > 0
      ? formatQuantity(formatActiveTime(phaseResult.activeTimePerDaySeconds))
      : labels.auto
    rows.push(csvRow([
      phaseResult.phaseName,
      `${charge.text} ${charge.unit}`,
      phaseResult.eventsPerDay > 0 ? formatCount(phaseResult.eventsPerDay) : labels.notAvailable,
      activeTime,
    ], textFirstColumn))
  }

  return `\uFEFF${rows.join('\n')}`
}

/**
 * Export calculation results as CSV.
 * The caller disables this action while the result still has errors.
 */
export function exportResultsAsCSV(
  result: CalculationResult,
  battery: BatteryConfig,
  labels: CsvLabels,
): void {
  if (result.errors.length > 0) {
    return
  }

  downloadText(
    buildResultsCsv(result, battery, labels),
    `battery-results-${fileDate()}.csv`,
    'text/csv;charset=utf-8;',
  )
}
