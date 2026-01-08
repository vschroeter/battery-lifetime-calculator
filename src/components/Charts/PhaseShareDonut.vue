<script setup lang="ts">
import { computed, onMounted, watch, ref } from 'vue'
import * as d3 from 'd3'
import { useLocale } from '@/composables/useLocale'
import { useCalculatorStore } from '@/stores/calculator'
import { getColorForPhaseId } from '@/lib/phaseColors'
import type { PhaseResult } from '@/types/calculator'

interface Props {
  phaseResults: PhaseResult[]
}

const props = defineProps<Props>()
const { i18n } = useLocale()
const store = useCalculatorStore()

const chartContainer = ref<SVGElement | null>(null)

const total = computed(() =>
  props.phaseResults.reduce((sum, r) => sum + r.mAhPerDay, 0),
)

// Sort phases by share (mAhPerDay) descending
const sortedPhaseResults = computed(() =>
  [...props.phaseResults].sort((a, b) => b.mAhPerDay - a.mAhPerDay),
)

// Get all non-DeepSleep phases to determine color indices
const nonDeepSleepPhases = computed(() =>
  store.phases.filter((p) => !p.isDeepSleep),
)

// Chart dimensions
const width = 200
const height = 200
const centerX = width / 2
const centerY = height / 2

// Widths for different phase types
const ACTIVE_WIDTH = 40 // Thickest
const SELF_DISCHARGE_WIDTH = 30 // Medium
const DEEPSLEEP_WIDTH = 20 // Thinnest

// Outer radius (same for all)
const outerRadius = Math.min(width, height) / 2

function getPhaseType(result: PhaseResult): 'active' | 'self-discharge' | 'deepsleep' {
  if (result.phaseId === 'self-discharge-virtual') {
    return 'self-discharge'
  }
  const phase = store.phases.find((p) => p.id === result.phaseId)
  if (phase?.isDeepSleep) {
    return 'deepsleep'
  }
  return 'active'
}

function getInnerRadius(phaseType: 'active' | 'self-discharge' | 'deepsleep'): number {
  switch (phaseType) {
    case 'active':
      return outerRadius - ACTIVE_WIDTH
    case 'self-discharge':
      return outerRadius - SELF_DISCHARGE_WIDTH
    case 'deepsleep':
      return outerRadius - DEEPSLEEP_WIDTH
  }
}

function getColorForPhaseResult(result: PhaseResult): string {
  const phase = store.phases.find((p) => p.id === result.phaseId)
  const nonDeepSleepPhaseIds = nonDeepSleepPhases.value.map((p) => p.id)
  
  return getColorForPhaseId(
    result.phaseId,
    nonDeepSleepPhaseIds,
    phase?.isDeepSleep ?? false,
  )
}

function renderChart() {
  if (!chartContainer.value || total.value === 0) {
    return
  }

  // Clear previous content
  d3.select(chartContainer.value).selectAll('*').remove()

  const svg = d3.select(chartContainer.value)

  // Create pie generator
  const pie = d3
    .pie<PhaseResult>()
    .value((d) => d.mAhPerDay)
    .sort(null)
    .padAngle(0.01) // Small gap between segments

  const pieData = pie(sortedPhaseResults.value)

  // Create arc generators for each phase type
  const activeArc = d3
    .arc<d3.PieArcDatum<PhaseResult>>()
    .innerRadius(getInnerRadius('active'))
    .outerRadius(outerRadius)

  const selfDischargeArc = d3
    .arc<d3.PieArcDatum<PhaseResult>>()
    .innerRadius(getInnerRadius('self-discharge'))
    .outerRadius(outerRadius)

  const deepsleepArc = d3
    .arc<d3.PieArcDatum<PhaseResult>>()
    .innerRadius(getInnerRadius('deepsleep'))
    .outerRadius(outerRadius)

  function getArc(d: d3.PieArcDatum<PhaseResult>) {
    const phaseType = getPhaseType(d.data)
    switch (phaseType) {
      case 'active':
        return activeArc
      case 'self-discharge':
        return selfDischargeArc
      case 'deepsleep':
        return deepsleepArc
    }
  }

  // Create groups for each arc
  const arcs = svg
    .selectAll('g.arc')
    .data(pieData)
    .enter()
    .append('g')
    .attr('class', 'arc')
    .attr('transform', `translate(${centerX},${centerY})`)

  // Draw arcs
  arcs
    .append('path')
    .attr('d', (d) => getArc(d)?.(d) ?? '')
    .attr('fill', (d) => getColorForPhaseResult(d.data))
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('class', (d) => `arc-path arc-${d.data.phaseId}`)
    .attr('data-phase-id', (d) => d.data.phaseId)
    .style('cursor', 'pointer')
    .style('transition', 'opacity 0.2s ease')
    .style('opacity', (d) => {
      if (store.hoveredPhaseId === null) {
        return 1
      }
      return store.hoveredPhaseId === d.data.phaseId ? 1 : 0.3
    })
    .on('mouseenter', function (event, d) {
      store.setHoveredPhase(d.data.phaseId)
    })
    .on('mouseleave', function () {
      store.setHoveredPhase(null)
    })
}

function updateArcStyles() {
  if (!chartContainer.value) {
    return
  }
  const svg = d3.select(chartContainer.value)
  svg.selectAll<SVGPathElement, d3.PieArcDatum<PhaseResult>>('path.arc-path').style('opacity', function (d) {
    if (store.hoveredPhaseId === null) {
      return 1
    }
    return store.hoveredPhaseId === d.data.phaseId ? 1 : 0.3
  })
}

onMounted(() => {
  renderChart()
})

watch(
  () => props.phaseResults,
  () => {
    renderChart()
  },
  { deep: true, immediate: false },
)

watch(
  () => total.value,
  () => {
    renderChart()
  },
)

watch(
  () => store.hoveredPhaseId,
  () => {
    updateArcStyles()
  },
)

const segments = computed(() => {
  if (total.value === 0) {
    return []
  }

  return sortedPhaseResults.value.map((result) => {
    const percentage = (result.mAhPerDay / total.value) * 100
    return {
      ...result,
      percentage,
    }
  })
})
</script>

<template>
  <v-card class="modern-card" elevation="1">
    <v-card-title class="text-subtitle-1 pa-3 pb-2">
      {{ i18n.t('consumptionShareByPhase') }}
    </v-card-title>
    <v-card-text class="pa-3 pt-2">
      <div v-if="total > 0" class="d-flex align-center ga-4">
        <svg
          ref="chartContainer"
          :width="width"
          :height="height"
          class="donut-chart"
        />
        <div class="flex-grow-1">
          <div
            v-for="seg in segments"
            :key="seg.phaseId"
            class="d-flex align-center mb-2 legend-entry"
            :class="{ 'legend-entry-highlighted': store.hoveredPhaseId === seg.phaseId }"
            :style="{
              opacity: store.hoveredPhaseId === null || store.hoveredPhaseId === seg.phaseId ? 1 : 0.3,
            }"
            @mouseenter="store.setHoveredPhase(seg.phaseId)"
            @mouseleave="store.setHoveredPhase(null)"
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
  flex-shrink: 0;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
}

.legend-entry {
  cursor: pointer;
  transition: opacity 0.2s ease;
  padding: 2px 4px;
  border-radius: 4px;
}

.legend-entry-highlighted {
  background-color: rgba(0, 0, 0, 0.05);
}
</style>

