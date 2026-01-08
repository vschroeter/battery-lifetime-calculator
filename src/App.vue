<script setup lang="ts">
import { ref, provide, computed } from 'vue'
import type { Locale } from '@/i18n/messages'
import BatteryForm from '@/components/BatteryForm.vue'
import PhasesEditor from '@/components/PhasesEditor.vue'
import ResultsPanel from '@/components/ResultsPanel.vue'
import { useI18nLite } from '@/composables/useI18n'
import { useCalculatorStore } from '@/stores/calculator'

const locale = ref<Locale>('de')
const i18n = useI18nLite(locale)
const store = useCalculatorStore()

const hasNonDeepSleepPhases = computed(() =>
  store.phases.some((p) => !p.isDeepSleep),
)

function removeAllPhases() {
  store.removeAllPhases()
}

provide('locale', locale)
provide('i18n', i18n)
</script>

<template>
  <v-app>
      <v-app-bar color="primary" prominent>
      <v-app-bar-title>{{ i18n.t('appTitle') }}</v-app-bar-title>
      <v-spacer />
      <v-btn
        prepend-icon="mdi-translate"
        variant="text"
        @click="locale = locale === 'de' ? 'en' : 'de'"
      >
        {{ locale === 'de' ? 'EN' : 'DE' }}
      </v-btn>
    </v-app-bar>

    <v-main>
      <v-container class="pa-4 pa-md-6">
        <v-row>
          <v-col cols="12" md="6" class="mb-4 mb-md-0">
            <v-card class="modern-card" elevation="1">
              <v-card-title class="text-h6 pa-4 pb-2">
                {{ i18n.t('batteryConfig') }}
              </v-card-title>
              <v-card-text class="pa-4 pt-2">
                <BatteryForm />
              </v-card-text>
            </v-card>

            <v-card class="modern-card mt-4" elevation="1">
              <v-card-title class="d-flex justify-space-between align-center text-h6 pa-4 pb-2">
                <span>{{ i18n.t('loadProfile') }}</span>
                <v-tooltip location="top">
                  <template #activator="{ props: tooltipProps }">
                    <v-btn
                      icon="mdi-delete-sweep"
                      variant="text"
                      color="error"
                      size="small"
                      density="compact"
                      :disabled="!hasNonDeepSleepPhases"
                      v-bind="tooltipProps"
                      @click="removeAllPhases"
                    />
                  </template>
                  <span>{{ i18n.t('removeAllPhases') }}</span>
                </v-tooltip>
              </v-card-title>
              <v-card-text class="pa-4 pt-2">
                <PhasesEditor />
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="6">
            <ResultsPanel />
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
.modern-card {
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}
</style>
