import { useCalculatorStore } from '@/stores/calculator'
import { getPhaseColorByIndex, DEEP_SLEEP_COLOR } from '@/lib/phaseColors'
import type { Phase } from '@/types/calculator'

export function usePhaseColors() {
  const store = useCalculatorStore()

  /**
   * Get the color for a phase based on its position in the phases array.
   * Non-DeepSleep phases get colors from the color array based on their index
   * (excluding DeepSleep phases). DeepSleep phases always get the gray color.
   */
  function getPhaseColor(phase: Phase): string {
    if (phase.isDeepSleep) {
      return DEEP_SLEEP_COLOR
    }

    // Get the index of this phase among non-DeepSleep phases only
    const nonDeepSleepPhases = store.phases.filter((p) => !p.isDeepSleep)
    const index = nonDeepSleepPhases.findIndex((p) => p.id === phase.id)

    if (index === -1) {
      return getPhaseColorByIndex(0) // Fallback to first color
    }

    return getPhaseColorByIndex(index)
  }

  return {
    getPhaseColor,
  }
}

