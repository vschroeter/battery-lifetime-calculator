<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'
import { calculate } from '@/lib/calc'
import { exportConfigAsJSON, exportResultsAsCSV } from '@/lib/export'
import PhaseShareDonut from '@/components/Charts/PhaseShareDonut.vue'

const store = useCalculatorStore()
const { i18n } = useLocale()
const shouldCalculate = ref(false)

const calculationResult = computed(() => {
  if (!shouldCalculate.value) {
    return null
  }
  return calculate(store.battery, store.phases, store.leakageCurrents)
})

function triggerCalculation() {
  shouldCalculate.value = true
}

// Auto-calculate on changes (live update)
const autoCalculation = computed(() => {
  return calculate(store.battery, store.phases, store.leakageCurrents)
})

const displayResult = computed(() => {
  return shouldCalculate.value ? calculationResult.value : autoCalculation.value
})
</script>

<template>
  <v-card class="modern-card results-card" elevation="1">
    <v-card-title class="d-flex justify-space-between align-center flex-wrap ga-2 pa-4 pb-2 results-card-header">
      <span class="text-h6">{{ i18n.t('results') }}</span>
      <div class="d-flex ga-2">
        <v-btn
          v-if="false"
          color="primary"
          prepend-icon="mdi-calculator"
          density="compact"
          @click="triggerCalculation"
        >
          {{ i18n.t('calculate') }}
        </v-btn>
        <v-menu>
          <template #activator="{ props: menuProps }">
            <v-btn
              color="secondary"
              prepend-icon="mdi-download"
              variant="outlined"
              density="compact"
              v-bind="menuProps"
            >
              {{ i18n.t('export') }}
            </v-btn>
          </template>
          <v-list>
            <v-list-item
              prepend-icon="mdi-code-json"
              :title="i18n.t('exportConfigJSON')"
              @click="exportConfigAsJSON(store.state)"
            />
            <v-list-item
              v-if="displayResult && displayResult.errors.length === 0"
              prepend-icon="mdi-file-excel"
              :title="i18n.t('exportResultsCSV')"
              @click="displayResult && exportResultsAsCSV(displayResult)"
            />
          </v-list>
        </v-menu>
      </div>
    </v-card-title>
    <v-card-text class="pa-4 pt-2 results-card-content">
      <div v-if="displayResult">
        <!-- Errors -->
        <v-alert
          v-if="displayResult.errors.length > 0"
          type="error"
          variant="tonal"
          class="mb-4"
        >
          <div class="font-weight-bold mb-2">{{ i18n.t('errors') }}:</div>
          <ul class="ma-0">
            <li v-for="(error, idx) in displayResult.errors" :key="idx">
              {{ error }}
            </li>
          </ul>
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
        <div v-if="displayResult.errors.length === 0" class="d-flex flex-column ga-3">
          <div class="d-flex ga-3 flex-wrap">
            <v-card class="result-tile modern-card flex-grow-1" elevation="1" style="min-width: 200px">
              <v-card-text class="pa-3">
                <div class="text-body-2 text-medium-emphasis mb-1">{{ i18n.t('averageCurrent') }}</div>
                <div class="text-h5 font-weight-medium">
                  {{ displayResult.averageCurrent_mA.toFixed(3) }} <span class="text-body-1">mA</span>
                </div>
              </v-card-text>
            </v-card>

            <v-card class="result-tile modern-card flex-grow-1" elevation="1" style="min-width: 200px">
              <v-card-text class="pa-3">
                <div class="text-body-2 text-medium-emphasis mb-1">{{ i18n.t('consumptionPerDay') }}</div>
                <div class="text-h5 font-weight-medium">
                  {{ displayResult.totalmAhPerDay.toFixed(2) }} <span class="text-body-1">mAh/day</span>
                </div>
              </v-card-text>
            </v-card>
          </div>

          <v-card class="result-tile modern-card result-tile-emphasized" elevation="1">
            <v-card-text class="pa-3">
              <div class="text-body-2 text-medium-emphasis mb-1">{{ i18n.t('estimatedRuntime') }}</div>
              <div class="text-h4 font-weight-medium mb-1">
                {{ displayResult.runtimeDays.toFixed(1) }} <span class="text-h6">{{ i18n.t('days') }}</span>
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ displayResult.runtimeWeeks.toFixed(1) }} {{ i18n.t('weeks') }},
                {{ displayResult.runtimeMonths.toFixed(1) }} {{ i18n.t('months') }}
                <template v-if="displayResult.runtimeYears > 0">
                  , {{ displayResult.runtimeYears.toFixed(1) }} {{ i18n.t('years') }}
                </template>
              </div>
            </v-card-text>
          </v-card>

          <!-- Visualizations -->
          <div class="d-flex flex-column ga-3 mt-3">
            <PhaseShareDonut :phase-results="displayResult.phaseResults" />
            <!-- <SensitivityBar /> -->
          </div>

          <!-- Phase Breakdown -->
          <v-card class="modern-card" elevation="1">
            <v-card-title class="text-subtitle-1 pa-3 pb-2">
              {{ i18n.t('consumptionByPhase') }}
            </v-card-title>
            <v-card-text class="pa-3 pt-2">
              <v-table density="compact" class="results-table">
                <thead>
                  <tr>
                    <th class="text-body-2 font-weight-medium">{{ i18n.t('phase') }}</th>
                    <th class="text-end text-body-2 font-weight-medium">mAh/day</th>
                    <th class="text-end text-body-2 font-weight-medium">{{ i18n.t('eventsPerDay') }}</th>
                    <th class="text-end text-body-2 font-weight-medium">{{ i18n.t('activeTimePerDay') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="result in displayResult.phaseResults"
                    :key="result.phaseId"
                    class="phase-breakdown-row"
                    :class="{ 'phase-breakdown-row-highlighted': store.hoveredPhaseId === result.phaseId }"
                    :style="{
                      opacity:
                        store.hoveredPhaseId === null || store.hoveredPhaseId === result.phaseId ? 1 : 0.3,
                    }"
                    @mouseenter="store.setHoveredPhase(result.phaseId)"
                    @mouseleave="store.setHoveredPhase(null)"
                  >
                    <td class="text-body-2">{{ result.phaseName }}</td>
                    <td class="text-end text-body-2">
                      {{ result.mAhPerDay.toFixed(3) }}
                    </td>
                    <td class="text-end text-body-2">
                      {{ result.eventsPerDay > 0 ? result.eventsPerDay.toFixed(1) : 'N/A' }}
                    </td>
                    <td class="text-end text-body-2">
                      {{
                        result.activeTimePerDaySeconds > 0
                          ? (result.activeTimePerDaySeconds / 3600).toFixed(2) + ' h'
                          : i18n.t('auto')
                      }}
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-card>

        </div>
      </div>
      <v-alert v-else type="info" variant="tonal" density="compact">
        {{ i18n.t('enterConfigAndCalculate') }}
      </v-alert>
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
  cursor: pointer;
  transition: opacity 0.2s ease, background-color 0.2s ease;
}

.results-table :deep(tbody tr.phase-breakdown-row-highlighted td) {
  background-color: rgba(0, 0, 0, 0.05);
}

/* Responsive: Stack result tiles on small screens */
@media (max-width: 960px) {
  .d-flex.flex-wrap > .result-tile {
    flex-basis: 100% !important;
    min-width: 100% !important;
  }
}
</style>

