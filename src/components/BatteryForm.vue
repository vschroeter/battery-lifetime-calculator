<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'
import { useFieldMessage } from '@/composables/useFieldMessage'
import { batteryFieldKey } from '@/lib/fields'
import NumericField from '@/components/NumericField.vue'

const store = useCalculatorStore()
const { i18n } = useLocale()
const { message } = useFieldMessage()

const usableFocused = ref(false)
const selfDischargeFocused = ref(false)

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

const selfDischargeSlider = computed(() => {
  const resolved = store.resolvedNumber(batteryFieldKey('selfDischargePercentPerMonth'))
  if (resolved !== null) {
    return resolved
  }
  return Math.min(99.99, Math.max(0, store.battery.selfDischargePercentPerMonth))
})

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
  store.commitBatteryField('selfDischargePercentPerMonth', value)
}
</script>

<template>
  <v-form class="d-flex flex-column ga-3">
    <NumericField
      :model-value="store.battery.capacity_mAh"
      :label="i18n.t('capacity')"
      :error-message="message(batteryFieldKey('capacity_mAh'))"
      suffix="mAh"
      @commit="store.commitBatteryField('capacity_mAh', $event)"
    />

    <v-row align="center" class="ga-3">
      <v-col cols="12" md class="d-flex align-center">
        <v-slider
          :model-value="usableSlider"
          :label="i18n.t('usableCapacity')"
          min="1"
          max="100"
          step="1"
          thumb-label
          variant="outlined"
          density="compact"
          hide-details
          class="flex-grow-1"
          style="min-width: 200px"
          @update:model-value="onUsableSlider(Number($event))"
        />
      </v-col>
      <v-col cols="12" md="auto" class="d-flex align-center">
        <NumericField
          @update:focused="usableFocused = $event"
          :model-value="store.battery.usablePercent"
          :error-message="message(batteryFieldKey('usablePercent'))"
          class="numeric-input"
          suffix="%"
          @commit="store.commitBatteryField('usablePercent', $event)"
        />
      </v-col>
    </v-row>
    <div class="text-caption text-medium-emphasis mt-n2">
      {{ i18n.t('usableCapacity') }}: {{ usableCapacity_mAh.toFixed(0) }} mAh
    </div>

    <v-row align="center" class="ga-3">
      <v-col cols="12" md class="d-flex align-center">
        <v-slider
          :model-value="selfDischargeSlider"
          :label="i18n.t('selfDischarge')"
          min="0"
          max="99.99"
          step="0.1"
          thumb-label
          variant="outlined"
          density="compact"
          hide-details
          class="flex-grow-1"
          style="min-width: 200px"
          @update:model-value="onSelfDischargeSlider(Number($event))"
        />
      </v-col>
      <v-col cols="12" md="auto" class="d-flex align-center">
        <NumericField
          @update:focused="selfDischargeFocused = $event"
          :model-value="store.battery.selfDischargePercentPerMonth"
          :error-message="message(batteryFieldKey('selfDischargePercentPerMonth'))"
          class="numeric-input"
          suffix="%/month"
          @commit="store.commitBatteryField('selfDischargePercentPerMonth', $event)"
        />
      </v-col>
    </v-row>
    <div class="text-caption text-medium-emphasis mt-n2">
      {{ i18n.t('selfDischargeHint') }}
    </div>
  </v-form>
</template>

<style scoped>
.numeric-input {
  width: 180px;
  flex-shrink: 0;
}

.numeric-input :deep(.v-field__input) {
  text-align: right;
}
</style>
