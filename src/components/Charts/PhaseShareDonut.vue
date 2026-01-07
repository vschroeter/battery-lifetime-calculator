<script setup lang="ts">
import { computed } from 'vue'
import { useLocale } from '@/composables/useLocale'
import type { PhaseResult } from '@/types/calculator'

interface Props {
  phaseResults: PhaseResult[]
}

const props = defineProps<Props>()
const { i18n } = useLocale()

const total = computed(() =>
  props.phaseResults.reduce((sum, r) => sum + r.mAhPerDay, 0),
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

function getConicGradient() {
  if (segments.value.length === 0) {
    return 'conic-gradient(grey 0deg 360deg)'
  }

  const colors = [
    '#1976d2',
    '#388e3c',
    '#f57c00',
    '#d32f2f',
    '#7b1fa2',
    '#0288d1',
    '#c2185b',
    '#00796b',
  ]

  const stops = segments.value.map((seg, idx) => {
    const color = colors[idx % colors.length]
    const start = seg.startAngle
    const end = seg.startAngle + seg.angle
    return `${color} ${start}deg ${end}deg`
  })

  return `conic-gradient(${stops.join(', ')})`
}
</script>

<template>
  <v-card variant="outlined">
    <v-card-title class="text-subtitle-1">
      {{ i18n.t('consumptionShareByPhase') }}
    </v-card-title>
    <v-card-text>
      <div v-if="total > 0" class="d-flex align-center ga-4">
        <div
          class="donut-chart"
          :style="{ background: getConicGradient() }"
        />
        <div class="flex-grow-1">
          <div
            v-for="(seg, idx) in segments"
            :key="seg.phaseId"
            class="d-flex align-center mb-2"
          >
            <div
              class="legend-color"
              :style="{
                backgroundColor: `hsl(${(idx * 360) / segments.length}, 70%, 50%)`,
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

