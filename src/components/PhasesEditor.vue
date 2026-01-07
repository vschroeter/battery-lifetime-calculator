<script setup lang="ts">
import { computed } from 'vue'
import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'
import type { Phase, PhaseMode, CurrentUnit, DurationUnit } from '@/types/calculator'

const store = useCalculatorStore()
const { i18n } = useLocale()

const phases = computed(() => store.phases)
const defaultMode = computed({
  get: () => store.defaultPhaseMode,
  set: (value) => store.setDefaultPhaseMode(value),
})

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
    mode: defaultMode.value,
    ...(defaultMode.value === 'interval'
      ? { interval: 60, intervalUnit: 's' as const }
      : { frequency: 1, frequencyUnit: 'perHour' as const }),
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
</script>

<template>
  <div>
    <div class="d-flex justify-space-between align-center mb-4">
      <v-select
        v-model="defaultMode"
        :items="[
          { title: i18n.t('modeA'), value: 'interval' },
          { title: i18n.t('modeB'), value: 'frequency' },
        ]"
        :label="i18n.t('defaultInputMode')"
        variant="outlined"
        density="comfortable"
        style="max-width: 300px"
      />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="addPhase">
        {{ i18n.t('addPhase') }}
      </v-btn>
    </div>

    <v-divider class="mb-4" />

    <!-- DeepSleep Phase (special handling) -->
    <div v-if="deepSleepPhases.length > 0" class="mb-4">
      <v-card variant="outlined" color="info">
        <v-card-title class="text-subtitle-1">
          DeepSleep (Auto-calculated rest time)
        </v-card-title>
        <v-card-text>
          <div
            v-for="phase in deepSleepPhases"
            :key="phase.id"
            class="d-flex flex-column ga-2"
          >
            <v-text-field
              :model-value="phase.name"
              label="Name"
              variant="outlined"
              density="comfortable"
              @update:model-value="updatePhase(phase.id, { name: $event })"
            />
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
          <span>{{ phase.name || 'Unnamed Phase' }}</span>
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
            <v-text-field
              :model-value="phase.name"
              :label="i18n.t('phaseName')"
              variant="outlined"
              density="comfortable"
              @update:model-value="updatePhase(phase.id, { name: $event })"
            />

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

            <v-select
              :model-value="phase.mode"
              :items="[
                { title: i18n.t('modeA'), value: 'interval' },
                {
                  title: i18n.t('modeB'),
                  value: 'frequency',
                },
              ]"
              :label="i18n.t('inputMode')"
              variant="outlined"
              density="comfortable"
              @update:model-value="
                updatePhase(phase.id, { mode: $event as PhaseMode })
              "
            />

            <!-- Mode A: Interval -->
            <template v-if="phase.mode === 'interval'">
              <div class="d-flex ga-2">
                <v-text-field
                  :model-value="phase.interval"
                  :label="i18n.t('interval')"
                  type="number"
                  variant="outlined"
                  density="comfortable"
                  @update:model-value="
                    updatePhase(phase.id, { interval: Number($event) })
                  "
                />
                <v-select
                  :model-value="phase.intervalUnit"
                  :items="[
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
                      intervalUnit: $event,
                    })
                  "
                />
              </div>
            </template>

            <!-- Mode B: Frequency -->
            <template v-else>
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
            </template>
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

<style scoped></style>

