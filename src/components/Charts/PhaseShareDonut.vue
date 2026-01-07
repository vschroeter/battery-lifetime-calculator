<script setup lang="ts">
import { computed } from 'vue'
import { useLocale } from '@/composables/useLocale'
import { useCalculatorStore } from '@/stores/calculator'
import { getPhaseColorByIndex, DEEP_SLEEP_COLOR } from '@/lib/phaseColors'
import type { PhaseResult } from '@/types/calculator'

interface Props {
  phaseResults: PhaseResult[]
}

const props = defineProps<Props>()
const { i18n } = useLocale()
const store = useCalculatorStore()

const total = computed(() =>
  props.phaseResults.reduce((sum, r) => sum + r.mAhPerDay, 0),
)

// Get all non-DeepSleep phases to determine color indices
const nonDeepSleepPhases = computed(() =>
  store.phases.filter((p) => !p.isDeepSleep),
)

const segments = computed(() => {
  if (total.value === 0) {
    return []
  }

  let currentAngle = 0
  return props.phaseResults.map((result) => {
    const percentage = (result.mAhPerDay / total.value) * 100
    const angle = (percentage / 100) * 360
    const startAngle = currentAngle
    currentAngle += angle

    return {
      ...result,
      percentage,
      startAngle,
      angle,
    }
  })
})

function getColorForPhaseResult(result: PhaseResult): string {
  // Check if this is a DeepSleep phase by looking it up in the store
  const phase = store.phases.find((p) => p.id === result.phaseId)

  if (phase?.isDeepSleep) {
    return DEEP_SLEEP_COLOR
  }

  // For non-DeepSleep phases, find the index among non-DeepSleep phases
  const phaseIndex = nonDeepSleepPhases.value.findIndex(
    (p) => p.id === result.phaseId,
  )

  if (phaseIndex === -1) {
    return getPhaseColorByIndex(0) // Fallback
  }

  return getPhaseColorByIndex(phaseIndex)
}

function getConicGradient() {
  if (segments.value.length === 0) {
    return 'conic-gradient(grey 0deg 360deg)'
  }

  const stops = segments.value.map((seg) => {
    const color = getColorForPhaseResult(seg)
    const start = seg.startAngle
    const end = seg.startAngle + seg.angle
    return `${color} ${start}deg ${end}deg`
  })

  return `conic-gradient(${stops.join(', ')})`
}
</script>

<template>
  <v-card class="modern-card" elevation="1">
    <v-card-title class="text-subtitle-1 pa-3 pb-2">
      {{ i18n.t('consumptionShareByPhase') }}
    </v-card-title>
    <v-card-text class="pa-3 pt-2">
      <div v-if="total > 0" class="d-flex align-center ga-4">
        <div
          class="donut-chart"
          :style="{ background: getConicGradient() }"
        />
        <div class="flex-grow-1">
          <div
            v-for="seg in segments"
            :key="seg.phaseId"
            class="d-flex align-center mb-2"
          >
            <div
              class="legend-color"
              :style="{
                backgroundColor: getColorForPhaseResult(seg),
              }"
            />
            <span class="ml-2 text-body-2">
              {{ seg.phaseName }}: {{ seg.percentage.toFixed(1) }}%
              ({{ seg.mAhPerDay.toFixed(2) }} mAh/day)
            </span>
          </div>
        </div>
      </div>
      <v-alert v-else type="info" variant="tonal" density="compact">
        {{ i18n.t('noDataToDisplay') }}
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.modern-card {
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}
.donut-chart {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: conic-gradient(grey 0deg 360deg);
  position: relative;
  flex-shrink: 0;
}

.donut-chart::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60%;
  height: 60%;
  background: white;
  border-radius: 50%;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
}
</style>

