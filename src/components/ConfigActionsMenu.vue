<script setup lang="ts">
import { useLocale } from '@/composables/useLocale'

defineProps<{
  compact?: boolean
  canExportResults: boolean
}>()

const emit = defineEmits<{
  import: []
  exportConfig: []
  exportResults: []
}>()

const { i18n } = useLocale()
</script>

<template>
  <v-list class="config-actions-menu" density="comfortable" min-width="280" rounded="lg">
    <v-list-subheader>{{ i18n.t('configuration') }}</v-list-subheader>
    <v-list-item
      v-if="compact"
      prepend-icon="mdi-import"
      :title="i18n.t('importConfigJSON')"
      @click="emit('import')"
    />
    <v-list-item
      prepend-icon="mdi-code-json"
      :title="i18n.t('exportConfigJSON')"
      @click="emit('exportConfig')"
    />
    <v-divider class="my-1" />
    <v-list-subheader>{{ i18n.t('results') }}</v-list-subheader>
    <v-list-item
      prepend-icon="mdi-file-delimited-outline"
      :title="i18n.t('exportResultsCSV')"
      :disabled="!canExportResults"
      @click="emit('exportResults')"
    />
  </v-list>
</template>

<style scoped>
.config-actions-menu :deep(.v-list-subheader) {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  min-height: 32px;
}

.config-actions-menu :deep(.v-list-item-title) {
  font-size: 0.875rem;
  white-space: normal;
}
</style>
