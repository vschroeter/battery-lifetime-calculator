<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'
import { usePhaseColors } from '@/composables/usePhaseColors'
import LeakageCurrentsPanel from '@/components/LeakageCurrentsPanel.vue'
import NumericField from '@/components/NumericField.vue'
import { useFieldMessage } from '@/composables/useFieldMessage'
import { phaseFieldKey } from '@/lib/fields'
import type { Phase, CurrentUnit, DurationUnit } from '@/types/calculator'

const store = useCalculatorStore()
const { i18n } = useLocale()
const { message } = useFieldMessage()
const { getPhaseColor } = usePhaseColors()

const editingPhaseId = ref<string | null>(null)

const phases = computed(() => store.phases)

const nonDeepSleepPhases = computed(() =>
  phases.value.filter((p) => !p.isDeepSleep),
)
const deepSleepPhases = computed(() =>
  phases.value.filter((p) => p.isDeepSleep),
)

function addPhase() {
  const nextPhaseNumber = nonDeepSleepPhases.value.length + 1
  store.addPhase({
    name: `Phase ${nextPhaseNumber}`,
    isDeepSleep: false,
    current: 10,
    currentUnit: 'mA',
    duration: 1,
    durationUnit: 's',
    frequency: 1,
    frequencyUnit: 'perHour',
  })
}

function removePhase(id: string) {
  if (phases.value.find((p) => p.id === id)?.isDeepSleep) {
    return // Don't allow removing DeepSleep phase
  }
  store.removePhase(id)
}

function updatePhase(id: string, updates: Partial<Phase>) {
  store.updatePhase(id, updates)
}

function startEditing(id: string) {
  editingPhaseId.value = id
}

function stopEditing() {
  editingPhaseId.value = null
}

function handleNameUpdate(id: string, value: string) {
  updatePhase(id, { name: value })
}

function onPhaseClick(id: string, event: MouseEvent) {
  if (event.detail > 1) {
    return
  }
  store.togglePinnedPhase(id)
}

function isHighlighted(id: string): boolean {
  return store.highlightedPhaseId === id
}
</script>

<template>
  <div>

    <!-- Leakage Currents Panel -->
    <LeakageCurrentsPanel />

    <!-- DeepSleep Phase (special handling) -->
    <div v-if="deepSleepPhases.length > 0" class="mb-3">
      <v-card
        v-for="phase in deepSleepPhases"
        :key="phase.id"
        class="phase-card modern-card"
        :class="{ 'phase-card-highlighted': isHighlighted(phase.id) }"
        elevation="1"
        @mouseenter="store.setHoveredPhase(phase.id)"
        @mouseleave="store.setHoveredPhase(null)"
        @click="onPhaseClick(phase.id, $event)"
      >
        <v-card-title class="d-flex justify-space-between align-center pa-3 pb-2">
          <div class="d-flex align-center ga-2 flex-grow-1">
            <div
              class="phase-color-indicator"
              :style="{ backgroundColor: getPhaseColor(phase) }"
            />
            <div
              v-if="editingPhaseId !== phase.id"
              class="phase-title-editable"
              @dblclick="startEditing(phase.id)"
            >
              {{ phase.name || 'Unnamed Phase' }}
            </div>
            <v-text-field
              v-else
              :model-value="phase.name"
              variant="plain"
              density="compact"
              hide-details
              autofocus
              class="phase-title-input"
              @update:model-value="handleNameUpdate(phase.id, $event)"
              @blur="stopEditing"
              @keydown.enter.prevent="stopEditing"
              @keydown.esc="stopEditing"
            />
          </div>
        </v-card-title>
        <v-card-text class="pa-3 pt-2">
          <div class="d-flex flex-column ga-2">
            <div class="d-flex ga-2 align-center">
              <NumericField
                :model-value="phase.current"
                :label="i18n.t('current')"
                :error-message="message(phaseFieldKey(phase.id, 'current'))"
                class="flex-grow-1"
                @commit="store.commitPhaseField(phase.id, 'current', $event)"
              />
              <v-btn-toggle
                :model-value="phase.currentUnit"
                variant="outlined"
                density="compact"
                mandatory
                divided
                class="unit-toggle"
                @update:model-value="
                  updatePhase(phase.id, { currentUnit: $event as CurrentUnit })
                "
              >
                <v-btn value="µA" size="small">µA</v-btn>
                <v-btn value="mA" size="small">mA</v-btn>
                <v-btn value="A" size="small">A</v-btn>
              </v-btn-toggle>
            </div>
            <p class="deep-sleep-note text-body-2 text-medium-emphasis mb-0">
              {{ i18n.t('deepSleepHint') }}
            </p>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <!-- Active Phases -->
    <div class="d-flex flex-column ga-3">
      <v-card
        v-for="phase in nonDeepSleepPhases"
        :key="phase.id"
        class="phase-card modern-card"
        :class="{ 'phase-card-highlighted': isHighlighted(phase.id) }"
        elevation="1"
        @mouseenter="store.setHoveredPhase(phase.id)"
        @mouseleave="store.setHoveredPhase(null)"
        @click="onPhaseClick(phase.id, $event)"
      >
        <v-card-title class="d-flex justify-space-between align-center pa-3 pb-2">
          <div class="d-flex align-center ga-2 flex-grow-1">
            <div
              class="phase-color-indicator"
              :style="{ backgroundColor: getPhaseColor(phase) }"
            />
            <div
              v-if="editingPhaseId !== phase.id"
              class="phase-title-editable"
              @dblclick="startEditing(phase.id)"
            >
              {{ phase.name || 'Unnamed Phase' }}
            </div>
            <v-text-field
              v-else
              :model-value="phase.name"
              variant="plain"
              density="compact"
              hide-details
              autofocus
              class="phase-title-input"
              @update:model-value="handleNameUpdate(phase.id, $event)"
              @blur="stopEditing"
              @keydown.enter.prevent="stopEditing"
              @keydown.esc="stopEditing"
            />
          </div>
          <v-btn
            icon="mdi-delete"
            variant="text"
            color="error"
            size="small"
            density="compact"
            @click.stop="removePhase(phase.id)"
          />
        </v-card-title>
        <v-card-text class="pa-3 pt-2">
          <div class="d-flex flex-column ga-2">
            <!-- Current + Unit -->
            <div class="d-flex ga-2 flex-wrap align-center">
              <NumericField
                :model-value="phase.current"
                :label="i18n.t('current')"
                :error-message="message(phaseFieldKey(phase.id, 'current'))"
                class="flex-grow-1"
                style="min-width: 150px"
                @commit="store.commitPhaseField(phase.id, 'current', $event)"
              />
              <v-btn-toggle
                :model-value="phase.currentUnit"
                variant="outlined"
                density="compact"
                mandatory
                divided
                class="unit-toggle"
                @update:model-value="
                  updatePhase(phase.id, { currentUnit: $event as CurrentUnit })
                "
              >
                <v-btn value="µA" size="small">µA</v-btn>
                <v-btn value="mA" size="small">mA</v-btn>
                <v-btn value="A" size="small">A</v-btn>
              </v-btn-toggle>
            </div>

            <!-- Duration + Unit -->
            <div class="d-flex ga-2 flex-wrap align-center">
              <NumericField
                :model-value="phase.duration"
                :label="i18n.t('duration')"
                :error-message="message(phaseFieldKey(phase.id, 'duration'))"
                class="flex-grow-1"
                style="min-width: 150px"
                @commit="store.commitPhaseField(phase.id, 'duration', $event)"
              />
              <v-btn-toggle
                :model-value="phase.durationUnit"
                variant="outlined"
                density="compact"
                mandatory
                divided
                class="unit-toggle"
                @update:model-value="
                  updatePhase(phase.id, {
                    durationUnit: $event as DurationUnit,
                  })
                "
              >
                <v-btn value="ms" size="small">ms</v-btn>
                <v-btn value="s" size="small">s</v-btn>
                <v-btn value="min" size="small">min</v-btn>
                <v-btn value="h" size="small">h</v-btn>
              </v-btn-toggle>
            </div>

            <!-- Frequency + Unit -->
            <div class="d-flex ga-2 flex-wrap align-center">
              <NumericField
                :model-value="phase.frequency"
                :label="i18n.t('frequency')"
                :error-message="message(phaseFieldKey(phase.id, 'frequency'))"
                class="flex-grow-1"
                style="min-width: 150px"
                @commit="store.commitPhaseField(phase.id, 'frequency', $event)"
              />
              <v-btn-toggle
                :model-value="phase.frequencyUnit"
                variant="outlined"
                density="compact"
                mandatory
                divided
                class="unit-toggle"
                @update:model-value="
                  updatePhase(phase.id, {
                    frequencyUnit: $event,
                  })
                "
              >
                <v-btn value="perHour" size="small">{{ i18n.t('perHour') }}</v-btn>
                <v-btn value="perDay" size="small">{{ i18n.t('perDay') }}</v-btn>
                <v-btn value="perWeek" size="small">{{ i18n.t('perWeek') }}</v-btn>
              </v-btn-toggle>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <v-alert
        v-if="nonDeepSleepPhases.length === 0"
        type="info"
        variant="tonal"
        density="compact"
      >
        {{ i18n.t('noPhases') }}
      </v-alert>
    </div>

    <!-- Add Phase FAB Button -->
    <div class="d-flex justify-center mt-4">
      <v-tooltip location="top">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            color="primary"
            icon="mdi-plus"
            size="large"
            class="add-phase-fab"
            v-bind="tooltipProps"
            @click="addPhase"
          />
        </template>
        <span>{{ i18n.t('addPhase') }}</span>
      </v-tooltip>
    </div>
  </div>
</template>

<style scoped>
.modern-card {
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.phase-card {
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.phase-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
}

.phase-card-highlighted {
  border-color: rgba(var(--v-theme-primary), 0.5) !important;
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.2) !important;
}

.phase-title-editable {
  cursor: pointer;
  user-select: none;
  flex-grow: 1;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.phase-title-editable:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.phase-title-input {
  flex-grow: 1;
}

.deep-sleep-note {
  line-height: 1.4;
}

.phase-color-indicator {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.add-phase-fab {
  border-radius: 50% !important;
  width: 56px;
  height: 56px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.add-phase-fab:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
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
  .d-flex.flex-wrap > * {
    flex-basis: 100% !important;
    min-width: 100% !important;
  }
}

/* Ensure side-by-side layout on md+ screens */
@media (min-width: 600px) {
  .d-flex.flex-wrap > .flex-grow-1 {
    flex-basis: calc(50% - 8px);
    max-width: calc(50% - 8px);
  }
}
</style>

