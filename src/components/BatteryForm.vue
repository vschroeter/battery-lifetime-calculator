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
</script>

<template>
  <v-form>
    <v-text-field
      v-model.number="capacity"
      :label="i18n.t('capacity')"
      suffix="mAh"
      type="number"
      min="0"
      step="1"
      variant="outlined"
      density="comfortable"
    />

    <v-slider
      v-model="usablePercent"
      :label="i18n.t('usableCapacity')"
      min="1"
      max="100"
      step="1"
      thumb-label
      variant="outlined"
      density="comfortable"
      :hint="i18n.t('usableCapacityHint')"
      persistent-hint
    >
      <template #append>
        <v-text-field
          v-model.number="usablePercent"
          type="number"
          style="width: 80px"
          density="compact"
          variant="outlined"
          hide-details
          min="1"
          max="100"
          step="1"
        />
      </template>
    </v-slider>
  </v-form>
</template>

<style scoped></style>

