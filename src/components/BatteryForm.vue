<script setup lang="ts">
import { computed } from 'vue'
import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'

const store = useCalculatorStore()
const { i18n } = useLocale()

const capacity = computed({
  get: () => store.battery.capacity_mAh,
  set: (value) => store.updateBattery({ capacity_mAh: value }),
})

const usablePercent = computed({
  get: () => store.battery.usablePercent,
  set: (value) => store.updateBattery({ usablePercent: value }),
})

const usableCapacity_mAh = computed(() => {
  return store.battery.capacity_mAh * (store.battery.usablePercent / 100)
})

const selfDischargePercentPerMonth = computed({
  get: () => store.battery.selfDischargePercentPerMonth,
  set: (value) => store.updateBattery({ selfDischargePercentPerMonth: value }),
})
</script>

<template>
  <v-form class="d-flex flex-column ga-3">
    <v-text-field
      v-model.number="capacity"
      :label="i18n.t('capacity')"
      suffix="mAh"
      type="number"
      min="0"
      step="1"
      variant="outlined"
      density="compact"
      hide-details="auto"
    />

    <div class="d-flex align-center ga-3 flex-wrap">
      <v-slider
        v-model="usablePercent"
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
      />
      <v-text-field
        v-model.number="usablePercent"
        type="number"
        style="width: 90px; flex-shrink: 0"
        density="compact"
        variant="outlined"
        hide-details
        min="1"
        max="100"
        step="1"
        suffix="%"
      />
    </div>
    <div class="text-caption text-medium-emphasis mt-n2">
      {{ i18n.t('usableCapacity') }}: {{ usableCapacity_mAh.toFixed(0) }} mAh
    </div>

    <v-text-field
      v-model.number="selfDischargePercentPerMonth"
      :label="i18n.t('selfDischarge')"
      suffix="%/month"
      type="number"
      min="0"
      max="99.99"
      step="0.1"
      variant="outlined"
      density="compact"
      hide-details="auto"
    />
    <div class="text-caption text-medium-emphasis mt-n2">
      {{ i18n.t('selfDischargeHint') }}
    </div>
  </v-form>
</template>

<style scoped></style>

