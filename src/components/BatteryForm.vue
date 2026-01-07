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

    <v-row align="center" class="ga-3">
      <v-col cols="12" md class="d-flex align-center">
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
      </v-col>
      <v-col cols="12" md="auto" class="d-flex align-center">
        <v-text-field
          v-model.number="usablePercent"
          type="number"
          class="numeric-input"
          density="compact"
          variant="outlined"
          hide-details
          min="1"
          max="100"
          step="1"
          suffix="%"
        />
      </v-col>
    </v-row>
    <div class="text-caption text-medium-emphasis mt-n2">
      {{ i18n.t('usableCapacity') }}: {{ usableCapacity_mAh.toFixed(0) }} mAh
    </div>

    <v-row align="center" class="ga-3">
      <v-col cols="12" md class="d-flex align-center">
        <v-slider
          v-model="selfDischargePercentPerMonth"
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
        />
      </v-col>
      <v-col cols="12" md="auto" class="d-flex align-center">
        <v-text-field
          v-model.number="selfDischargePercentPerMonth"
          type="number"
          class="numeric-input"
          density="compact"
          variant="outlined"
          hide-details
          min="0"
          max="99.99"
          step="0.1"
          suffix="%/month"
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

