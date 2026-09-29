<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'
import { useProfileUrl } from '@/composables/useProfileUrl'
import { exportConfigAsJSON, exportResultsAsCSV, type CsvLabels } from '@/lib/export'
import { ConfigImportError, importConfigFromJSON, type ImportNotice, type ImportResult } from '@/lib/import'
import ConfigActionsMenu from '@/components/ConfigActionsMenu.vue'

const store = useCalculatorStore()
const { i18n } = useLocale()
const display = useDisplay()
const { feedback, hashPresent, copyProfileLink, resetToExample, publishImportedProfile } = useProfileUrl()

const fileInput = ref<HTMLInputElement | null>(null)
const copyField = ref<HTMLInputElement | null>(null)
const importMessage = ref('')
const importStatus = ref<'success' | 'warning' | 'error'>('success')
const isImportAlertVisible = ref(false)
const isReplaceDialogVisible = ref(false)
const isResetDialogVisible = ref(false)
const isCopyDialogVisible = ref(false)
const manualCopyUrl = ref('')
const pendingImport = ref<ImportResult | null>(null)

const displayResult = computed(() => store.presentation.result)

const canExportResults = computed(
  () =>
    store.presentation.issues.length === 0 &&
    displayResult.value !== null &&
    !displayResult.value.dayBudgetExceeded,
)

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
  if (!displayResult.value) {
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
  if (!publishImportedProfile()) {
    return
  }
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

function confirmReset() {
  isResetDialogVisible.value = false
  resetToExample()
}

function cancelReset() {
  isResetDialogVisible.value = false
}

watch(isCopyDialogVisible, async (open) => {
  if (!open) {
    return
  }
  await nextTick()
  copyField.value?.focus()
  copyField.value?.select()
})

watch(
  feedback,
  (notice) => {
    if (!notice) {
      return
    }
    feedback.value = null
    if (notice.kind === 'copied') {
      showImportStatus('success', i18n.t('copyLinkSuccess'))
      return
    }
    if (notice.kind === 'manual-copy') {
      manualCopyUrl.value = notice.url
      isCopyDialogVisible.value = true
      return
    }
    if (notice.kind === 'encode-failed') {
      showImportStatus('error', i18n.t('profileEncodeFailed'))
      return
    }
    if (notice.kind === 'normalized') {
      showImportStatus('warning', i18n.t('profileUrlNormalized'))
      return
    }
    if (notice.kind === 'notices') {
      showImportStatus('warning', formatImportNotices(notice.notices))
      return
    }
    showImportStatus('error', i18n.t('profileUrlInvalid'))
  },
  { immediate: true },
)
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
          :aria-label="i18n.t('configuration')"
          v-bind="menuProps"
        />
      </template>
      <ConfigActionsMenu
        :can-export-results="canExportResults"
        :can-reset="hashPresent"
        @copy-link="copyProfileLink"
        @import="openImportDialog"
        @export-config="exportConfig"
        @export-results="exportResults"
        @reset="isResetDialogVisible = true"
      />
    </v-menu>

    <div v-else class="config-actions" role="group" :aria-label="i18n.t('configuration')">
      <v-menu location="bottom end" offset="26">
        <template #activator="{ props: menuProps }">
          <v-btn
            class="config-action"
            variant="text"
            size="small"
            rounded="pill"
            prepend-icon="mdi-cog-outline"
            append-icon="mdi-chevron-down"
            v-bind="menuProps"
          >
            {{ i18n.t('configuration') }}
          </v-btn>
        </template>
        <ConfigActionsMenu
          :can-export-results="canExportResults"
          :can-reset="hashPresent"
          @copy-link="copyProfileLink"
          @import="openImportDialog"
          @export-config="exportConfig"
          @export-results="exportResults"
          @reset="isResetDialogVisible = true"
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

    <v-dialog
      :model-value="isResetDialogVisible"
      max-width="440"
      @update:model-value="(open: boolean) => { if (!open) cancelReset() }"
    >
      <v-card>
        <v-card-title class="text-h6 pa-4 pb-2">
          {{ i18n.t('resetExampleTitle') }}
        </v-card-title>
        <v-card-text class="pa-4 pt-2">
          {{ i18n.t('resetExampleBody') }}
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="cancelReset">
            {{ i18n.t('cancel') }}
          </v-btn>
          <v-btn color="primary" variant="flat" @click="confirmReset">
            {{ i18n.t('resetExampleConfirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="isCopyDialogVisible"
      max-width="560"
    >
      <v-card>
        <v-card-title class="text-h6 pa-4 pb-2">
          {{ i18n.t('copyLinkManualTitle') }}
        </v-card-title>
        <v-card-text class="pa-4 pt-2">
          <p class="mb-3">{{ i18n.t('copyLinkManualBody') }}</p>
          <input
            ref="copyField"
            class="copy-url-field"
            type="text"
            readonly
            :value="manualCopyUrl"
          >
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn color="primary" variant="flat" @click="isCopyDialogVisible = false">
            {{ i18n.t('close') }}
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

.copy-url-field {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 4px;
  font: inherit;
}
</style>
