<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'
import { usePhaseColors } from '@/composables/usePhaseColors'
import type { Phase, CurrentUnit, DurationUnit } from '@/types/calculator'

const store = useCalculatorStore()
const { i18n } = useLocale()
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
  store.addPhase({
    name: 'New Phase',
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
</script>

<template>
  <div>
    <div class="d-flex justify-space-between align-center mb-4">
      <v-btn color="primary" prepend-icon="mdi-plus" @click="addPhase">
        {{ i18n.t('addPhase') }}
      </v-btn>
    </div>

    <v-divider class="mb-4" />

    <!-- DeepSleep Phase (special handling) -->
    <div v-if="deepSleepPhases.length > 0" class="mb-4">
      <v-card
        v-for="phase in deepSleepPhases"
        :key="phase.id"
        variant="outlined"
        color="info"
      >
        <v-card-title class="d-flex align-center ga-2">
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
        </v-card-title>
        <v-card-text>
          <div class="d-flex flex-column ga-2">
            <div class="d-flex ga-2">
              <v-text-field
                :model-value="phase.current"
                label="Current"
                type="number"
                variant="outlined"
                density="comfortable"
                @update:model-value="
                  updatePhase(phase.id, { current: Number($event) })
                "
              />
              <v-select
                :model-value="phase.currentUnit"
                :items="[
                  { title: 'µA', value: 'µA' },
                  { title: 'mA', value: 'mA' },
                  { title: 'A', value: 'A' },
                ]"
                label="Unit"
                variant="outlined"
                density="comfortable"
                style="max-width: 120px"
                @update:model-value="
                  updatePhase(phase.id, { currentUnit: $event as CurrentUnit })
                "
              />
            </div>
            <v-alert type="info" variant="tonal" density="compact">
              {{ i18n.t('deepSleepAutoCalculated') }}
            </v-alert>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <!-- Active Phases -->
    <div class="d-flex flex-column ga-4">
      <v-card
        v-for="phase in nonDeepSleepPhases"
        :key="phase.id"
        variant="outlined"
      >
        <v-card-title class="d-flex justify-space-between align-center">
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
            @click="removePhase(phase.id)"
          />
        </v-card-title>
        <v-card-text>
          <div class="d-flex flex-column ga-3">

            <div class="d-flex ga-2">
              <v-text-field
                :model-value="phase.current"
                :label="i18n.t('current')"
                type="number"
                variant="outlined"
                density="comfortable"
                @update:model-value="
                  updatePhase(phase.id, { current: Number($event) })
                "
              />
              <v-select
                :model-value="phase.currentUnit"
                :items="[
                  { title: 'µA', value: 'µA' },
                  { title: 'mA', value: 'mA' },
                  { title: 'A', value: 'A' },
                ]"
                label="Unit"
                variant="outlined"
                density="comfortable"
                style="max-width: 120px"
                @update:model-value="
                  updatePhase(phase.id, { currentUnit: $event as CurrentUnit })
                "
              />
            </div>

            <div class="d-flex ga-2">
              <v-text-field
                :model-value="phase.duration"
                :label="i18n.t('duration')"
                type="number"
                variant="outlined"
                density="comfortable"
                @update:model-value="
                  updatePhase(phase.id, { duration: Number($event) })
                "
              />
              <v-select
                :model-value="phase.durationUnit"
                :items="[
                  { title: 'ms', value: 'ms' },
                  { title: 's', value: 's' },
                  { title: 'min', value: 'min' },
                  { title: 'h', value: 'h' },
                ]"
                label="Unit"
                variant="outlined"
                density="comfortable"
                style="max-width: 120px"
                @update:model-value="
                  updatePhase(phase.id, {
                    durationUnit: $event as DurationUnit,
                  })
                "
              />
            </div>

            <!-- Frequency -->
            <div class="d-flex ga-2">
              <v-text-field
                :model-value="phase.frequency"
                :label="i18n.t('frequency')"
                type="number"
                variant="outlined"
                density="comfortable"
                @update:model-value="
                  updatePhase(phase.id, { frequency: Number($event) })
                "
              />
              <v-select
                :model-value="phase.frequencyUnit"
                :items="[
                  { title: i18n.t('perHour'), value: 'perHour' },
                  { title: i18n.t('perDay'), value: 'perDay' },
                  { title: i18n.t('perWeek'), value: 'perWeek' },
                ]"
                label="Unit"
                variant="outlined"
                density="comfortable"
                style="max-width: 150px"
                @update:model-value="
                  updatePhase(phase.id, {
                    frequencyUnit: $event,
                  })
                "
              />
            </div>
          </div>
        </v-card-text>
      </v-card>

      <v-alert
        v-if="nonDeepSleepPhases.length === 0"
        type="info"
        variant="tonal"
      >
        {{ i18n.t('noPhases') }}
      </v-alert>
    </div>
  </div>
</template>

<style scoped>
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

.phase-color-indicator {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.12);
}
</style>

