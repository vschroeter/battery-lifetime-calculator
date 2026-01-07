import type { CalculatorState, CalculationResult } from '@/types/calculator'

/**
 * Export configuration as JSON
 */
export function exportConfigAsJSON(state: CalculatorState): void {
  const dataStr = JSON.stringify(state, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = `battery-config-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export calculation results as CSV
 */
export function exportResultsAsCSV(result: CalculationResult): void {
  if (result.errors.length > 0) {
    alert('Cannot export: There are errors in the calculation.')
    return
  }

  const rows: string[][] = []

  // Header
  rows.push(['Metric', 'Value', 'Unit'])

  // KPIs
  rows.push(['Average Current', result.averageCurrent_mA.toFixed(3), 'mA'])
  rows.push(['Total Consumption per Day', result.totalmAhPerDay.toFixed(2), 'mAh/day'])
  rows.push(['Runtime', result.runtimeDays.toFixed(1), 'days'])
  rows.push(['Runtime', result.runtimeWeeks.toFixed(1), 'weeks'])
  rows.push(['Runtime', result.runtimeMonths.toFixed(1), 'months'])

  // Empty row
  rows.push([])

  // Phase breakdown header
  rows.push(['Phase', 'mAh/day', 'Events/day', 'Active Time/day (h)'])

  // Phase data
  for (const phaseResult of result.phaseResults) {
    rows.push([
      phaseResult.phaseName,
      phaseResult.mAhPerDay.toFixed(3),
      phaseResult.eventsPerDay > 0 ? phaseResult.eventsPerDay.toFixed(1) : 'N/A',
      phaseResult.activeTimePerDaySeconds > 0
        ? (phaseResult.activeTimePerDaySeconds / 3600).toFixed(2)
        : 'Auto',
    ])
  }

  // Convert to CSV string
  const csvContent = rows
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n')

  // Download
  const dataBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = `battery-results-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

