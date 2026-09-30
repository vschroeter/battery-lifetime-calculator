<script setup lang="ts">
import { computed, onMounted, watch, ref } from 'vue'
import * as d3 from 'd3'
import { useLocale } from '@/composables/useLocale'
import { useCalculatorStore } from '@/stores/calculator'
import { getColorForPhaseId } from '@/lib/phaseColors'
import { leakageAggregateName, leakageShareLit, LEAKAGE_PHASE_ID } from '@/lib/leakage'
import { getMessage } from '@/i18n/messages'
import { formatChargePerDay, formatPercent, formatQuantity } from '@/lib/format'
import type { PhaseResult } from '@/types/calculator'

interface Props {
  phaseResults: PhaseResult[]
}

const props = defineProps<Props>()
const { i18n, locale } = useLocale()
const store = useCalculatorStore()

const chartContainer = ref<SVGElement | null>(null)

// A zero-charge slice, including a deep-sleep remainder of 0 mAh, is omitted.
const shareResults = computed(() =>
  props.phaseResults.filter((result) => result.mAhPerDay > 0),
)

const total = computed(() =>
  shareResults.value.reduce((sum, r) => sum + r.mAhPerDay, 0),
)

// Sort phases by share (mAhPerDay) descending
const sortedPhaseResults = computed(() =>
  [...shareResults.value].sort((a, b) => b.mAhPerDay - a.mAhPerDay),
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
const LEAKAGE_CURRENT_WIDTH = 25 // Between deep sleep and active
const DEEPSLEEP_WIDTH = 20 // Thinnest

// Outer radius (same for all)
const outerRadius = Math.min(width, height) / 2

const leakageSourceIds = computed(() =>
  props.phaseResults.find((result) => result.phaseId === LEAKAGE_PHASE_ID)?.leakageSources?.map((source) => source.id) ?? [],
)

function shareOpaque(phaseId: string): number {
  const highlighted = store.highlightedPhaseId
  if (highlighted === null) {
    return 1
  }
  if (phaseId === LEAKAGE_PHASE_ID) {
    return leakageShareLit(highlighted, leakageSourceIds.value) ? 1 : 0.3
  }
  return highlighted === phaseId ? 1 : 0.3
}

function segmentName(result: PhaseResult): string {
  if (result.phaseId === LEAKAGE_PHASE_ID && result.leakageSources) {
    return leakageAggregateName(result.leakageSources, {
      group: getMessage(locale.value, 'leakageCurrents'),
      source: getMessage(locale.value, 'leakageSourceNumber'),
    })
  }
  return result.phaseName
}

function getPhaseType(result: PhaseResult): 'active' | 'self-discharge' | 'leakage-current' | 'deepsleep' {
  if (result.phaseId === 'self-discharge-virtual') {
    return 'self-discharge'
  }
  if (result.phaseId === LEAKAGE_PHASE_ID) {
    return 'leakage-current'
  }
  const phase = store.phases.find((p) => p.id === result.phaseId)
  if (phase?.isDeepSleep) {
    return 'deepsleep'
  }
  return 'active'
}

function getInnerRadius(phaseType: 'active' | 'self-discharge' | 'leakage-current' | 'deepsleep'): number {
  switch (phaseType) {
    case 'active':
      return outerRadius - ACTIVE_WIDTH
    case 'self-discharge':
      return outerRadius - SELF_DISCHARGE_WIDTH
    case 'leakage-current':
      return outerRadius - LEAKAGE_CURRENT_WIDTH
    case 'deepsleep':
      return outerRadius - DEEPSLEEP_WIDTH
  }
}

function getColorForPhaseResult(result: PhaseResult): string {
  // Handle virtual phases (leakage currents, self-discharge)
  if (result.phaseId === LEAKAGE_PHASE_ID || result.phaseId === 'self-discharge-virtual') {
    return getColorForPhaseId(
      result.phaseId,
      nonDeepSleepPhases.value.map((p) => p.id),
      false, // Not a DeepSleep phase
    )
  }

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
    .padAngle(0.05 / sortedPhaseResults.value.length) // Small gap between segments

  const pieData = pie(sortedPhaseResults.value)

  // const cornerRadius = 10 / sortedPhaseResults.value.length;
  const cornerRadius = 2;

  // Create arc generators for each phase type
  const activeArc = d3
    .arc<d3.PieArcDatum<PhaseResult>>()
    .innerRadius(getInnerRadius('active'))
    .outerRadius(outerRadius)
    .cornerRadius(cornerRadius)

  const selfDischargeArc = d3
    .arc<d3.PieArcDatum<PhaseResult>>()
    .innerRadius(getInnerRadius('self-discharge'))
    .outerRadius(outerRadius)
    .cornerRadius(cornerRadius)
  const leakageCurrentArc = d3
    .arc<d3.PieArcDatum<PhaseResult>>()
    .innerRadius(getInnerRadius('leakage-current'))
    .outerRadius(outerRadius)
    .cornerRadius(cornerRadius)
  const deepsleepArc = d3
    .arc<d3.PieArcDatum<PhaseResult>>()
    .innerRadius(getInnerRadius('deepsleep'))
    .outerRadius(outerRadius)
    .cornerRadius(cornerRadius)

  function getArc(d: d3.PieArcDatum<PhaseResult>) {
    const phaseType = getPhaseType(d.data)
    switch (phaseType) {
      case 'active':
        return activeArc
      case 'self-discharge':
        return selfDischargeArc
      case 'leakage-current':
        return leakageCurrentArc
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
    .style('opacity', (d) => shareOpaque(d.data.phaseId))
    .on('mouseenter', function (_event, d) {
      store.setHoveredPhase(d.data.phaseId)
    })
    .on('mouseleave', function () {
      store.setHoveredPhase(null)
    })
    .on('click', function (_event, d) {
      store.togglePinnedPhase(d.data.phaseId)
    })
}

function updateArcStyles() {
  if (!chartContainer.value) {
    return
  }
  const svg = d3.select(chartContainer.value)
  svg.selectAll<SVGPathElement, d3.PieArcDatum<PhaseResult>>('path.arc-path').style('opacity', function (d) {
    return shareOpaque(d.data.phaseId)
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
  () => store.highlightedPhaseId,
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
      phaseName: segmentName(result),
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
      <div v-if="total > 0" class="chart-layout">
        <svg
          ref="chartContainer"
          :width="width"
          :height="height"
          class="donut-chart"
        />
        <div class="chart-legend">
          <div
            v-for="seg in segments"
            :key="seg.phaseId"
            class="d-flex align-center mb-2 legend-entry"
            :class="{ 'legend-entry-highlighted': shareOpaque(seg.phaseId) === 1 && store.highlightedPhaseId !== null }"
            :style="{ opacity: shareOpaque(seg.phaseId) }"
            @mouseenter="store.setHoveredPhase(seg.phaseId)"
            @mouseleave="store.setHoveredPhase(null)"
            @click="store.togglePinnedPhase(seg.phaseId)"
          >
            <div
              class="legend-color"
              :style="{
                backgroundColor: getColorForPhaseResult(seg),
              }"
            />
            <span class="ml-2 text-body-2">
              {{ seg.phaseName }}: {{ formatPercent(seg.percentage) }}
              ({{ formatQuantity(formatChargePerDay(seg.mAhPerDay)) }})
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
.chart-layout {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.donut-chart {
  flex: 0 0 auto;
}

.chart-legend {
  flex: 1 1 12rem;
  min-width: min(100%, 12rem);
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

