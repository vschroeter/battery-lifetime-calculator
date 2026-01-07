<script setup lang="ts">
import { computed } from 'vue'
import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'
import { convertIntervalToSeconds, convertDurationToSeconds } from '@/lib/units'
import { getPhaseColorByIndex, DEEP_SLEEP_COLOR } from '@/lib/phaseColors'
import type { Phase } from '@/types/calculator'

const store = useCalculatorStore()
const { i18n } = useLocale()

// Find the most common interval from Mode A phases
const referenceInterval = computed(() => {
  const intervals = new Map<number, number>()

  for (const phase of store.phases) {
    if (!phase.isDeepSleep && phase.mode === 'interval' && phase.interval && phase.intervalUnit) {
      const seconds = convertIntervalToSeconds(phase.interval, phase.intervalUnit)
      intervals.set(seconds, (intervals.get(seconds) || 0) + 1)
    }
  }

  if (intervals.size === 0) {
    return 60 // Default to 60 seconds
  }

  let maxCount = 0
  let mostCommon = 60
  for (const [seconds, count] of intervals.entries()) {
    if (count > maxCount) {
      maxCount = count
      mostCommon = seconds
    }
  }

  return mostCommon
})

const timelinePhases = computed(() => {
  const phases: Array<{
    phase: Phase
    startSeconds: number
    durationSeconds: number
    color: string
  }> = []

  // Get all non-DeepSleep phases to determine color indices
  const allNonDeepSleepPhases = store.phases.filter((p) => !p.isDeepSleep)
  let currentTime = 0
  let colorIdx = 0

  // Only include phases that match the reference interval
  for (const phase of store.phases) {
    if (phase.isDeepSleep) continue

    if (phase.mode === 'interval' && phase.interval && phase.intervalUnit) {
      const intervalSeconds = convertIntervalToSeconds(phase.interval, phase.intervalUnit)

      if (intervalSeconds === referenceInterval.value) {
        const durationSeconds = convertDurationToSeconds(phase.duration, phase.durationUnit)

        if (currentTime + durationSeconds <= referenceInterval.value) {
          // Find the index of this phase among all non-DeepSleep phases
          const phaseIndex = allNonDeepSleepPhases.findIndex((p) => p.id === phase.id)
          const color = phaseIndex !== -1
            ? getPhaseColorByIndex(phaseIndex)
            : getPhaseColorByIndex(colorIdx)

          phases.push({
            phase,
            startSeconds: currentTime,
            durationSeconds,
            color,
          })
          currentTime += durationSeconds
          colorIdx++
        }
      }
    }
  }

  // Add DeepSleep as remainder
  const deepSleepPhase = store.phases.find((p) => p.isDeepSleep)
  if (deepSleepPhase && currentTime < referenceInterval.value) {
    phases.push({
      phase: deepSleepPhase,
      startSeconds: currentTime,
      durationSeconds: referenceInterval.value - currentTime,
      color: DEEP_SLEEP_COLOR,
    })
  }

  return phases
})

function getPercentage(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0
}
</script>

<template>
  <v-card variant="outlined">
    <v-card-title class="text-subtitle-1">
      {{ i18n.t('cycleTimeline') }} ({{ referenceInterval }}s interval)
    </v-card-title>
    <v-card-text>
      <div v-if="timelinePhases.length > 0" class="timeline-container">
        <div class="timeline-bar">
          <div
            v-for="(item, idx) in timelinePhases"
            :key="`${item.phase.id}-${idx}`"
            class="timeline-segment"
            :style="{
              left: `${getPercentage(item.startSeconds, referenceInterval)}%`,
              width: `${getPercentage(item.durationSeconds, referenceInterval)}%`,
              backgroundColor: item.color,
            }"
            :title="`${item.phase.name}: ${item.durationSeconds.toFixed(2)}s`"
          />
        </div>
        <div class="timeline-legend mt-3">
          <div
            v-for="item in timelinePhases"
            :key="item.phase.id"
            class="d-flex align-center mb-1"
          >
            <div
              class="legend-color"
              :style="{ backgroundColor: item.color }"
            />
            <span class="ml-2 text-body-2">
              {{ item.phase.name }}: {{ item.durationSeconds.toFixed(2) }}s
              ({{ getPercentage(item.durationSeconds, referenceInterval).toFixed(1) }}%)
            </span>
          </div>
        </div>
      </div>
      <v-alert v-else type="info" variant="tonal" density="compact">
        No phases with matching interval found
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.timeline-container {
  width: 100%;
}

.timeline-bar {
  width: 100%;
  height: 40px;
  background-color: #e0e0e0;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

.timeline-segment {
  position: absolute;
  height: 100%;
  transition: all 0.3s ease;
  cursor: pointer;
}

.timeline-segment:hover {
  opacity: 0.8;
  z-index: 10;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
}
</style>

