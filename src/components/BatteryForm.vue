<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'
import { useFieldMessage } from '@/composables/useFieldMessage'
import { CHEMISTRIES, cellsFor, EFFICIENCY_PRESETS, EFFICIENCY_SLIDER, selfDischargeBand } from '@/lib/batteryPresets'
import { batteryFieldKey } from '@/lib/fields'
import type { ChemistryId } from '@/types/calculator'
import NumericField from '@/components/NumericField.vue'

const store = useCalculatorStore()
const { i18n } = useLocale()
const { message } = useFieldMessage()

const usableFocused = ref(false)
const selfDischargeFocused = ref(false)
const efficiencyFocused = ref(false)

const usableCapacity_mAh = computed(() => {
  return store.battery.capacity_mAh * (store.battery.usablePercent / 100)
})

const usableSlider = computed(() => {
  const resolved = store.resolvedNumber(batteryFieldKey('usablePercent'))
  if (resolved !== null) {
    return resolved
  }
  return Math.min(100, Math.max(1, store.battery.usablePercent))
})

const dischargeBand = computed(() => selfDischargeBand(store.battery.chemistryId))

const selfDischargeSlider = computed(() =>
  clampToBand(store.battery.selfDischargePercentPerMonth, dischargeBand.value),
)

const selfDischargeOutside = computed(() => {
  const value = store.battery.selfDischargePercentPerMonth
  return value < dischargeBand.value.min || value > dischargeBand.value.max
})

const efficiencySlider = computed(() =>
  clampToBand(store.battery.efficiencyPercent, EFFICIENCY_SLIDER),
)

const efficiencyOutside = computed(() => {
  const value = store.battery.efficiencyPercent
  return value < EFFICIENCY_SLIDER.min || value > EFFICIENCY_SLIDER.max
})

const chemistryItems = computed(() => [
  { title: i18n.t('presetCustom'), value: '' },
  ...CHEMISTRIES.map((chemistry) => ({
    title: i18n.t(chemistry.labelKey),
    value: chemistry.id,
  })),
])

const cellItems = computed(() => [
  { title: i18n.t('presetCustom'), value: '' },
  ...cellsFor(store.battery.chemistryId).map((cell) => ({
    title: `${i18n.t(cell.labelKey)} · ${cell.capacity_mAh} mAh`,
    value: cell.id,
  })),
])

function clampToBand(value: number, band: { min: number; max: number }): number {
  if (!Number.isFinite(value)) {
    return band.min
  }
  return Math.min(band.max, Math.max(band.min, value))
}

function onUsableSlider(value: number) {
  if (usableFocused.value) {
    return
  }
  store.commitBatteryField('usablePercent', value)
}

function onSelfDischargeSlider(value: number) {
  if (selfDischargeFocused.value) {
    return
  }
  if (value === store.battery.selfDischargePercentPerMonth) {
    return
  }
  if (value === selfDischargeSlider.value && selfDischargeOutside.value) {
    return
  }
  store.commitBatteryField('selfDischargePercentPerMonth', value)
}

function onEfficiencySlider(value: number) {
  if (efficiencyFocused.value) {
    return
  }
  if (value === store.battery.efficiencyPercent) {
    return
  }
  if (value === efficiencySlider.value && efficiencyOutside.value) {
    return
  }
  store.commitBatteryField('efficiencyPercent', value)
}

function onChemistry(value: unknown) {
  const chemistryId = value === '' || value === null || value === undefined
    ? null
    : (value as ChemistryId)
  store.applyChemistry(chemistryId)
}

function onCell(value: unknown) {
  const cellId = value === '' || value === null || value === undefined ? null : String(value)
  store.applyCell(cellId)
}
</script>

<template>
  <v-form class="battery-form">
    <section>
      <h2 class="text-subtitle-1 font-weight-medium">{{ i18n.t('batteryBasic') }}</h2>
      <p class="text-caption text-medium-emphasis mb-3">{{ i18n.t('batteryBasicHint') }}</p>
      <div class="basic-grid">
        <div class="basic-field">
          <div class="field-label">{{ i18n.t('chemistry') }}</div>
          <v-select
            :model-value="store.battery.chemistryId ?? ''"
            :items="chemistryItems"
            :aria-label="i18n.t('chemistry')"
            variant="outlined"
            density="compact"
            hide-details
            @update:model-value="onChemistry"
          />
        </div>
        <div class="basic-field">
          <div class="field-label">{{ i18n.t('cell') }}</div>
          <v-select
            :model-value="store.battery.cellId ?? ''"
            :items="cellItems"
            :aria-label="i18n.t('cell')"
            variant="outlined"
            density="compact"
            hide-details
            @update:model-value="onCell"
          />
        </div>
        <div class="basic-field">
          <div class="field-label">{{ i18n.t('capacity') }}</div>
          <NumericField
            class="capacity-field"
            :model-value="store.battery.capacity_mAh"
            :aria-label="i18n.t('capacity')"
            :error-message="message(batteryFieldKey('capacity_mAh'))"
            suffix="mAh"
            @commit="store.commitBatteryField('capacity_mAh', $event)"
          />
        </div>
      </div>
    </section>

    <v-divider />

    <section class="d-flex flex-column ga-4">
      <div>
        <h2 class="text-subtitle-1 font-weight-medium">{{ i18n.t('batteryPerformance') }}</h2>
        <p class="text-caption text-medium-emphasis mb-0">{{ i18n.t('batteryPerformanceHint') }}</p>
      </div>

      <div class="setting-row">
        <div>
          <div id="battery-usable-label" class="text-body-2 font-weight-medium">
            {{ i18n.t('usableCapacity') }}
          </div>
          <p class="text-caption text-medium-emphasis mb-0">
            {{ usableCapacity_mAh.toFixed(0) }} mAh. {{ i18n.t('usableCapacityHint') }}
          </p>
        </div>
        <div class="setting-control">
          <v-slider
            :model-value="usableSlider"
            :aria-label="i18n.t('usableCapacity')"
            min="1"
            max="100"
            step="1"
            thumb-label
            density="compact"
            hide-details
            class="setting-slider"
            @update:model-value="onUsableSlider(Number($event))"
          />
          <NumericField
            :model-value="store.battery.usablePercent"
            :error-message="message(batteryFieldKey('usablePercent'))"
            class="setting-number"
            suffix="%"
            @update:focused="usableFocused = $event"
            @commit="store.commitBatteryField('usablePercent', $event)"
          />
        </div>
      </div>

      <div class="setting-row">
        <div>
          <div id="battery-discharge-label" class="text-body-2 font-weight-medium">
            {{ i18n.t('selfDischarge') }}
          </div>
          <p class="text-caption text-medium-emphasis mb-0">
            {{ i18n.t('selfDischargeHint') }}
          </p>
          <p
            v-if="selfDischargeOutside && !message(batteryFieldKey('selfDischargePercentPerMonth'))"
            class="text-caption text-medium-emphasis mb-0"
          >
            {{ i18n.t('selfDischargeOutside') }}
          </p>
        </div>
        <div class="setting-control">
          <v-slider
            :model-value="selfDischargeSlider"
            :aria-label="i18n.t('selfDischarge')"
            :min="dischargeBand.min"
            :max="dischargeBand.max"
            :step="dischargeBand.step"
            thumb-label
            density="compact"
            hide-details
            class="setting-slider"
            @update:model-value="onSelfDischargeSlider(Number($event))"
          />
          <NumericField
            :model-value="store.battery.selfDischargePercentPerMonth"
            :error-message="message(batteryFieldKey('selfDischargePercentPerMonth'))"
            class="setting-number setting-number-month"
            suffix="%/month"
            @update:focused="selfDischargeFocused = $event"
            @commit="store.commitBatteryField('selfDischargePercentPerMonth', $event)"
          />
        </div>
      </div>

      <div class="setting-row">
        <div>
          <div class="text-body-2 font-weight-medium">{{ i18n.t('regulatorType') }}</div>
          <p class="text-caption text-medium-emphasis mb-0">{{ i18n.t('regulatorTypeHint') }}</p>
        </div>
        <div class="d-flex flex-wrap ga-2">
          <v-btn
            v-for="preset in EFFICIENCY_PRESETS"
            :key="preset.id"
            type="button"
            size="small"
            :variant="store.battery.efficiencyPresetId === preset.id ? 'flat' : 'outlined'"
            :color="store.battery.efficiencyPresetId === preset.id ? 'primary' : undefined"
            @click="store.applyEfficiencyPreset(preset.id)"
          >
            {{ i18n.t(preset.labelKey) }}
          </v-btn>
        </div>
      </div>

      <div class="setting-row">
        <div>
          <div id="battery-efficiency-label" class="text-body-2 font-weight-medium">
            {{ i18n.t('efficiency') }}
          </div>
          <p class="text-caption text-medium-emphasis mb-0">{{ i18n.t('efficiencyHint') }}</p>
          <p
            v-if="efficiencyOutside && !message(batteryFieldKey('efficiencyPercent'))"
            class="text-caption text-medium-emphasis mb-0"
          >
            {{ i18n.t('efficiencySliderNote') }}
          </p>
        </div>
        <div class="setting-control">
          <v-slider
            :model-value="efficiencySlider"
            :aria-label="i18n.t('efficiency')"
            :min="EFFICIENCY_SLIDER.min"
            :max="EFFICIENCY_SLIDER.max"
            :step="EFFICIENCY_SLIDER.step"
            thumb-label
            density="compact"
            hide-details
            class="setting-slider"
            @update:model-value="onEfficiencySlider(Number($event))"
          />
          <NumericField
            :model-value="store.battery.efficiencyPercent"
            :error-message="message(batteryFieldKey('efficiencyPercent'))"
            class="setting-number"
            suffix="%"
            @update:focused="efficiencyFocused = $event"
            @commit="store.commitBatteryField('efficiencyPercent', $event)"
          />
        </div>
      </div>
    </section>
  </v-form>
</template>

<style scoped>
.battery-form {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.basic-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.field-label {
  margin-bottom: 4px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-size: 0.75rem;
  line-height: 1.2;
}

.setting-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
}

.setting-control {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.setting-slider {
  flex: 1 1 auto;
  min-width: 0;
}

.setting-number {
  flex: 0 0 auto;
  width: auto;
}

.setting-number :deep(.v-field__input) {
  flex: 0 0 4.5ch;
  width: 4.5ch;
  min-width: 0;
  padding-inline: 8px 4px;
}

.setting-number-month :deep(.v-field__input) {
  flex-basis: 5.5ch;
  width: 5.5ch;
}

.setting-number :deep(.v-text-field__suffix) {
  padding-inline-start: 2px;
  min-width: 0;
}

.setting-number :deep(.v-field__input),
.capacity-field :deep(.v-field__input) {
  text-align: right;
}

@container (min-width: 440px) {
  .basic-grid {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.2fr) minmax(0, 0.95fr);
    align-items: start;
  }
}
</style>
