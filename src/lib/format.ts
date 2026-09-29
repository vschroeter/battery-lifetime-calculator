export interface ScaledQuantity {
  text: string
  unit: string
}

/**
 * Three significant figures, without scientific notation in the display range.
 * Trailing zeros after the decimal point are dropped so 4.80 reads as 4.8.
 */
export function formatSignificant(value: number, digits = 3): string {
  if (!Number.isFinite(value)) {
    return '0'
  }

  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs === 0) {
    return '0'
  }

  const rounded = Number(abs.toPrecision(digits))
  if (!Number.isFinite(rounded) || rounded === 0) {
    return '0'
  }

  if (Number.isInteger(rounded)) {
    return `${sign}${rounded.toFixed(0)}`
  }

  const text = rounded.toPrecision(digits)
  if (!text.includes('e') && !text.includes('E')) {
    return `${sign}${stripTrailingZeros(text)}`
  }

  const decimals = Math.max(0, digits - 1 - Math.floor(Math.log10(rounded)))
  return `${sign}${stripTrailingZeros(rounded.toFixed(decimals))}`
}

function stripTrailingZeros(text: string): string {
  if (!text.includes('.')) {
    return text
  }
  return text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

interface UnitStep {
  min: number
  scale: number
  unit: string
}

function scaleToUnit(value: number, steps: readonly UnitStep[]): ScaledQuantity {
  const abs = Math.abs(value)
  const step = steps.find((candidate) => abs >= candidate.min) ?? steps[steps.length - 1]!
  return {
    text: formatSignificant(value * step.scale),
    unit: step.unit,
  }
}

const CURRENT_STEPS: readonly UnitStep[] = [
  { min: 1000, scale: 0.001, unit: 'A' },
  { min: 1, scale: 1, unit: 'mA' },
  { min: 0.001, scale: 1000, unit: 'µA' },
  { min: 0, scale: 1_000_000, unit: 'nA' },
]

const CHARGE_STEPS: readonly UnitStep[] = [
  { min: 1, scale: 1, unit: 'mAh/day' },
  { min: 0.001, scale: 1000, unit: 'µAh/day' },
  { min: 0, scale: 1_000_000, unit: 'nAh/day' },
]

const TIME_STEPS: readonly UnitStep[] = [
  { min: 3600, scale: 1 / 3600, unit: 'h' },
  { min: 60, scale: 1 / 60, unit: 'min' },
  { min: 1, scale: 1, unit: 's' },
  { min: 0, scale: 1000, unit: 'ms' },
]

export function formatCurrentFromMilliAmps(mA: number): ScaledQuantity {
  return scaleToUnit(mA, CURRENT_STEPS)
}

export function formatChargePerDay(mAhPerDay: number): ScaledQuantity {
  return scaleToUnit(mAhPerDay, CHARGE_STEPS)
}

export function formatActiveTime(seconds: number): ScaledQuantity {
  return scaleToUnit(seconds, TIME_STEPS)
}

export function formatCount(value: number): string {
  return formatSignificant(value)
}

export function formatPercent(percent: number): string {
  if (!(percent > 0)) {
    return '0%'
  }
  if (percent >= 10) {
    return `${percent.toFixed(1)}%`
  }
  if (percent >= 1) {
    return `${percent.toFixed(1)}%`
  }
  return `${formatSignificant(percent)}%`
}

export function formatQuantity(quantity: ScaledQuantity): string {
  return `${quantity.text} ${quantity.unit}`
}
