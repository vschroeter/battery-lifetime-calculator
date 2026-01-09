<script setup lang="ts">
import { computed } from 'vue'
import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'
import { LEAKAGE_CURRENT_COLOR } from '@/lib/phaseColors'
import type { CurrentUnit } from '@/types/calculator'

const store = useCalculatorStore()
const { i18n } = useLocale()

const leakageCurrents = computed(() => store.leakageCurrents)
const hasLeakageCurrents = computed(() => leakageCurrents.value.length > 0)
const LEAKAGE_CURRENT_PHASE_ID = 'leakage-currents-virtual'
const isLeakageCurrentHovered = computed(() => store.hoveredPhaseId === LEAKAGE_CURRENT_PHASE_ID)

function addLeakageCurrent() {
  store.addLeakageCurrent({
    label: '',
    current: 0,
    currentUnit: 'µA',
  })
}

function removeLeakageCurrent(id: string) {
  store.removeLeakageCurrent(id)
}

function removeAllLeakageCurrents() {
  store.removeAllLeakageCurrents()
}

function updateLeakageCurrent(id: string, updates: Partial<{ label: string; current: number; currentUnit: CurrentUnit }>) {
  store.updateLeakageCurrent(id, updates)
}
</script>

<template>
  <div class="mb-3">
    <v-card
      class="leakage-currents-card modern-card"
      :class="{ 'leakage-card-highlighted': isLeakageCurrentHovered }"
      elevation="1"
      @mouseenter="store.setHoveredPhase(LEAKAGE_CURRENT_PHASE_ID)"
      @mouseleave="store.setHoveredPhase(null)"
    >
      <v-card-title class="d-flex justify-space-between align-center pa-3 pb-2">
        <div class="d-flex align-center ga-2">
          <div
            class="phase-color-indicator"
            :style="{ backgroundColor: LEAKAGE_CURRENT_COLOR }"
          />
          <span>{{ i18n.t('leakageCurrents') }}</span>
        </div>
        <div class="d-flex align-center ga-1">
          <v-tooltip location="top">
            <template #activator="{ props: tooltipProps }">
              <v-icon
                icon="mdi-information-outline"
                size="small"
                color="info"
                v-bind="tooltipProps"
              />
            </template>
            <span>{{ i18n.t('leakageCurrentsHint') }}</span>
          </v-tooltip>
          <v-tooltip location="top">
            <template #activator="{ props: tooltipProps }">
              <v-btn
                icon="mdi-delete-sweep"
                variant="text"
                color="error"
                size="small"
                density="compact"
                :disabled="!hasLeakageCurrents"
                v-bind="tooltipProps"
                @click="removeAllLeakageCurrents"
              />
            </template>
            <span>{{ i18n.t('removeAllLeakageCurrents') }}</span>
          </v-tooltip>
        </div>
      </v-card-title>
      <v-card-text class="pa-3 pt-2">
        <div class="d-flex flex-column ga-1">
          <div
            v-for="leakage in leakageCurrents"
            :key="leakage.id"
            class="leakage-row d-flex ga-2 align-center"
            @mouseenter="store.setHoveredPhase(LEAKAGE_CURRENT_PHASE_ID)"
            @mouseleave="store.setHoveredPhase(null)"
          >

            <v-text-field
              :model-value="leakage.current"
              :label="i18n.t('current')"
              type="number"
              variant="outlined"
              density="compact"
              hide-details="auto"
              class="flex-grow-1"
              style="min-width: 150px"
              @update:model-value="
                updateLeakageCurrent(leakage.id, { current: Number($event) })
              "
            />
            <v-btn-toggle
              :model-value="leakage.currentUnit"
              variant="outlined"
              density="compact"
              mandatory
              divided
              class="unit-toggle"
              @update:model-value="
                updateLeakageCurrent(leakage.id, { currentUnit: $event as CurrentUnit })
              "
            >
              <v-btn value="nA" size="small">nA</v-btn>
              <v-btn value="µA" size="small">µA</v-btn>
              <v-btn value="mA" size="small">mA</v-btn>
              <v-btn value="A" size="small">A</v-btn>
            </v-btn-toggle>
            <v-text-field
              :model-value="leakage.label"
              :label="i18n.t('label')"
              variant="outlined"
              density="compact"
              hide-details="auto"
              class="label-field"
              style="min-width: 120px"
              @update:model-value="
                updateLeakageCurrent(leakage.id, { label: $event })
              "
            />
            <v-btn
              icon="mdi-delete"
              variant="text"
              color="error"
              size="small"
              density="compact"
              @click="removeLeakageCurrent(leakage.id)"
            />
          </div>

          <div class="d-flex justify-center">
            <v-btn
              color="primary"
              prepend-icon="mdi-plus"
              variant="outlined"
              size="small"
              @click="addLeakageCurrent"
            >
              {{ i18n.t('addLeakageCurrent') }}
            </v-btn>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.modern-card {
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.leakage-currents-card {
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.leakage-currents-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
}

.leakage-card-highlighted {
  border-color: rgba(var(--v-theme-primary), 0.5) !important;
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.2) !important;
}

.leakage-row {
  padding: 8px;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.leakage-row:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.label-field {
  flex: 0 0 auto;
}

.phase-color-indicator {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

/* Prevent text capitalization in unit toggle buttons */
.unit-toggle :deep(.v-btn) {
  text-transform: none !important;
  letter-spacing: normal !important;
}

/* Stretch button toggle groups to fill available space */
.unit-toggle {
  flex: 1 1 auto;
  min-width: 0;
}

.unit-toggle :deep(.v-btn-toggle__wrapper) {
  width: 100%;
  display: flex;
}

.unit-toggle :deep(.v-btn) {
  flex: 1 1 0;
  min-width: 0;
}

/* Responsive: Stack inputs on small screens */
@media (max-width: 600px) {
  .leakage-row {
    flex-wrap: wrap;
  }
  .leakage-row > * {
    flex-basis: 100% !important;
    min-width: 100% !important;
  }
}

/* Ensure side-by-side layout on md+ screens */
@media (min-width: 600px) {
  .label-field {
    flex: 0 0 150px;
    max-width: 150px;
  }
  .leakage-row > .flex-grow-1 {
    flex-basis: calc(50% - 8px);
    max-width: calc(50% - 8px);
  }
}
</style>
