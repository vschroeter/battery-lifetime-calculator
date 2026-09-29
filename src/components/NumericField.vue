<script setup lang="ts">
import { ref } from 'vue'
import { useLocale } from '@/composables/useLocale'
import { formatCanonical, parseDraft } from '@/lib/numericInput'

defineProps<{
  modelValue: number
  label?: string
  suffix?: string
  errorMessage?: string
}>()

const emit = defineEmits<{
  commit: [value: number]
  'update:focused': [value: boolean]
}>()

const { locale } = useLocale()
const draft = ref('')
const focused = ref(false)

function shownValue(modelValue: number): string {
  if (focused.value) {
    return draft.value
  }
  return formatCanonical(modelValue, locale.value)
}

function onFocused(isNowFocused: boolean, modelValue: number) {
  if (isNowFocused) {
    if (!focused.value) {
      draft.value = formatCanonical(modelValue, locale.value)
      focused.value = true
      emit('update:focused', true)
    }
    return
  }
  if (!focused.value) {
    return
  }
  const parsed = parseDraft(draft.value)
  emit('commit', parsed.status === 'number' ? parsed.value : 0)
  focused.value = false
  emit('update:focused', false)
}

function onInput(value: string) {
  draft.value = value
  const parsed = parseDraft(value)
  if (parsed.status === 'number') {
    emit('commit', parsed.value)
  }
}
</script>

<template>
  <v-text-field
    :model-value="shownValue(modelValue)"
    :label="label"
    :suffix="suffix"
    :error-messages="errorMessage ? [errorMessage] : undefined"
    type="text"
    inputmode="decimal"
    autocomplete="off"
    spellcheck="false"
    variant="outlined"
    density="compact"
    hide-details="auto"
    @update:focused="onFocused(Boolean($event), modelValue)"
    @update:model-value="onInput(String($event ?? ''))"
  />
</template>
