<script setup lang="ts">
import { computed } from 'vue'
import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'
import { LEAKAGE_CURRENT_COLOR } from '@/lib/phaseColors'
import NumericField from '@/components/NumericField.vue'
import { useFieldMessage } from '@/composables/useFieldMessage'
import { leakageFieldKey } from '@/lib/fields'
import { leakageSourceLit, LEAKAGE_PHASE_ID } from '@/lib/leakage'
import type { CurrentUnit } from '@/types/calculator'

const store = useCalculatorStore()
const { i18n } = useLocale()
const { message } = useFieldMessage()

const leakageCurrents = computed(() => store.leakageCurrents)
const hasLeakageCurrents = computed(() => leakageCurrents.value.length > 0)
const isLeakageGroupHighlighted = computed(
  () => store.highlightedPhaseId === LEAKAGE_PHASE_ID,
)

function sourceRowHighlighted(id: string): boolean {
  return store.highlightedPhaseId !== null && leakageSourceLit(store.highlightedPhaseId, id)
}

function onCardEnter(event: MouseEvent) {
  const target = event.target
  if (target instanceof Element && target.closest('.leakage-row')) {
    return
  }
  store.setHoveredPhase(LEAKAGE_PHASE_ID)
}

function onSourceEnter(id: string) {
  store.setHoveredPhase(id)
}

function onSourceLeave(event: MouseEvent) {
  const row = event.currentTarget
  const next = event.relatedTarget
  if (row instanceof Node && next instanceof Node && row.contains(next)) {
    return
  }
  const card = row instanceof Element ? row.closest('.leakage-currents-card') : null
  if (card && next instanceof Node && card.contains(next)) {
    store.setHoveredPhase(LEAKAGE_PHASE_ID)
    return
  }
  store.setHoveredPhase(null)
}

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
      :class="{ 'leakage-card-highlighted': isLeakageGroupHighlighted }"
      elevation="1"
      @mouseenter="onCardEnter"
      @mouseleave="store.setHoveredPhase(null)"
    >
      <v-card-title class="d-flex justify-space-between align-center pa-3 pb-2">
        <div class="d-flex align-center ga-2">
          <v-switch
            :model-value="store.leakageEnabled"
            color="success"
            density="compact"
            hide-details
            inset
            class="phase-enable"
            :aria-label="i18n.t('includeInCalculation')"
            @click.stop
            @update:model-value="store.setLeakageEnabled($event === true)"
          />
          <div class="heading-divider" aria-hidden="true" />
          <div
            class="phase-color-indicator"
            :style="{ backgroundColor: LEAKAGE_CURRENT_COLOR }"
          />
          <span class="panel-title">{{ i18n.t('leakageCurrents') }}</span>
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
                @click.stop="removeAllLeakageCurrents"
              />
            </template>
            <span>{{ i18n.t('removeAllLeakageCurrents') }}</span>
          </v-tooltip>
        </div>
      </v-card-title>
      <v-card-text class="pa-3 pt-2" :class="{ 'phase-body-off': !store.leakageEnabled }">
        <div class="d-flex flex-column ga-1">
          <div
            v-for="leakage in leakageCurrents"
            :key="leakage.id"
            class="leakage-row"
            :class="{ 'leakage-row-highlighted': sourceRowHighlighted(leakage.id) }"
            @mouseenter="onSourceEnter(leakage.id)"
            @mouseleave="onSourceLeave"
          >

            <NumericField
              :model-value="leakage.current"
              :label="i18n.t('current')"
              :error-message="message(leakageFieldKey(leakage.id))"
              class="leakage-current-field"
              @commit="store.commitLeakageCurrent(leakage.id, $event)"
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
              class="leakage-delete"
              @click.stop="removeLeakageCurrent(leakage.id)"
            />
          </div>

          <div class="d-flex justify-center">
            <v-btn
              color="primary"
              prepend-icon="mdi-plus"
              variant="outlined"
              size="small"
              @click.stop="addLeakageCurrent"
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
.panel-title {
  font-size: 1.25rem;
  font-weight: 500;
  letter-spacing: 0.0125em;
  line-height: 1.5rem;
}

.modern-card {
  border-radius: 12px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
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
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.leakage-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.06);
}

.leakage-row-highlighted {
  background-color: rgba(var(--v-theme-primary), 0.08);
}

.leakage-current-field,
.label-field {
  flex: 1 1 9rem;
  min-width: min(100%, 9rem);
  max-width: 100%;
}

.leakage-delete {
  flex: 0 0 auto;
  margin-left: auto;
}

.phase-color-indicator {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  flex-shrink: 0;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
}

.heading-divider {
  width: 1px;
  height: 18px;
  margin: 0 6px 0 2px;
  background: rgba(var(--v-theme-on-surface), 0.16);
  flex: 0 0 auto;
}

.phase-enable {
  flex: 0 0 auto;
  transform: scale(0.8);
  transform-origin: left center;
}

.phase-enable :deep(.v-selection-control) {
  min-height: 22px;
}

.phase-body-off {
  opacity: 0.48;
}

/* Prevent text capitalization in unit toggle buttons */
.unit-toggle :deep(.v-btn) {
  text-transform: none !important;
  letter-spacing: normal !important;
}

/* Stretch button toggle groups to fill available space */
.unit-toggle {
  flex: 1 1 11rem;
  max-width: 100%;
  min-width: min(100%, 11rem);
}

.unit-toggle :deep(.v-btn-toggle__wrapper) {
  width: 100%;
  display: flex;
}

.unit-toggle :deep(.v-btn) {
  flex: 1 1 0;
  min-width: 0;
}

</style>
