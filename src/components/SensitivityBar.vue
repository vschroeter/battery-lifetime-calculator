<script setup lang="ts">
import { computed } from 'vue'
import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'
import { calculate } from '@/lib/calc'

const store = useCalculatorStore()
const { i18n } = useLocale()

// Find the first Active phase for sensitivity analysis
const activePhase = computed(() => {
  return store.phases.find((p) => !p.isDeepSleep && p.name.toLowerCase().includes('active'))
})

const baseResult = computed(() => {
  if (!activePhase.value) return null
  return calculate(store.battery, store.phases)
})

const sensitivityResults = computed(() => {
  if (!activePhase.value || !baseResult.value || baseResult.value.errors.length > 0) {
    return null
  }

  const baseRuntime = baseResult.value.runtimeDays
  const results = []

  // Test -10% and +10% changes
  for (const change of [-10, -5, 5, 10]) {
    const modifiedPhases = store.phases.map((p) => {
      if (p.id === activePhase.value!.id) {
        return {
          ...p,
          current: p.current * (1 + change / 100),
        }
      }
      return p
    })

    const result = calculate(store.battery, modifiedPhases)
    if (result.errors.length === 0) {
      const runtimeChange = ((result.runtimeDays - baseRuntime) / baseRuntime) * 100
      results.push({
        change,
        runtimeDays: result.runtimeDays,
        runtimeChange,
        averageCurrent_mA: result.averageCurrent_mA,
      })
    }
  }

  return {
    baseRuntime,
    results,
  }
})

function getBarColor(change: number): string {
  if (change < 0) return '#d32f2f' // Red for negative
  if (change > 0) return '#388e3c' // Green for positive
  return '#1976d2' // Blue for neutral
}
</script>

<template>
  <v-card variant="outlined">
    <v-card-title class="text-subtitle-1">
      {{ i18n.t('sensitivityAnalysis') }}
    </v-card-title>
    <v-card-text>
      <div v-if="sensitivityResults && activePhase">
        <div class="text-body-2 mb-3">
          {{ i18n.t('whatIf') }}: {{ activePhase.name }} current ±10%
        </div>
        <div class="d-flex flex-column ga-2">
          <div
            v-for="item in sensitivityResults.results"
            :key="item.change"
            class="sensitivity-item"
          >
            <div class="d-flex justify-space-between align-center mb-1">
              <span class="text-body-2">
                {{ item.change > 0 ? '+' : '' }}{{ item.change }}% current
              </span>
              <span class="text-body-2 font-weight-medium">
                {{ item.runtimeDays.toFixed(1) }} days
                <span
                  :style="{
                    color: getBarColor(item.runtimeChange),
                  }"
                >
                  ({{ item.runtimeChange > 0 ? '+' : '' }}{{ item.runtimeChange.toFixed(1) }}%)
                </span>
              </span>
            </div>
            <div class="sensitivity-bar-container">
              <div
                class="sensitivity-bar"
                :style="{
                  width: `${Math.abs(item.runtimeChange) * 2}%`,
                  backgroundColor: getBarColor(item.runtimeChange),
                  marginLeft: item.runtimeChange < 0 ? 'auto' : '0',
                }"
              />
            </div>
          </div>
          <v-divider class="my-2" />
          <div class="text-body-2 text-medium-emphasis">
            {{ i18n.t('base') }}: {{ sensitivityResults.baseRuntime.toFixed(1) }} {{ i18n.t('days') }}
          </div>
        </div>
      </div>
      <v-alert v-else type="info" variant="tonal" density="compact">
        {{ i18n.t('noActivePhaseFound') }}
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.sensitivity-item {
  padding: 8px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.sensitivity-bar-container {
  width: 100%;
  height: 8px;
  background-color: #e0e0e0;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.sensitivity-bar {
  height: 100%;
  border-radius: 4px;
  transition: all 0.3s ease;
  max-width: 100%;
}
</style>

