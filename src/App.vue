<script setup lang="ts">
import { ref, provide } from 'vue'
import type { Locale } from '@/i18n/messages'
import BatteryForm from '@/components/BatteryForm.vue'
import PhasesEditor from '@/components/PhasesEditor.vue'
import ResultsPanel from '@/components/ResultsPanel.vue'
import { useI18nLite } from '@/composables/useI18n'

const locale = ref<Locale>('de')
const i18n = useI18nLite(locale)

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
      <v-container fluid>
        <v-row>
          <v-col cols="12" md="6">
            <v-card class="mb-4">
              <v-card-title>{{ i18n.t('batteryConfig') }}</v-card-title>
              <v-card-text>
                <BatteryForm />
              </v-card-text>
            </v-card>

            <v-card>
              <v-card-title>{{ i18n.t('loadProfile') }}</v-card-title>
              <v-card-text>
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

<style scoped></style>
