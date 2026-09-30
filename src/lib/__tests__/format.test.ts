import { describe, expect, it } from 'vitest'
import { calculate } from '@/lib/calc'
import { createExampleProfile } from '@/lib/exampleProfile'
import {
  formatActiveTime,
  formatChargePerDay,
  formatCount,
  formatCurrentFromMilliAmps,
  formatFixed,
  formatQuantity,
  runtimeYearsVisible,
} from '@/lib/format'
import type { BatteryConfig, Phase } from '@/types/calculator'

const defaultBattery: BatteryConfig = createExampleProfile().battery

const defaultPhases: Phase[] = [
  {
    id: 'active-1',
    name: 'Active',
    isDeepSleep: false,
    current: 80,
    currentUnit: 'mA',
    duration: 0.2,
    durationUnit: 's',
    frequency: 1,
    frequencyUnit: 'perHour',
  },
  {
    id: 'deepsleep-1',
    name: 'DeepSleep',
    isDeepSleep: true,
    current: 0.01,
    currentUnit: 'mA',
    duration: 0,
    durationUnit: 's',
    frequency: 0,
    frequencyUnit: 'perHour',
  },
]

describe('default profile display', () => {
  const result = calculate(defaultBattery, defaultPhases, [])
  const active = result.phaseResults.find((phase) => phase.phaseId === 'active-1')

  it('shows the 4.8 s pulse in seconds instead of 0.00 h', () => {
    expect(active).toBeDefined()
    expect(active!.activeTimePerDaySeconds).toBeCloseTo(4.8, 6)

    const label = formatQuantity(formatActiveTime(active!.activeTimePerDaySeconds))
    expect(label).toBe('4.8 s')
    expect(label).not.toBe('0.00 h')
  })

  it('uses one rounding policy so the phase rows add back to the day total', () => {
    const rows = result.phaseResults.map((phase) => formatChargePerDay(phase.mAhPerDay))
    const total = formatChargePerDay(result.totalmAhPerDay)

    expect(rows.every((row) => row.unit === total.unit)).toBe(true)
    const rowSum = rows.reduce((sum, row) => sum + Number(row.text), 0)
    expect(rowSum).toBe(Number(total.text))
    expect(total.text).not.toBe('0')
    expect(total.text).not.toBe('0.35')
  })

  it('keeps a sub-milliamp average in microamps', () => {
    const current = formatCurrentFromMilliAmps(result.averageCurrent_mA)
    expect(current.unit).toBe('µA')
    expect(current.text).not.toBe('0')
    expect(current.text).not.toBe('0.000')
  })
})

describe('lifetime figures', () => {
  it('formats one decimal place with the active locale', () => {
    expect(formatFixed(10.04, 1, 'en')).toBe('10.0')
    expect(formatFixed(10.04, 1, 'de')).toBe('10,0')
    expect(formatFixed(1234.56, 1, 'de')).toBe('1.234,6')
  })

  it('hides years until one decimal would show at least 0.1', () => {
    expect(runtimeYearsVisible(10 / 365.24219)).toBe(false)
    expect(runtimeYearsVisible(0.049)).toBe(false)
    expect(runtimeYearsVisible(0.05)).toBe(true)
  })
})

describe('formatCount', () => {
  it('keeps one event per week from collapsing to 0.1', () => {
    expect(formatCount(1 / 7)).toBe('0.143')
  })
})

describe('formatChargePerDay', () => {
  it('shows a 20 nA continuous load above zero', () => {
    const mAhPerDay = (20 / 1_000_000) * 24
    const charge = formatChargePerDay(mAhPerDay)
    expect(charge.unit).toBe('nAh/day')
    expect(charge.text).not.toBe('0')
  })
})
