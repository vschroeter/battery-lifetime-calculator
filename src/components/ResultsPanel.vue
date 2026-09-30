<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'
import {
  formatActiveTime,
  formatChargePerDay,
  formatCount,
  formatCurrentFromMilliAmps,
  formatFixed,
  formatQuantity,
  runtimeYearsVisible,
} from '@/lib/format'
import {
  leakageAggregateName,
  leakageParentLit,
  leakageSourceLit,
  leakageSourceName,
  LEAKAGE_PHASE_ID,
  type LeakageNameLabels,
} from '@/lib/leakage'
import { batteryFieldKey } from '@/lib/fields'
import { getMessage } from '@/i18n/messages'
import PhaseShareDonut from '@/components/Charts/PhaseShareDonut.vue'
import type { PhaseResult } from '@/types/calculator'

const store = useCalculatorStore()
const { i18n, locale } = useLocale()
const leakageExpanded = ref(false)

const presentation = computed(() => store.presentation)
const displayResult = computed(() => presentation.value.result)

const averageCurrent = computed(() =>
  displayResult.value
    ? formatCurrentFromMilliAmps(displayResult.value.averageCurrent_mA)
    : null,
)
const dailyCharge = computed(() =>
  displayResult.value ? formatChargePerDay(displayResult.value.totalmAhPerDay) : null,
)

function formatRuntime(value: number): string {
  return formatFixed(value, 1, locale.value)
}

const showYears = computed(() =>
  displayResult.value ? runtimeYearsVisible(displayResult.value.runtimeYears) : false,
)

const statusLine = computed(() => {
  const count = presentation.value.issues.length
  if (count === 0) {
    return ''
  }
  const key = presentation.value.withheld
    ? count === 1
      ? 'resultsWithheldOne'
      : 'resultsWithheldMany'
    : count === 1
      ? 'resultsHeldOne'
      : 'resultsHeldMany'
  return i18n.t(key).replace('{count}', String(count))
})

function eventsLabel(events: number): string {
  return events > 0 ? formatCount(events) : i18n.t('notAvailable')
}

function activeTimeLabel(result: { phaseId: string; activeTimePerDaySeconds: number }): string {
  if (result.activeTimePerDaySeconds > 0) {
    return formatQuantity(formatActiveTime(result.activeTimePerDaySeconds))
  }
  const phase = store.phases.find((item) => item.id === result.phaseId)
  if (phase?.isDeepSleep) {
    return formatQuantity(formatActiveTime(0))
  }
  return i18n.t('auto')
}

function formatBudgetSeconds(seconds: number): string {
  const rounded = Math.round(seconds * 1000) / 1000
  if (Number.isInteger(rounded)) {
    return rounded.toFixed(0)
  }
  return rounded.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

const showEfficiencyCaption = computed(() => {
  const efficiency = store.resolvedNumber(batteryFieldKey('efficiencyPercent'))
  return displayResult.value !== null && efficiency !== null && efficiency !== 100
})

const dayBudgetMessage = computed(() => {
  const seconds = displayResult.value?.activeTimePerDaySeconds ?? 0
  return i18n
    .t('dayBudgetExceeded')
    .replace('{hours}', (seconds / 3600).toFixed(2))
    .replace('{seconds}', formatBudgetSeconds(seconds))
})

interface TableRow {
  key: string
  phaseId: string
  name: string
  mAhPerDay: number
  events: string | null
  activeTime: string | null
  child: boolean
  expandable: boolean
  lit: boolean
}

const leakageNames = computed<LeakageNameLabels>(() => ({
  group: getMessage(locale.value, 'leakageCurrents'),
  source: getMessage(locale.value, 'leakageSourceNumber'),
}))

const tableRows = computed<TableRow[]>(() => {
  const result = displayResult.value
  if (!result) {
    return []
  }
  const rows: TableRow[] = []
  for (const phase of result.phaseResults) {
    if (phase.phaseId === LEAKAGE_PHASE_ID && phase.leakageSources) {
      rows.push(...leakageRows(phase))
      continue
    }
    rows.push(phaseRow(phase))
  }
  return rows
})

function phaseRow(phase: PhaseResult): TableRow {
  const highlighted = store.highlightedPhaseId
  return {
    key: phase.phaseId,
    phaseId: phase.phaseId,
    name: phase.phaseName,
    mAhPerDay: phase.mAhPerDay,
    events: eventsLabel(phase.eventsPerDay),
    activeTime: activeTimeLabel(phase),
    child: false,
    expandable: false,
    lit: highlighted === null || highlighted === phase.phaseId,
  }
}

function leakageRows(phase: PhaseResult): TableRow[] {
  const sources = phase.leakageSources ?? []
  const sourceIds = sources.map((source) => source.id)
  const nestOpen = leakageExpanded.value && sources.length > 1
  const highlighted = store.highlightedPhaseId
  const parentLit = leakageParentLit(highlighted, sourceIds, nestOpen)
  const rows: TableRow[] = [
    {
      key: phase.phaseId,
      phaseId: phase.phaseId,
      name: leakageAggregateName(sources, leakageNames.value),
      mAhPerDay: phase.mAhPerDay,
      events: eventsLabel(phase.eventsPerDay),
      activeTime: activeTimeLabel(phase),
      child: false,
      expandable: sources.length > 1,
      lit: parentLit,
    },
  ]
  if (!nestOpen) {
    return rows
  }
  sources.forEach((source, index) => {
    rows.push({
      key: source.id,
      phaseId: source.id,
      name: leakageSourceName(source.label, index + 1, leakageNames.value),
      mAhPerDay: source.mAhPerDay,
      events: null,
      activeTime: null,
      child: true,
      expandable: false,
      lit: leakageSourceLit(highlighted, source.id),
    })
  })
  return rows
}

function isHighlighted(row: TableRow): boolean {
  return store.highlightedPhaseId !== null && row.lit
}
</script>

<template>
  <v-card class="modern-card results-card" elevation="1">
    <v-card-title class="text-h6 pa-4 pb-2 results-card-header">
      {{ i18n.t('results') }}
    </v-card-title>
    <v-card-text class="pa-4 pt-2 results-card-content">
      <div>
        <v-alert
          v-if="statusLine"
          type="warning"
          variant="tonal"
          class="mb-4"
        >
          {{ statusLine }}
        </v-alert>

        <template v-if="displayResult">
        <v-alert
          v-if="displayResult.dayBudgetExceeded"
          type="error"
          variant="tonal"
          class="mb-4"
        >
          {{ dayBudgetMessage }}
        </v-alert>

        <!-- Warnings -->
        <v-alert
          v-if="displayResult.warnings.length > 0"
          type="warning"
          variant="tonal"
          class="mb-4"
        >
          <div class="font-weight-bold mb-2">{{ i18n.t('warnings') }}:</div>
          <ul class="ma-0">
            <li v-for="(warning, idx) in displayResult.warnings" :key="idx">
              {{ warning }}
            </li>
          </ul>
        </v-alert>

        <!-- KPIs -->
        <div v-if="!displayResult.dayBudgetExceeded" class="d-flex flex-column ga-3">
          <div class="d-flex ga-3 flex-wrap">
            <v-card class="result-tile modern-card flex-grow-1" elevation="1" style="min-width: 200px">
              <v-card-text class="pa-3">
                <div class="text-body-2 text-medium-emphasis mb-1">{{ i18n.t('averageCurrent') }}</div>
                <div class="text-h5 font-weight-medium">
                  {{ averageCurrent?.text }} <span class="text-body-1">{{ averageCurrent?.unit }}</span>
                </div>
              </v-card-text>
            </v-card>

            <v-card class="result-tile modern-card flex-grow-1" elevation="1" style="min-width: 200px">
              <v-card-text class="pa-3">
                <div class="text-body-2 text-medium-emphasis mb-1">{{ i18n.t('consumptionPerDay') }}</div>
                <div class="text-h5 font-weight-medium">
                  {{ dailyCharge?.text }} <span class="text-body-1">{{ dailyCharge?.unit }}</span>
                </div>
              </v-card-text>
            </v-card>
          </div>

          <v-card class="result-tile modern-card result-tile-emphasized" elevation="1">
            <v-card-text class="pa-3">
              <div class="text-body-2 text-medium-emphasis mb-1">{{ i18n.t('estimatedRuntime') }}</div>
              <div class="text-h4 font-weight-medium mb-1">
                {{ formatRuntime(displayResult.runtimeDays) }} <span class="text-h6">{{ i18n.t('days') }}</span>
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ formatRuntime(displayResult.runtimeWeeks) }} {{ i18n.t('weeks') }},
                {{ formatRuntime(displayResult.runtimeMonths) }} {{ i18n.t('months') }}
                ({{ i18n.t('monthNote') }})<template v-if="showYears">, {{ formatRuntime(displayResult.runtimeYears) }} {{ i18n.t('years') }}</template>
              </div>
            </v-card-text>
          </v-card>

          <!-- Visualizations -->
          <div class="d-flex flex-column ga-3 mt-3">
            <PhaseShareDonut :phase-results="displayResult.phaseResults" />
            <!-- <SensitivityBar /> -->
          </div>
        </div>

        <div
          class="d-flex flex-column ga-3"
          :class="{ 'mt-3': !displayResult.dayBudgetExceeded }"
        >
          <!-- Phase Breakdown -->
          <v-card class="modern-card" elevation="1">
            <v-card-title class="text-subtitle-1 pa-3 pb-2">
              {{ i18n.t('consumptionByPhase') }}
            </v-card-title>
            <p
              v-if="showEfficiencyCaption"
              class="text-body-2 text-medium-emphasis px-3 mb-0"
            >
              {{ i18n.t('efficiencyResultCaption') }}
            </p>
            <p
              v-if="displayResult.dayBudgetExceeded"
              class="text-body-2 text-medium-emphasis px-3 mb-0"
            >
              {{ i18n.t('dayBudgetCaption') }}
            </p>
            <v-card-text class="pa-3 pt-2">
              <v-table density="compact" class="results-table">
                <thead>
                  <tr>
                    <th class="text-body-2 font-weight-medium">{{ i18n.t('phase') }}</th>
                    <th class="text-end text-body-2 font-weight-medium">{{ i18n.t('chargePerDay') }}</th>
                    <th class="text-end text-body-2 font-weight-medium">{{ i18n.t('eventsPerDay') }}</th>
                    <th class="text-end text-body-2 font-weight-medium">{{ i18n.t('activeTimePerDay') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in tableRows"
                    :key="row.key"
                    class="phase-breakdown-row"
                    :class="{ 'phase-breakdown-row-highlighted': isHighlighted(row) }"
                    :style="{ opacity: row.lit ? 1 : 0.3 }"
                    @mouseenter="store.setHoveredPhase(row.phaseId)"
                    @mouseleave="store.setHoveredPhase(null)"
                  >
                    <td class="text-body-2">
                      <div class="phase-name-cell" :class="{ 'phase-name-child': row.child }">
                        <v-btn
                          v-if="row.expandable"
                          :icon="leakageExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right'"
                          variant="text"
                          size="x-small"
                          density="compact"
                          class="leakage-expand"
                          :aria-expanded="leakageExpanded"
                          :aria-label="i18n.t(leakageExpanded ? 'hideLeakageSources' : 'showLeakageSources')"
                          @click.stop="leakageExpanded = !leakageExpanded"
                        />
                        <span>{{ row.name }}</span>
                      </div>
                    </td>
                    <td class="text-end text-body-2">
                      {{ formatQuantity(formatChargePerDay(row.mAhPerDay)) }}
                    </td>
                    <td class="text-end text-body-2">
                      {{ row.events }}
                    </td>
                    <td class="text-end text-body-2">
                      {{ row.activeTime }}
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-card>

        </div>
        </template>
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.modern-card {
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

/* Results card layout */
.results-card {
  display: flex;
  flex-direction: column;
}

.results-card-header {
  flex-shrink: 0;
}

.results-card-content {
  flex-shrink: 0;
}

.result-tile {
  transition: box-shadow 0.2s ease;
}

.result-tile:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
}

.result-tile-emphasized {
  background: linear-gradient(135deg, rgba(var(--v-theme-success), 0.05) 0%, rgba(var(--v-theme-success), 0.02) 100%);
}

.results-table :deep(table) {
  border-collapse: separate;
  border-spacing: 0;
}

.results-table :deep(thead th) {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  padding: 8px 16px;
}

.results-table :deep(tbody td) {
  padding: 8px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.results-table :deep(tbody tr:last-child td) {
  border-bottom: none;
}

.results-table :deep(tbody tr.phase-breakdown-row) {
  transition: opacity 0.2s ease, background-color 0.2s ease;
}

.results-table :deep(tbody tr.phase-breakdown-row-highlighted td) {
  background-color: rgba(0, 0, 0, 0.05);
}

.phase-name-cell {
  display: flex;
  align-items: center;
  gap: 4px;
}

.phase-name-child {
  padding-left: 28px;
}

.leakage-expand {
  flex: 0 0 auto;
}

/* Responsive: Stack result tiles on small screens */
@media (max-width: 960px) {
  .d-flex.flex-wrap > .result-tile {
    flex-basis: 100% !important;
    min-width: 100% !important;
  }
}
</style>
