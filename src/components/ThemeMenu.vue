<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLocale } from '@/composables/useLocale'
import { useThemePreference } from '@/composables/useThemePreference'
import type { ThemePreference } from '@/lib/themePreference'

const { i18n } = useLocale()
const { preference, resolved, setPreference } = useThemePreference()
const menuOpen = ref(false)

const options: { value: ThemePreference; labelKey: string }[] = [
  { value: 'system', labelKey: 'themeSystem' },
  { value: 'light', labelKey: 'themeLight' },
  { value: 'dark', labelKey: 'themeDark' },
]

const icon = computed(() => (resolved.value === 'dark' ? 'mdi-weather-night' : 'mdi-weather-sunny'))
</script>

<template>
  <v-menu v-model="menuOpen" location="bottom end">
    <template #activator="{ props: menuProps }">
      <v-tooltip location="bottom" :disabled="menuOpen">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="{ ...menuProps, ...tooltipProps }"
            class="flex-shrink-0"
            :icon="icon"
            variant="text"
            :aria-label="i18n.t('theme')"
          />
        </template>
        <span>{{ i18n.t('theme') }}</span>
      </v-tooltip>
    </template>
    <v-list density="compact" :aria-label="i18n.t('theme')">
      <v-list-item
        v-for="option in options"
        :key="option.value"
        :title="i18n.t(option.labelKey)"
        :active="preference === option.value"
        @click="setPreference(option.value)"
      >
        <template #prepend>
          <v-icon
            icon="mdi-check"
            :style="{ visibility: preference === option.value ? 'visible' : 'hidden' }"
          />
        </template>
      </v-list-item>
    </v-list>
  </v-menu>
</template>
