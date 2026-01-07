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

    <v-text-field
      v-model.number="usablePercent"
      :label="i18n.t('usableCapacity')"
      suffix="%"
      type="number"
      min="1"
      max="100"
      step="1"
      variant="outlined"
      density="comfortable"
      :hint="i18n.t('usableCapacityHint')"
      persistent-hint
    />
  </v-form>
</template>

<style scoped></style>

