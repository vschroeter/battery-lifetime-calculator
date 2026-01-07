import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  BatteryConfig,
  Phase,
  PhaseMode,
  CalculatorState,
  CalculationResult,
} from '@/types/calculator'

export const useCalculatorStore = defineStore('calculator', () => {
  // State
  const battery = ref<BatteryConfig>({
    capacity_mAh: 1000,
    usablePercent: 100,
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
      mode: 'interval',
      interval: 60,
      intervalUnit: 's',
    },
    {
      id: 'deepsleep-1',
      name: 'DeepSleep',
      isDeepSleep: true,
      current: 0.01,
      currentUnit: 'mA',
      duration: 0,
      durationUnit: 's',
      mode: 'interval',
    },
  ])

  const defaultPhaseMode = ref<PhaseMode>('interval')

  // Getters
  const state = computed<CalculatorState>(() => ({
    battery: battery.value,
    phases: phases.value,
    defaultPhaseMode: defaultPhaseMode.value,
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
      phases.value[index] = { ...phases.value[index], ...updates }
    }
  }

  function removePhase(id: string) {
    phases.value = phases.value.filter((p) => p.id !== id)
  }

  function setDefaultPhaseMode(mode: PhaseMode) {
    defaultPhaseMode.value = mode
  }

  function resetToESP32Preset() {
    battery.value = {
      capacity_mAh: 1000,
      usablePercent: 100,
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
        mode: 'interval',
        interval: 60,
        intervalUnit: 's',
      },
      {
        id: 'deepsleep-1',
        name: 'DeepSleep',
        isDeepSleep: true,
        current: 0.01,
        currentUnit: 'mA',
        duration: 0,
        durationUnit: 's',
        mode: 'interval',
      },
    ]
    defaultPhaseMode.value = 'interval'
  }

  return {
    battery,
    phases,
    defaultPhaseMode,
    state,
    updateBattery,
    addPhase,
    updatePhase,
    removePhase,
    setDefaultPhaseMode,
    resetToESP32Preset,
  }
})

