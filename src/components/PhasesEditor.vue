<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref } from 'vue'
import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'
import { usePhaseColors } from '@/composables/usePhaseColors'
import LeakageCurrentsPanel from '@/components/LeakageCurrentsPanel.vue'
import NumericField from '@/components/NumericField.vue'
import PhaseNameField from '@/components/PhaseNameField.vue'
import { useFieldMessage } from '@/composables/useFieldMessage'
import { phaseFieldKey } from '@/lib/fields'
import { smallestFreePhaseName } from '@/lib/phaseList'
import type { Phase, CurrentUnit, DurationUnit } from '@/types/calculator'

const store = useCalculatorStore()
const { i18n } = useLocale()
const { message } = useFieldMessage()
const { getPhaseColor } = usePhaseColors()

const phases = computed(() => store.phases)
const activeList = ref<HTMLElement | null>(null)
const draggingPhaseId = ref<string | null>(null)

const nonDeepSleepPhases = computed(() =>
  phases.value.filter((p) => !p.isDeepSleep),
)
const deepSleepPhases = computed(() =>
  phases.value.filter((p) => p.isDeepSleep),
)

const SORT_MOVE = 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)'

let dragOriginY = 0
let grabOffset = 0
let lastPointerY = 0
let dragMoved = false
let dragFrame = 0
let reorderLock = false
let motionSerial = 0
const motionGeneration = new WeakMap<HTMLElement, number>()

function activeCardElements(): HTMLElement[] {
  const list = activeList.value
  if (!list) {
    return []
  }
  return [...list.querySelectorAll<HTMLElement>('[data-active-phase]')]
}

function translateYOf(element: HTMLElement): number {
  const transform = getComputedStyle(element).transform
  if (!transform || transform === 'none') {
    return 0
  }
  return new DOMMatrixReadOnly(transform).m42
}

function layoutTop(element: HTMLElement): number {
  return element.getBoundingClientRect().top - translateYOf(element)
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function positionDraggedCard(id: string) {
  const card = document.getElementById(`phase-card-${id}`)
  if (!(card instanceof HTMLElement)) {
    return
  }
  const offset = lastPointerY - grabOffset - layoutTop(card)
  card.style.transition = 'none'
  card.style.transform = `translate3d(0, ${Math.round(offset)}px, 0)`
}

function clearMotion(card: HTMLElement) {
  card.style.transition = ''
  card.style.transform = ''
}

async function animateReorder(mutate: () => void) {
  const before = new Map(
    activeCardElements().map((card) => [card.dataset.phaseId ?? '', layoutTop(card)]),
  )
  mutate()
  await nextTick()
  const cards = activeCardElements()
  const shifted: HTMLElement[] = []
  for (const card of cards) {
    const id = card.dataset.phaseId ?? ''
    if (id === draggingPhaseId.value) {
      continue
    }
    const previous = before.get(id)
    if (previous === undefined) {
      continue
    }
    const delta = previous - layoutTop(card)
    if (Math.abs(delta) < 1) {
      continue
    }
    card.style.transition = 'none'
    card.style.transform = `translate3d(0, ${Math.round(delta)}px, 0)`
    shifted.push(card)
  }
  if (draggingPhaseId.value) {
    positionDraggedCard(draggingPhaseId.value)
  }
  if (shifted.length === 0 || prefersReducedMotion()) {
    for (const card of shifted) {
      clearMotion(card)
    }
    return
  }
  const serial = ++motionSerial
  for (const card of shifted) {
    motionGeneration.set(card, serial)
  }
  requestAnimationFrame(() => {
    for (const card of shifted) {
      if (motionGeneration.get(card) !== serial) {
        continue
      }
      card.style.transition = SORT_MOVE
      card.style.transform = ''
    }
    window.setTimeout(() => {
      for (const card of shifted) {
        if (motionGeneration.get(card) !== serial || card.style.transform !== '') {
          continue
        }
        card.style.transition = ''
      }
    }, 220)
  })
}

async function moveActiveBy(id: string, direction: -1 | 1) {
  const index = nonDeepSleepPhases.value.findIndex((phase) => phase.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= nonDeepSleepPhases.value.length) {
    return
  }
  await animateReorder(() => store.moveActivePhase(id, target))
  document.getElementById(`phase-card-${id}`)?.querySelector<HTMLElement>('.phase-grip')?.focus()
}

function addPhase() {
  const id = store.addPhase({
    name: smallestFreePhaseName(new Set(phases.value.map((phase) => phase.name))),
    isDeepSleep: false,
    current: 10,
    currentUnit: 'mA',
    duration: 1,
    durationUnit: 's',
    frequency: 1,
    frequencyUnit: 'perHour',
  })
  void scrollPhaseIntoView(id)
}

function duplicatePhase(id: string, event: MouseEvent) {
  const newId = store.duplicatePhase(id)
  const button = event.currentTarget
  if (button instanceof HTMLElement) {
    button.focus()
  }
  if (newId) {
    void scrollPhaseIntoView(newId)
  }
}

function removePhase(id: string) {
  if (phases.value.find((p) => p.id === id)?.isDeepSleep) {
    return
  }
  store.removePhase(id)
}

function updatePhase(id: string, updates: Partial<Phase>) {
  store.updatePhase(id, updates)
}

async function scrollPhaseIntoView(id: string) {
  await nextTick()
  document.getElementById(`phase-card-${id}`)?.scrollIntoView({ block: 'nearest' })
}

function onPhaseClick(id: string, event: MouseEvent) {
  if (event.detail > 1) {
    return
  }
  store.togglePinnedPhase(id)
}

function desiredActiveIndex(id: string, clientY: number): number | null {
  const list = activeList.value
  if (!list) {
    return null
  }
  const cards = [...list.querySelectorAll<HTMLElement>('[data-active-phase]')]
  let index = 0
  for (const card of cards) {
    if (card.dataset.phaseId === id) {
      continue
    }
    const top = layoutTop(card)
    if (clientY > top + card.getBoundingClientRect().height / 2) {
      index += 1
    }
  }
  return index
}

function scrollWhileDragging(clientY: number) {
  const pane = activeList.value?.closest('.scroll-pane')
  if (!(pane instanceof HTMLElement)) {
    return
  }
  const rect = pane.getBoundingClientRect()
  const edge = 48
  if (clientY < rect.top + edge) {
    pane.scrollTop -= Math.ceil((rect.top + edge - clientY) / 4)
  } else if (clientY > rect.bottom - edge) {
    pane.scrollTop += Math.ceil((clientY - (rect.bottom - edge)) / 4)
  }
}

function dragStep() {
  const id = draggingPhaseId.value
  if (!id) {
    return
  }
  if (!dragMoved) {
    dragFrame = requestAnimationFrame(dragStep)
    return
  }
  scrollWhileDragging(lastPointerY)
  applyDragPosition()
  dragFrame = requestAnimationFrame(dragStep)
}

function stopDragging(event: PointerEvent) {
  const id = draggingPhaseId.value
  const moved = dragMoved
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', stopDragging)
  window.removeEventListener('pointercancel', stopDragging)
  cancelAnimationFrame(dragFrame)
  draggingPhaseId.value = null
  document.body.style.userSelect = ''
  if (id && moved) {
    releaseDraggedCard(id)
    event.preventDefault()
    window.addEventListener(
      'click',
      (clickEvent) => {
        clickEvent.preventDefault()
        clickEvent.stopPropagation()
      },
      { capture: true, once: true },
    )
  }
}

function releaseDraggedCard(id: string) {
  const card = document.getElementById(`phase-card-${id}`)
  if (!(card instanceof HTMLElement)) {
    return
  }
  if (prefersReducedMotion() || translateYOf(card) === 0) {
    clearMotion(card)
    return
  }
  card.style.transition = SORT_MOVE
  card.style.transform = ''
  const clear = () => {
    clearMotion(card)
    card.removeEventListener('transitionend', clear)
  }
  card.addEventListener('transitionend', clear)
  window.setTimeout(clear, 240)
}

async function commitDragOrder(id: string, target: number) {
  if (reorderLock || target === nonDeepSleepPhases.value.findIndex((phase) => phase.id === id)) {
    return
  }
  reorderLock = true
  try {
    await animateReorder(() => store.moveActivePhase(id, target))
  } finally {
    reorderLock = false
  }
  if (draggingPhaseId.value !== id || !dragMoved) {
    return
  }
  const next = desiredActiveIndex(id, lastPointerY)
  if (next !== null && next !== nonDeepSleepPhases.value.findIndex((phase) => phase.id === id)) {
    void commitDragOrder(id, next)
    return
  }
  positionDraggedCard(id)
}

function applyDragPosition() {
  const id = draggingPhaseId.value
  if (!id || !dragMoved) {
    return
  }
  positionDraggedCard(id)
  if (reorderLock) {
    return
  }
  const target = desiredActiveIndex(id, lastPointerY)
  if (target === null) {
    return
  }
  void commitDragOrder(id, target)
}

function onPointerMove(event: PointerEvent) {
  if (Math.abs(event.clientY - dragOriginY) > 3) {
    dragMoved = true
  }
  lastPointerY = event.clientY
  applyDragPosition()
}

function onGripPointerDown(id: string, event: PointerEvent) {
  if (event.button !== 0) {
    return
  }
  event.stopPropagation()
  const card = document.getElementById(`phase-card-${id}`)
  draggingPhaseId.value = id
  dragOriginY = event.clientY
  lastPointerY = event.clientY
  grabOffset = card instanceof HTMLElement ? event.clientY - layoutTop(card) : 0
  dragMoved = false
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', stopDragging)
  window.addEventListener('pointercancel', stopDragging)
  dragFrame = requestAnimationFrame(dragStep)
}

onUnmounted(() => {
  cancelAnimationFrame(dragFrame)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', stopDragging)
  window.removeEventListener('pointercancel', stopDragging)
  document.body.style.userSelect = ''
})

function isHighlighted(id: string): boolean {
  return store.highlightedPhaseId === id
}
</script>

<template>
  <div>

    <!-- Leakage Currents Panel -->
    <LeakageCurrentsPanel />

    <!-- DeepSleep Phase (special handling) -->
    <div v-if="deepSleepPhases.length > 0" class="mb-3">
      <v-card
        v-for="phase in deepSleepPhases"
        :key="phase.id"
        class="phase-card modern-card"
        :class="{ 'phase-card-highlighted': isHighlighted(phase.id) }"
        elevation="1"
        @mouseenter="store.setHoveredPhase(phase.id)"
        @mouseleave="store.setHoveredPhase(null)"
        @click="onPhaseClick(phase.id, $event)"
      >
        <v-card-title class="d-flex align-center pa-3 pb-2 ga-2">
          <div
            class="phase-color-indicator"
            :style="{ backgroundColor: getPhaseColor(phase) }"
          />
          <PhaseNameField :phase-id="phase.id" :name="phase.name" />
        </v-card-title>
        <v-card-text class="pa-3 pt-2">
          <div class="d-flex flex-column ga-2">
            <div class="d-flex ga-2 align-center">
              <NumericField
                :model-value="phase.current"
                :label="i18n.t('current')"
                :error-message="message(phaseFieldKey(phase.id, 'current'))"
                class="flex-grow-1"
                @commit="store.commitPhaseField(phase.id, 'current', $event)"
              />
              <v-btn-toggle
                :model-value="phase.currentUnit"
                variant="outlined"
                density="compact"
                mandatory
                divided
                class="unit-toggle"
                @update:model-value="
                  updatePhase(phase.id, { currentUnit: $event as CurrentUnit })
                "
              >
                <v-btn value="µA" size="small">µA</v-btn>
                <v-btn value="mA" size="small">mA</v-btn>
                <v-btn value="A" size="small">A</v-btn>
              </v-btn-toggle>
            </div>
            <p class="deep-sleep-note text-body-2 text-medium-emphasis mb-0">
              {{ i18n.t('deepSleepHint') }}
            </p>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <!-- Active Phases -->
    <div
      ref="activeList"
      class="d-flex flex-column ga-3"
      :class="{ 'phase-list-sorting': draggingPhaseId !== null }"
    >
      <v-card
        v-for="phase in nonDeepSleepPhases"
        :id="`phase-card-${phase.id}`"
        :key="phase.id"
        :data-phase-id="phase.id"
        data-active-phase
        class="phase-card modern-card"
        :class="{
          'phase-card-highlighted': isHighlighted(phase.id),
          'phase-card-dragging': draggingPhaseId === phase.id,
        }"
        elevation="1"
        @mouseenter="store.setHoveredPhase(phase.id)"
        @mouseleave="store.setHoveredPhase(null)"
        @click="onPhaseClick(phase.id, $event)"
      >
        <v-card-title class="d-flex align-center pa-3 pb-2 ga-1">
          <v-tooltip location="top" :disabled="draggingPhaseId !== null">
            <template #activator="{ props: tooltipProps }">
              <v-btn
                v-bind="tooltipProps"
                icon="mdi-drag-vertical"
                variant="text"
                size="small"
                density="compact"
                class="phase-grip"
                :aria-label="i18n.t('reorderPhase')"
                @pointerdown="onGripPointerDown(phase.id, $event)"
                @keydown.up.prevent="moveActiveBy(phase.id, -1)"
                @keydown.down.prevent="moveActiveBy(phase.id, 1)"
                @click.stop
              />
            </template>
            <span>{{ i18n.t('reorderPhase') }}</span>
          </v-tooltip>
          <div
            class="phase-color-indicator"
            :style="{ backgroundColor: getPhaseColor(phase) }"
          />
          <PhaseNameField :phase-id="phase.id" :name="phase.name" />
          <v-tooltip location="top" :disabled="draggingPhaseId !== null">
            <template #activator="{ props: tooltipProps }">
              <v-btn
                v-bind="tooltipProps"
                icon="mdi-content-copy"
                variant="text"
                size="small"
                density="compact"
                :aria-label="i18n.t('duplicatePhase')"
                @mousedown.prevent.stop
                @click.stop="duplicatePhase(phase.id, $event)"
              />
            </template>
            <span>{{ i18n.t('duplicatePhase') }}</span>
          </v-tooltip>
          <v-btn
            icon="mdi-delete"
            variant="text"
            color="error"
            size="small"
            density="compact"
            :aria-label="i18n.t('removePhase')"
            @click.stop="removePhase(phase.id)"
          />
        </v-card-title>
        <v-card-text class="pa-3 pt-2">
          <div class="d-flex flex-column ga-2">
            <!-- Current + Unit -->
            <div class="d-flex ga-2 flex-wrap align-center">
              <NumericField
                :model-value="phase.current"
                :label="i18n.t('current')"
                :error-message="message(phaseFieldKey(phase.id, 'current'))"
                class="flex-grow-1"
                style="min-width: 150px"
                @commit="store.commitPhaseField(phase.id, 'current', $event)"
              />
              <v-btn-toggle
                :model-value="phase.currentUnit"
                variant="outlined"
                density="compact"
                mandatory
                divided
                class="unit-toggle"
                @update:model-value="
                  updatePhase(phase.id, { currentUnit: $event as CurrentUnit })
                "
              >
                <v-btn value="µA" size="small">µA</v-btn>
                <v-btn value="mA" size="small">mA</v-btn>
                <v-btn value="A" size="small">A</v-btn>
              </v-btn-toggle>
            </div>

            <!-- Duration + Unit -->
            <div class="d-flex ga-2 flex-wrap align-center">
              <NumericField
                :model-value="phase.duration"
                :label="i18n.t('duration')"
                :error-message="message(phaseFieldKey(phase.id, 'duration'))"
                class="flex-grow-1"
                style="min-width: 150px"
                @commit="store.commitPhaseField(phase.id, 'duration', $event)"
              />
              <v-btn-toggle
                :model-value="phase.durationUnit"
                variant="outlined"
                density="compact"
                mandatory
                divided
                class="unit-toggle"
                @update:model-value="
                  updatePhase(phase.id, {
                    durationUnit: $event as DurationUnit,
                  })
                "
              >
                <v-btn value="ms" size="small">ms</v-btn>
                <v-btn value="s" size="small">s</v-btn>
                <v-btn value="min" size="small">min</v-btn>
                <v-btn value="h" size="small">h</v-btn>
              </v-btn-toggle>
            </div>

            <!-- Frequency + Unit -->
            <div class="d-flex ga-2 flex-wrap align-center">
              <NumericField
                :model-value="phase.frequency"
                :label="i18n.t('frequency')"
                :error-message="message(phaseFieldKey(phase.id, 'frequency'))"
                class="flex-grow-1"
                style="min-width: 150px"
                @commit="store.commitPhaseField(phase.id, 'frequency', $event)"
              />
              <v-btn-toggle
                :model-value="phase.frequencyUnit"
                variant="outlined"
                density="compact"
                mandatory
                divided
                class="unit-toggle"
                @update:model-value="
                  updatePhase(phase.id, {
                    frequencyUnit: $event,
                  })
                "
              >
                <v-btn value="perHour" size="small">{{ i18n.t('perHour') }}</v-btn>
                <v-btn value="perDay" size="small">{{ i18n.t('perDay') }}</v-btn>
                <v-btn value="perWeek" size="small">{{ i18n.t('perWeek') }}</v-btn>
              </v-btn-toggle>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <v-alert
        v-if="nonDeepSleepPhases.length === 0"
        type="info"
        variant="tonal"
        density="compact"
      >
        {{ i18n.t('noPhases') }}
      </v-alert>
    </div>

    <!-- Add Phase FAB Button -->
    <div class="d-flex justify-center mt-4">
      <v-tooltip location="top">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            color="primary"
            icon="mdi-plus"
            size="large"
            class="add-phase-fab"
            v-bind="tooltipProps"
            @click="addPhase"
          />
        </template>
        <span>{{ i18n.t('addPhase') }}</span>
      </v-tooltip>
    </div>
  </div>
</template>

<style scoped>
.modern-card {
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.phase-card {
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.phase-list-sorting .phase-card {
  transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s ease, border-color 0.2s ease;
}

.phase-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
}

.phase-card-highlighted {
  border-color: rgba(var(--v-theme-primary), 0.5) !important;
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.2) !important;
}

.phase-grip {
  cursor: grab;
  touch-action: none;
  flex-shrink: 0;
}

.phase-grip:active {
  cursor: grabbing;
}

.phase-card-dragging {
  position: relative;
  z-index: 5;
  pointer-events: none;
  cursor: grabbing;
  border-color: rgba(var(--v-theme-primary), 0.55) !important;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.28) !important;
}

@media (prefers-reduced-motion: reduce) {
  .phase-list-sorting .phase-card {
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
  }
}

.deep-sleep-note {
  line-height: 1.4;
}

.phase-color-indicator {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.add-phase-fab {
  border-radius: 50% !important;
  width: 56px;
  height: 56px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.add-phase-fab:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

/* Prevent text capitalization in unit toggle buttons */
.unit-toggle :deep(.v-btn) {
  text-transform: none !important;
  letter-spacing: normal !important;
}

/* Stretch button toggle groups to fill available space */
.unit-toggle {
  flex: 1 1 auto;
  min-width: 0;
}

.unit-toggle :deep(.v-btn-toggle__wrapper) {
  width: 100%;
  display: flex;
}

.unit-toggle :deep(.v-btn) {
  flex: 1 1 0;
  min-width: 0;
}

/* Responsive: Stack inputs on small screens */
@media (max-width: 600px) {
  .d-flex.flex-wrap > * {
    flex-basis: 100% !important;
    min-width: 100% !important;
  }
}

/* Ensure side-by-side layout on md+ screens */
@media (min-width: 600px) {
  .d-flex.flex-wrap > .flex-grow-1 {
    flex-basis: calc(50% - 8px);
    max-width: calc(50% - 8px);
  }
}
</style>

