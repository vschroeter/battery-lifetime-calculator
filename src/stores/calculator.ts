import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  BatteryConfig,
  Phase,
  CalculatorState,
  LeakageCurrent,
} from '@/types/calculator'

export const useCalculatorStore = defineStore('calculator', () => {
  // State
  const battery = ref<BatteryConfig>({
    capacity_mAh: 1000,
    usablePercent: 80,
    selfDischargePercentPerMonth: 0,
  })

  const phases = ref<Phase[]>([
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
  ])

  const hoveredPhaseId = ref<string | null>(null)

  const leakageCurrents = ref<LeakageCurrent[]>([])

  // Getters
  const state = computed<CalculatorState>(() => ({
    battery: battery.value,
    phases: phases.value,
    leakageCurrents: leakageCurrents.value,
  }))

  // Actions
  function updateBattery(config: Partial<BatteryConfig>) {
    battery.value = { ...battery.value, ...config }
  }

  function addPhase(phase: Omit<Phase, 'id'>) {
    const newPhase: Phase = {
      ...phase,
      id: `phase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }
    phases.value.push(newPhase)
  }

  function updatePhase(id: string, updates: Partial<Phase>) {
    const index = phases.value.findIndex((p) => p.id === id)
    if (index !== -1) {
      phases.value[index] = { ...phases.value[index]!, ...updates }
    }
  }

  function removePhase(id: string) {
    phases.value = phases.value.filter((p) => p.id !== id)
  }

  function removeAllPhases() {
    phases.value = phases.value.filter((p) => p.isDeepSleep)
  }

  function resetToESP32Preset() {
    battery.value = {
      capacity_mAh: 1000,
      usablePercent: 80,
      selfDischargePercentPerMonth: 0,
    }
    phases.value = [
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
    leakageCurrents.value = []
  }

  function setHoveredPhase(id: string | null) {
    hoveredPhaseId.value = id
  }

  function addLeakageCurrent(leakage: Omit<LeakageCurrent, 'id'>) {
    const newLeakage: LeakageCurrent = {
      ...leakage,
      id: `leakage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }
    leakageCurrents.value.push(newLeakage)
  }

  function updateLeakageCurrent(id: string, updates: Partial<LeakageCurrent>) {
    const index = leakageCurrents.value.findIndex((l) => l.id === id)
    if (index !== -1) {
      leakageCurrents.value[index] = { ...leakageCurrents.value[index]!, ...updates }
    }
  }

  function removeLeakageCurrent(id: string) {
    leakageCurrents.value = leakageCurrents.value.filter((l) => l.id !== id)
  }

  function removeAllLeakageCurrents() {
    leakageCurrents.value = []
  }

  return {
    battery,
    phases,
    hoveredPhaseId,
    leakageCurrents,
    state,
    updateBattery,
    addPhase,
    updatePhase,
    removePhase,
    removeAllPhases,
    resetToESP32Preset,
    setHoveredPhase,
    addLeakageCurrent,
    updateLeakageCurrent,
    removeLeakageCurrent,
    removeAllLeakageCurrents,
  }
})

