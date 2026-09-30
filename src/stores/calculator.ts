import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { calculate } from '@/lib/calc'
import {
  batteryFieldKey,
  batteryFieldRule,
  evaluateProfile,
  isLegal,
  leakageFieldKey,
  legalSnapshot,
  phaseFieldKey,
  rememberPhase,
  type FieldIssue,
} from '@/lib/fields'
import { createExampleProfile } from '@/lib/exampleProfile'
import { LEAKAGE_PHASE_ID } from '@/lib/leakage'
import { duplicatePhaseName, insertAfterPhase, placeActivePhase } from '@/lib/phaseList'
import type {
  BatteryConfig,
  Phase,
  CalculatorState,
  LeakageCurrent,
  CalculationResult,
} from '@/types/calculator'

export interface Presentation {
  issues: FieldIssue[]
  withheld: boolean
  result: CalculationResult | null
}

export const useCalculatorStore = defineStore('calculator', () => {
  const example = createExampleProfile()

  // State
  const battery = ref<BatteryConfig>(example.battery)

  const phases = ref<Phase[]>(example.phases)

  const hoveredPhaseId = ref<string | null>(null)
  const pinnedPhaseId = ref<string | null>(null)
  const highlightedPhaseId = computed(() => hoveredPhaseId.value ?? pinnedPhaseId.value)

  const leakageCurrents = ref<LeakageCurrent[]>([])
  const leakageEnabled = ref(example.leakageEnabled !== false)
  const lastLegal = ref<Record<string, number>>({})

  // Getters
  const state = computed<CalculatorState>(() => ({
    battery: battery.value,
    phases: phases.value,
    leakageCurrents: leakageCurrents.value,
    leakageEnabled: leakageEnabled.value,
  }))

  const presentation = computed<Presentation>(() => {
    const evaluated = evaluateProfile(state.value, lastLegal.value)
    if (evaluated.withheld || !evaluated.model) {
      return { issues: evaluated.issues, withheld: true, result: null }
    }
    const result = calculate(
      evaluated.model.battery,
      evaluated.model.phases,
      evaluated.model.leakageCurrents,
      leakageEnabled.value,
    )
    if (result.errors.length > 0) {
      return { issues: evaluated.issues, withheld: true, result: null }
    }
    return { issues: evaluated.issues, withheld: false, result }
  })

  function issueRule(key: string) {
    return presentation.value.issues.find((issue) => issue.key === key)?.rule ?? null
  }

  function resolvedNumber(key: string): number | null {
    const issue = presentation.value.issues.find((item) => item.key === key)
    if (!issue) {
      return readDisplayedNumber(key)
    }
    const held = lastLegal.value[key]
    return held === undefined ? null : held
  }

  // Actions
  function updateBattery(config: Partial<BatteryConfig>) {
    battery.value = { ...battery.value, ...config }
  }

  function commitBatteryField(
    field: 'capacity_mAh' | 'usablePercent' | 'selfDischargePercentPerMonth',
    value: number,
  ) {
    battery.value = { ...battery.value, [field]: value }
    rememberCommitted(batteryFieldKey(field), batteryFieldRule(field), value)
  }

  function addPhase(phase: Omit<Phase, 'id'>): string {
    const newPhase: Phase = {
      ...phase,
      id: createPhaseId(),
    }
    phases.value.push(newPhase)
    const snapshot = { ...lastLegal.value }
    rememberPhase(snapshot, newPhase)
    lastLegal.value = snapshot
    return newPhase.id
  }

  function duplicatePhase(id: string): string | null {
    const source = phases.value.find((phase) => phase.id === id)
    if (!source || source.isDeepSleep) {
      return null
    }
    const created: Phase = {
      ...source,
      id: createPhaseId(),
      isDeepSleep: false,
      name: duplicatePhaseName(source.name, new Set(phases.value.map((phase) => phase.name))),
    }
    phases.value = insertAfterPhase(phases.value, id, created)
    const snapshot = { ...lastLegal.value }
    for (const field of ['current', 'duration', 'frequency'] as const) {
      const previous = snapshot[phaseFieldKey(source.id, field)]
      if (previous !== undefined) {
        snapshot[phaseFieldKey(created.id, field)] = previous
      }
    }
    rememberPhase(snapshot, created)
    lastLegal.value = snapshot
    return created.id
  }

  function moveActivePhase(id: string, targetIndex: number) {
    const next = placeActivePhase(phases.value, id, targetIndex)
    if (next.every((phase, index) => phase.id === phases.value[index]?.id)) {
      return
    }
    phases.value = next
  }

  function commitPhaseField(
    id: string,
    field: 'current' | 'duration' | 'frequency',
    value: number,
  ) {
    updatePhase(id, { [field]: value })
    const rule = field === 'current' ? 'nonNegative' : 'positive'
    rememberCommitted(phaseFieldKey(id, field), rule, value)
  }

  function updatePhase(id: string, updates: Partial<Phase>) {
    const index = phases.value.findIndex((p) => p.id === id)
    if (index !== -1) {
      phases.value[index] = { ...phases.value[index]!, ...updates }
    }
  }

  function removePhase(id: string) {
    phases.value = phases.value.filter((p) => p.id !== id)
    forgetKeysWithPrefix(`phase.${id}.`)
  }

  function removeAllPhases() {
    const removed = phases.value.filter((phase) => !phase.isDeepSleep)
    phases.value = phases.value.filter((p) => p.isDeepSleep)
    for (const phase of removed) {
      forgetKeysWithPrefix(`phase.${phase.id}.`)
    }
  }

  function resetToESP32Preset() {
    const next = createExampleProfile()
    battery.value = next.battery
    phases.value = next.phases
    leakageCurrents.value = next.leakageCurrents
    leakageEnabled.value = next.leakageEnabled !== false
    hoveredPhaseId.value = null
    pinnedPhaseId.value = null
    lastLegal.value = legalSnapshot(state.value)
  }

  function replaceState(nextState: CalculatorState) {
    // Clone imported data so the store owns its next state.
    battery.value = { ...nextState.battery }
    phases.value = nextState.phases.map((phase) => ({ ...phase }))
    leakageCurrents.value = nextState.leakageCurrents.map((leakage) => ({ ...leakage }))
    leakageEnabled.value = nextState.leakageEnabled !== false
    hoveredPhaseId.value = null
    pinnedPhaseId.value = null
    lastLegal.value = legalSnapshot(state.value)
  }

  function setHoveredPhase(id: string | null) {
    hoveredPhaseId.value = id
  }

  function togglePinnedPhase(id: string) {
    pinnedPhaseId.value = pinnedPhaseId.value === id ? null : id
  }

  function addLeakageCurrent(leakage: Omit<LeakageCurrent, 'id'>) {
    const newLeakage: LeakageCurrent = {
      ...leakage,
      id: `leakage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }
    leakageCurrents.value.push(newLeakage)
    if (isLegal('nonNegative', newLeakage.current)) {
      lastLegal.value = {
        ...lastLegal.value,
        [leakageFieldKey(newLeakage.id)]: newLeakage.current,
      }
    }
  }

  function commitLeakageCurrent(id: string, value: number) {
    updateLeakageCurrent(id, { current: value })
    rememberCommitted(leakageFieldKey(id), 'nonNegative', value)
  }

  function updateLeakageCurrent(id: string, updates: Partial<LeakageCurrent>) {
    const index = leakageCurrents.value.findIndex((l) => l.id === id)
    if (index !== -1) {
      leakageCurrents.value[index] = { ...leakageCurrents.value[index]!, ...updates }
    }
  }

  function clearHighlight(id: string) {
    if (hoveredPhaseId.value === id) {
      hoveredPhaseId.value = null
    }
    if (pinnedPhaseId.value === id) {
      pinnedPhaseId.value = null
    }
  }

  function removeLeakageCurrent(id: string) {
    leakageCurrents.value = leakageCurrents.value.filter((l) => l.id !== id)
    forgetKeysWithPrefix(leakageFieldKey(id))
    clearHighlight(id)
    if (leakageCurrents.value.length === 0) {
      clearHighlight(LEAKAGE_PHASE_ID)
    }
  }

  function removeAllLeakageCurrents() {
    for (const leakage of leakageCurrents.value) {
      clearHighlight(leakage.id)
    }
    clearHighlight(LEAKAGE_PHASE_ID)
    leakageCurrents.value = []
    const next = { ...lastLegal.value }
    for (const key of Object.keys(next)) {
      if (key.startsWith('leakage.')) {
        delete next[key]
      }
    }
    lastLegal.value = next
  }

  function createPhaseId(): string {
    return `phase-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }

  function rememberCommitted(key: string, rule: FieldIssue['rule'], value: number) {
    if (!isLegal(rule, value)) {
      return
    }
    lastLegal.value = { ...lastLegal.value, [key]: value }
  }

  function forgetKeysWithPrefix(prefix: string) {
    const next = { ...lastLegal.value }
    for (const key of Object.keys(next)) {
      if (key.startsWith(prefix)) {
        delete next[key]
      }
    }
    lastLegal.value = next
  }

  function readDisplayedNumber(key: string): number | null {
    if (key === batteryFieldKey('capacity_mAh')) return battery.value.capacity_mAh
    if (key === batteryFieldKey('usablePercent')) return battery.value.usablePercent
    if (key === batteryFieldKey('selfDischargePercentPerMonth')) {
      return battery.value.selfDischargePercentPerMonth
    }
    for (const phase of phases.value) {
      if (key === phaseFieldKey(phase.id, 'current')) return phase.current
      if (key === phaseFieldKey(phase.id, 'duration')) return phase.duration
      if (key === phaseFieldKey(phase.id, 'frequency')) return phase.frequency
    }
    for (const leakage of leakageCurrents.value) {
      if (key === leakageFieldKey(leakage.id)) return leakage.current
    }
    return null
  }

  function setLeakageEnabled(enabled: boolean) {
    leakageEnabled.value = enabled
  }

  lastLegal.value = legalSnapshot(state.value)

  return {
    battery,
    phases,
    leakageEnabled,
    hoveredPhaseId,
    pinnedPhaseId,
    highlightedPhaseId,
    leakageCurrents,
    state,
    presentation,
    issueRule,
    resolvedNumber,
    updateBattery,
    commitBatteryField,
    addPhase,
    duplicatePhase,
    moveActivePhase,
    updatePhase,
    commitPhaseField,
    removePhase,
    removeAllPhases,
    resetToESP32Preset,
    replaceState,
    setHoveredPhase,
    togglePinnedPhase,
    addLeakageCurrent,
    updateLeakageCurrent,
    commitLeakageCurrent,
    removeLeakageCurrent,
    removeAllLeakageCurrents,
    setLeakageEnabled,
  }
})

