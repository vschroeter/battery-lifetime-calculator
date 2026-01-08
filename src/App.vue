<script setup lang="ts">
import { ref, provide, computed } from 'vue'
import { useDisplay } from 'vuetify'
import type { Locale } from '@/i18n/messages'
import BatteryForm from '@/components/BatteryForm.vue'
import PhasesEditor from '@/components/PhasesEditor.vue'
import ResultsPanel from '@/components/ResultsPanel.vue'
import { useI18nLite } from '@/composables/useI18n'
import { useCalculatorStore } from '@/stores/calculator'

const locale = ref<Locale>('en')
const i18n = useI18nLite(locale)
const store = useCalculatorStore()
const display = useDisplay()

const hasNonDeepSleepPhases = computed(() =>
  store.phases.some((p) => !p.isDeepSleep),
)

const activeTab = ref('inputs')

function removeAllPhases() {
  store.removeAllPhases()
}

provide('locale', locale)
provide('i18n', i18n)
</script>

<template>
  <v-app>
      <v-app-bar color="primary" prominent>
      <v-img
        src="/icons/BatteryIcon.svg"
        max-width="40"
        max-height="40"
        class="mr-3"
        alt="Battery Icon"
      />
      <v-spacer />
      <v-app-bar-title class="text-center">{{ i18n.t('appTitle') }}</v-app-bar-title>
      <v-spacer />
      <v-btn
        icon="mdi-github"
        variant="text"
        href="https://github.com/vschroeter/battery-lifetime-calculator"
        target="_blank"
        rel="noopener noreferrer"
      />
      <v-btn
        prepend-icon="mdi-translate"
        variant="text"
        @click="locale = locale === 'de' ? 'en' : 'de'"
      >
        {{ locale === 'de' ? 'EN' : 'DE' }}
      </v-btn>
    </v-app-bar>

    <v-main class="main-content">
      <!-- Small screens: Tabbed layout -->
      <template v-if="display.mdAndDown.value">
        <div class="tabs-container">
          <v-tabs
            v-model="activeTab"
            color="primary"
            class="tabs-header"
            fixed-tabs
          >
            <v-tab value="inputs">{{ i18n.t('inputs') }}</v-tab>
            <v-tab value="results">{{ i18n.t('results') }}</v-tab>
          </v-tabs>

          <div class="tabs-body">
            <template v-if="activeTab === 'inputs'">
              <div class="scroll-pane">
                <div class="tab-pane-content">
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
                </div>
              </div>
            </template>

            <template v-else>
              <div class="scroll-pane">
                <div class="tab-pane-content">
                  <ResultsPanel class="results-panel-no-internal-scroll" />
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>

      <!-- Large screens: Two-column layout with independent scrolling -->
      <template v-else>
        <v-container class="pa-4 pa-md-6 two-column-container">
          <v-row class="two-column-row">
            <v-col cols="12" lg="6" class="left-column">
              <div class="scroll-pane">
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
              </div>
            </v-col>

            <v-col cols="12" lg="6" class="right-column">
              <ResultsPanel />
            </v-col>
          </v-row>
        </v-container>
      </template>
    </v-main>
  </v-app>
</template>

<style scoped>
:deep(.v-app-bar-title) {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.modern-card {
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

/* Main content area - fixed height based on viewport */
.main-content {
  height: calc(100dvh - var(--v-layout-top));
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Tabbed layout for small screens */
.tabs-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tabs-header {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.tabs-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-pane-content {
  padding: 16px;
}

/* On small screens we want the whole Results tab to scroll (no inner scrollbar) */
.results-panel-no-internal-scroll {
  height: auto !important;
  min-height: unset !important;
  display: block !important;
}

.results-panel-no-internal-scroll :deep(.results-card-content) {
  overflow: visible !important;
}

/* Two-column layout for large screens */
.two-column-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.two-column-row {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
}

.left-column {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 6px 0 0;
}

.right-column {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 0 0 6px;
  overflow: hidden;
}

/* Scroll panes - critical for independent scrolling */
.scroll-pane {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  height: 100%;
}
</style>
