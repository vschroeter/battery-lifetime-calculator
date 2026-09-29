<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'
import { calculate } from '@/lib/calc'
import { exportConfigAsJSON, exportResultsAsCSV } from '@/lib/export'
import { importConfigFromJSON, type ImportNotice } from '@/lib/import'
import ConfigActionsMenu from '@/components/ConfigActionsMenu.vue'

const store = useCalculatorStore()
const { i18n } = useLocale()
const display = useDisplay()

const fileInput = ref<HTMLInputElement | null>(null)
const importMessage = ref('')
const importStatus = ref<'success' | 'warning' | 'error'>('success')
const isImportAlertVisible = ref(false)

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

function exportResults() {
  if (!canExportResults.value) {
    return
  }
  exportResultsAsCSV(displayResult.value)
}

function showImportStatus(type: 'success' | 'warning' | 'error', detailKey: string, detail?: string) {
  importStatus.value = type
  importMessage.value = detail ? `${i18n.t(detailKey)} ${detail}` : i18n.t(detailKey)
  isImportAlertVisible.value = true
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
    const imported = importConfigFromJSON(jsonText)
    store.replaceState(imported.state)
    const notices = formatImportNotices(imported.notices)
    showImportStatus(notices ? 'warning' : 'success', 'importSuccess', notices || undefined)
  } catch (error) {
    const message = error instanceof Error ? error.message : i18n.t('importError')
    showImportStatus('error', 'importError', message)
  } finally {
    input.value = ''
  }
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
