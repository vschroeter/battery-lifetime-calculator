import type { BatteryConfig, CalculatorState, Phase } from '@/types/calculator'

export type FieldRule =
  | 'nonNegative'
  | 'positive'
  | 'usableRange'
  | 'selfDischargeRange'
  | 'efficiencyRange'

export interface FieldIssue {
  key: string
  rule: FieldRule
}

export function isLegal(rule: FieldRule, value: number): boolean {
  if (!Number.isFinite(value)) {
    return false
  }
  switch (rule) {
    case 'nonNegative':
      return value >= 0
    case 'positive':
      return value > 0
    case 'usableRange':
      return value >= 1 && value <= 100
    case 'selfDischargeRange':
      return value >= 0 && value < 100
    case 'efficiencyRange':
      return value > 0 && value <= 100
  }
}

export type BatteryNumberField =
  | 'capacity_mAh'
  | 'usablePercent'
  | 'selfDischargePercentPerMonth'
  | 'efficiencyPercent'

export function batteryFieldKey(field: BatteryNumberField): string {
  switch (field) {
    case 'capacity_mAh':
      return 'battery.capacity'
    case 'usablePercent':
      return 'battery.usablePercent'
    case 'selfDischargePercentPerMonth':
      return 'battery.selfDischarge'
    case 'efficiencyPercent':
      return 'battery.efficiency'
  }
}

export function batteryFieldRule(field: BatteryNumberField): FieldRule {
  switch (field) {
    case 'capacity_mAh':
      return 'positive'
    case 'usablePercent':
      return 'usableRange'
    case 'selfDischargePercentPerMonth':
      return 'selfDischargeRange'
    case 'efficiencyPercent':
      return 'efficiencyRange'
  }
}

export function phaseFieldKey(id: string, field: 'current' | 'duration' | 'frequency'): string {
  return `phase.${id}.${field}`
}

export function leakageFieldKey(id: string): string {
  return `leakage.${id}.current`
}

export function legalSnapshot(state: CalculatorState): Record<string, number> {
  const snapshot: Record<string, number> = {}
  rememberBattery(snapshot, state.battery)
  for (const phase of state.phases) {
    rememberPhase(snapshot, phase)
  }
  for (const leakage of state.leakageCurrents) {
    if (isLegal('nonNegative', leakage.current)) {
      snapshot[leakageFieldKey(leakage.id)] = leakage.current
    }
  }
  return snapshot
}

function rememberBattery(snapshot: Record<string, number>, battery: BatteryConfig) {
  const fields = [
    'capacity_mAh',
    'usablePercent',
    'selfDischargePercentPerMonth',
    'efficiencyPercent',
  ] as const
  for (const field of fields) {
    const value = battery[field]
    if (isLegal(batteryFieldRule(field), value)) {
      snapshot[batteryFieldKey(field)] = value
    }
  }
}

export function rememberPhase(snapshot: Record<string, number>, phase: Phase) {
  if (isLegal('nonNegative', phase.current)) {
    snapshot[phaseFieldKey(phase.id, 'current')] = phase.current
  }
  if (!phase.isDeepSleep) {
    if (isLegal('positive', phase.duration)) {
      snapshot[phaseFieldKey(phase.id, 'duration')] = phase.duration
    }
    if (isLegal('positive', phase.frequency)) {
      snapshot[phaseFieldKey(phase.id, 'frequency')] = phase.frequency
    }
  }
}

export interface ProfileEvaluation {
  issues: FieldIssue[]
  withheld: boolean
  model: CalculatorState | null
}

/**
 * Illegal fields keep their last legal number for the model.
 * The model is withheld when any illegal field has no last legal number.
 */
export function evaluateProfile(
  state: CalculatorState,
  lastLegal: Readonly<Record<string, number>>,
): ProfileEvaluation {
  const issues: FieldIssue[] = []
  let missing = false

  const capacity = substitute(
    batteryFieldKey('capacity_mAh'),
    state.battery.capacity_mAh,
    'positive',
    lastLegal,
    issues,
  )
  const usablePercent = substitute(
    batteryFieldKey('usablePercent'),
    state.battery.usablePercent,
    'usableRange',
    lastLegal,
    issues,
  )
  const selfDischarge = substitute(
    batteryFieldKey('selfDischargePercentPerMonth'),
    state.battery.selfDischargePercentPerMonth,
    'selfDischargeRange',
    lastLegal,
    issues,
  )
  const efficiencyPercent = substitute(
    batteryFieldKey('efficiencyPercent'),
    state.battery.efficiencyPercent,
    'efficiencyRange',
    lastLegal,
    issues,
  )
  if (
    capacity === null ||
    usablePercent === null ||
    selfDischarge === null ||
    efficiencyPercent === null
  ) {
    missing = true
  }

  const phases = state.phases.map((phase) => {
    const current = substitute(
      phaseFieldKey(phase.id, 'current'),
      phase.current,
      'nonNegative',
      lastLegal,
      issues,
    )
    if (current === null) {
      missing = true
    }
    if (phase.isDeepSleep) {
      return { ...phase, current: current ?? phase.current }
    }
    const duration = substitute(
      phaseFieldKey(phase.id, 'duration'),
      phase.duration,
      'positive',
      lastLegal,
      issues,
    )
    const frequency = substitute(
      phaseFieldKey(phase.id, 'frequency'),
      phase.frequency,
      'positive',
      lastLegal,
      issues,
    )
    if (duration === null || frequency === null) {
      missing = true
    }
    return {
      ...phase,
      current: current ?? phase.current,
      duration: duration ?? phase.duration,
      frequency: frequency ?? phase.frequency,
    }
  })

  const leakageCurrents = state.leakageCurrents.map((leakage) => {
    const current = substitute(
      leakageFieldKey(leakage.id),
      leakage.current,
      'nonNegative',
      lastLegal,
      issues,
    )
    if (current === null) {
      missing = true
    }
    return { ...leakage, current: current ?? leakage.current }
  })

  if (missing) {
    return { issues, withheld: true, model: null }
  }

  return {
    issues,
    withheld: false,
    model: {
      battery: {
        capacity_mAh: capacity!,
        usablePercent: usablePercent!,
        selfDischargePercentPerMonth: selfDischarge!,
        efficiencyPercent: efficiencyPercent!,
        chemistryId: state.battery.chemistryId,
        cellId: state.battery.cellId,
        efficiencyPresetId: state.battery.efficiencyPresetId,
      },
      phases,
      leakageCurrents,
    },
  }
}

function substitute(
  key: string,
  value: number,
  rule: FieldRule,
  lastLegal: Readonly<Record<string, number>>,
  issues: FieldIssue[],
): number | null {
  if (isLegal(rule, value)) {
    return value
  }
  issues.push({ key, rule })
  const held = lastLegal[key]
  if (held === undefined || !isLegal(rule, held)) {
    return null
  }
  return held
}
