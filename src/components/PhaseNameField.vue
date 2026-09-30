<script setup lang="ts">
import { ref } from 'vue'
import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'
import { commitPhaseName } from '@/lib/phaseList'

const props = defineProps<{
  phaseId: string
  name: string
}>()

const store = useCalculatorStore()
const { i18n } = useLocale()
const field = ref<{ $el?: HTMLElement } | null>(null)
const nameAtFocus = ref(props.name)
const revert = ref(false)

function onFocusIn() {
  const phase = store.phases.find((item) => item.id === props.phaseId)
  nameAtFocus.value = phase?.name ?? props.name
  revert.value = false
}

function onFocusOut() {
  if (revert.value) {
    revert.value = false
    return
  }
  const phase = store.phases.find((item) => item.id === props.phaseId)
  const current = phase?.name ?? ''
  const taken = new Set(store.phases.map((item) => item.name))
  const next = commitPhaseName(current, taken)
  if (next !== current) {
    store.updatePhase(props.phaseId, { name: next })
  }
}

function blurField() {
  field.value?.$el?.querySelector('input')?.blur()
}

function onEnter(event: KeyboardEvent) {
  event.preventDefault()
  blurField()
}

function onEscape(event: KeyboardEvent) {
  event.preventDefault()
  revert.value = true
  store.updatePhase(props.phaseId, { name: nameAtFocus.value })
  blurField()
}
</script>

<template>
  <div class="phase-title-input" @focusin="onFocusIn" @focusout="onFocusOut" @click.stop>
    <v-text-field
      ref="field"
      :model-value="name"
      :label="i18n.t('phaseName')"
      variant="plain"
      density="compact"
      hide-details
      single-line
      @update:model-value="store.updatePhase(phaseId, { name: String($event ?? '') })"
      @keydown.enter="onEnter"
      @keydown.esc="onEscape"
    />
  </div>
</template>

<style scoped>
.phase-title-input {
  flex-grow: 1;
  min-width: 0;
}

.phase-title-input :deep(.v-label) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.phase-title-input :deep(.v-field) {
  align-items: center;
}

.phase-title-input :deep(.v-field__field) {
  align-items: center;
}

.phase-title-input :deep(.v-field__input) {
  padding-top: 0;
  padding-bottom: 0;
  min-height: 0;
}

.phase-title-input :deep(input) {
  font-size: 1.25rem;
  font-weight: 500;
  letter-spacing: 0.0125em;
  line-height: 1.5rem;
  min-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
</style>
