<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'
import { calculate } from '@/lib/calc'
import { exportConfigAsJSON, exportResultsAsCSV } from '@/lib/export'
import PhaseShareDonut from '@/components/Charts/PhaseShareDonut.vue'
import CycleTimeline from '@/components/Charts/CycleTimeline.vue'
import SensitivityBar from '@/components/SensitivityBar.vue'

const store = useCalculatorStore()
const { i18n } = useLocale()
const shouldCalculate = ref(false)

const calculationResult = computed(() => {
  if (!shouldCalculate.value) {
    return null
  }
  return calculate(store.battery, store.phases)
})

function triggerCalculation() {
  shouldCalculate.value = true
}

// Auto-calculate on changes (live update)
const autoCalculation = computed(() => {
  return calculate(store.battery, store.phases)
})

const displayResult = computed(() => {
  return shouldCalculate.value ? calculationResult.value : autoCalculation.value
})
</script>

<template>
  <v-card>
    <v-card-title class="d-flex justify-space-between align-center flex-wrap ga-2">
      <span>{{ i18n.t('results') }}</span>
      <div class="d-flex ga-2">
        <v-btn
          color="primary"
          prepend-icon="mdi-calculator"
          @click="triggerCalculation"
        >
          {{ i18n.t('calculate') }}
        </v-btn>
        <v-menu>
          <template #activator="{ props: menuProps }">
            <v-btn
              color="secondary"
              prepend-icon="mdi-download"
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
    <v-card-text>
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
          <v-card variant="outlined" color="primary">
            <v-card-text>
              <div class="text-h6 mb-1">{{ i18n.t('averageCurrent') }}</div>
              <div class="text-h4">
                {{ displayResult.averageCurrent_mA.toFixed(3) }} mA
              </div>
            </v-card-text>
          </v-card>

          <v-card variant="outlined" color="secondary">
            <v-card-text>
              <div class="text-h6 mb-1">{{ i18n.t('consumptionPerDay') }}</div>
              <div class="text-h4">
                {{ displayResult.totalmAhPerDay.toFixed(2) }} mAh/day
              </div>
            </v-card-text>
          </v-card>

          <v-card variant="outlined" color="success">
            <v-card-text>
              <div class="text-h6 mb-1">{{ i18n.t('estimatedRuntime') }}</div>
              <div class="text-h4">
                {{ displayResult.runtimeDays.toFixed(1) }} {{ i18n.t('days') }}
              </div>
              <div class="text-body-2 mt-1">
                ({{ displayResult.runtimeWeeks.toFixed(1) }} {{ i18n.t('weeks') }},
                {{ displayResult.runtimeMonths.toFixed(1) }} {{ i18n.t('months') }})
              </div>
              <div class="text-caption mt-1 text-medium-emphasis">
                {{ i18n.t('monthNote') }}
              </div>
            </v-card-text>
          </v-card>

          <!-- Phase Breakdown -->
          <v-card variant="outlined">
            <v-card-title class="text-subtitle-1">
              {{ i18n.t('consumptionByPhase') }}
            </v-card-title>
            <v-card-text>
              <v-table density="compact">
                <thead>
                  <tr>
                    <th>{{ i18n.t('phase') }}</th>
                    <th class="text-end">mAh/day</th>
                    <th class="text-end">{{ i18n.t('eventsPerDay') }}</th>
                    <th class="text-end">{{ i18n.t('activeTimePerDay') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="result in displayResult.phaseResults"
                    :key="result.phaseId"
                  >
                    <td>{{ result.phaseName }}</td>
                    <td class="text-end">
                      {{ result.mAhPerDay.toFixed(3) }}
                    </td>
                    <td class="text-end">
                      {{ result.eventsPerDay > 0 ? result.eventsPerDay.toFixed(1) : 'N/A' }}
                    </td>
                    <td class="text-end">
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

          <!-- Visualizations -->
          <div class="d-flex flex-column ga-3 mt-3">
            <PhaseShareDonut :phase-results="displayResult.phaseResults" />
            <CycleTimeline />
            <SensitivityBar />
          </div>
        </div>
      </div>
      <v-alert v-else type="info" variant="tonal">
        {{ i18n.t('enterConfigAndCalculate') }}
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<style scoped></style>

