<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'
import { calculate } from '@/lib/calc'
import { exportConfigAsJSON, exportResultsAsCSV, type CsvLabels } from '@/lib/export'
import { ConfigImportError, importConfigFromJSON, type ImportNotice, type ImportResult } from '@/lib/import'
import ConfigActionsMenu from '@/components/ConfigActionsMenu.vue'

const store = useCalculatorStore()
const { i18n } = useLocale()
const display = useDisplay()

const fileInput = ref<HTMLInputElement | null>(null)
const importMessage = ref('')
const importStatus = ref<'success' | 'warning' | 'error'>('success')
const isImportAlertVisible = ref(false)
const isReplaceDialogVisible = ref(false)
const pendingImport = ref<ImportResult | null>(null)

const displayResult = computed(() =>
  calculate(store.battery, store.phases, store.leakageCurrents),
)

const canExportResults = computed(() => displayResult.value.errors.length === 0)

function openImportDialog() {
  fileInput.value?.click()
}

function exportConfig() {
  exportConfigAsJSON(store.state)
}

function csvLabels(): CsvLabels {
  return {
    metric: i18n.t('csvMetric'),
    value: i18n.t('csvValue'),
    unit: i18n.t('csvUnit'),
    capacity: i18n.t('capacity'),
    usableCapacity: i18n.t('usableCapacity'),
    selfDischarge: i18n.t('selfDischarge'),
    averageCurrent: i18n.t('averageCurrent'),
    consumptionPerDay: i18n.t('consumptionPerDay'),
    runtime: i18n.t('estimatedRuntime'),
    days: i18n.t('days'),
    weeks: i18n.t('weeks'),
    months: i18n.t('months'),
    years: i18n.t('years'),
    phase: i18n.t('phase'),
    eventsPerDay: i18n.t('eventsPerDay'),
    activeTimePerDay: i18n.t('activeTimePerDay'),
    notAvailable: i18n.t('notAvailable'),
    auto: i18n.t('auto'),
    unitMilliampHours: 'mAh',
    unitPercent: '%',
    unitPercentPerMonth: i18n.t('percentPerMonth'),
  }
}

function exportResults() {
  if (!canExportResults.value) {
    return
  }
  exportResultsAsCSV(displayResult.value, store.battery, csvLabels())
}

function showImportStatus(type: 'success' | 'warning' | 'error', message: string) {
  importStatus.value = type
  importMessage.value = message
  isImportAlertVisible.value = true
}

function translateImportError(error: unknown): string {
  if (!(error instanceof ConfigImportError)) {
    return i18n.t('importError')
  }

  return Object.entries(error.params).reduce(
    (message, [key, value]) => message.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
    i18n.t(error.code),
  )
}

function formatImportNotices(notices: ImportNotice[]): string {
  return notices
    .map((notice) => {
      if (notice.code === 'addedDefaultDeepSleep') {
        return i18n.t('importAddedDeepSleep')
      }

      const key = notice.count === 1 ? 'importDroppedDeepSleepOne' : 'importDroppedDeepSleepMany'
      return i18n.t(key).replace('{count}', String(notice.count))
    })
    .join(' ')
}

async function handleImportChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  try {
    const jsonText = await file.text()
    pendingImport.value = importConfigFromJSON(jsonText)
    isReplaceDialogVisible.value = true
  } catch (error) {
    showImportStatus('error', translateImportError(error))
  } finally {
    input.value = ''
  }
}

function confirmImport() {
  const imported = pendingImport.value
  pendingImport.value = null
  isReplaceDialogVisible.value = false
  if (!imported) {
    return
  }

  store.replaceState(imported.state)
  const notices = formatImportNotices(imported.notices)
  const summary = notices
    ? `${i18n.t('importSuccess')} ${notices}`
    : i18n.t('importSuccess')
  showImportStatus(notices ? 'warning' : 'success', summary)
}

function cancelImport() {
  pendingImport.value = null
  isReplaceDialogVisible.value = false
}
</script>

<template>
  <div class="config-actions-host">
    <input
      ref="fileInput"
      type="file"
      accept=".json,application/json"
      class="d-none"
      @change="handleImportChange"
    >

    <v-menu v-if="display.mdAndDown.value" location="bottom end" offset="26">
      <template #activator="{ props: menuProps }">
        <v-btn
          class="config-overflow"
          icon="mdi-dots-vertical"
          variant="text"
          :aria-label="i18n.t('importExport')"
          v-bind="menuProps"
        />
      </template>
      <ConfigActionsMenu
        compact
        :can-export-results="canExportResults"
        @import="openImportDialog"
        @export-config="exportConfig"
        @export-results="exportResults"
      />
    </v-menu>

    <div v-else class="config-actions" role="group" :aria-label="i18n.t('importExport')">
      <v-btn
        class="config-action"
        variant="text"
        size="small"
        rounded="pill"
        prepend-icon="mdi-import"
        @click="openImportDialog"
      >
        {{ i18n.t('import') }}
      </v-btn>
      <div class="config-actions-divider" aria-hidden="true" />
      <v-menu location="bottom end" offset="26">
        <template #activator="{ props: menuProps }">
          <v-btn
            class="config-action"
            variant="text"
            size="small"
            rounded="pill"
            prepend-icon="mdi-export"
            append-icon="mdi-chevron-down"
            v-bind="menuProps"
          >
            {{ i18n.t('export') }}
          </v-btn>
        </template>
        <ConfigActionsMenu
          :can-export-results="canExportResults"
          @export-config="exportConfig"
          @export-results="exportResults"
        />
      </v-menu>
    </div>

    <v-dialog
      :model-value="isReplaceDialogVisible"
      max-width="440"
      @update:model-value="(open: boolean) => { if (!open) cancelImport() }"
    >
      <v-card>
        <v-card-title class="text-h6 pa-4 pb-2">
          {{ i18n.t('importReplaceTitle') }}
        </v-card-title>
        <v-card-text class="pa-4 pt-2">
          {{ i18n.t('importReplaceBody') }}
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="cancelImport">
            {{ i18n.t('cancel') }}
          </v-btn>
          <v-btn color="primary" variant="flat" @click="confirmImport">
            {{ i18n.t('importReplaceConfirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar
      v-model="isImportAlertVisible"
      :color="importStatus"
      :timeout="importStatus === 'error' ? -1 : 8000"
      location="bottom"
      multi-line
    >
      {{ importMessage }}
      <template #actions>
        <v-btn variant="text" @click="isImportAlertVisible = false">
          {{ i18n.t('close') }}
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<style scoped>
.config-actions-host {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.config-overflow {
  color: #fff;
}

.config-actions {
  display: inline-flex;
  align-items: center;
  margin-inline: 4px 8px;
  padding: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.22);
}

.config-actions-divider {
  width: 1px;
  align-self: stretch;
  margin: 6px 2px;
  background: rgba(255, 255, 255, 0.28);
}

.config-action {
  color: #fff !important;
  font-weight: 500;
  letter-spacing: 0.01em;
  text-transform: none;
}

.config-action:hover {
  background: rgba(255, 255, 255, 0.16);
}

.config-action :deep(.v-btn__append) {
  margin-inline-start: 2px;
}

.config-action :deep(.v-btn__append .v-icon) {
  font-size: 18px;
  opacity: 0.8;
}
</style>
