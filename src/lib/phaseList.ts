const PHASE_NUMBER = /^Phase (\d+)$/
const COPY_NUMBER = /^(.*) Copy (\d+)$/
const COPY_SUFFIX = ' Copy'

export function smallestFreePhaseName(taken: ReadonlySet<string>): string {
  let number = 1
  while (taken.has(`Phase ${number}`)) {
    number += 1
  }
  return `Phase ${number}`
}

export function duplicatePhaseName(sourceName: string, taken: ReadonlySet<string>): string {
  const trimmed = sourceName.trim()
  if (trimmed === '') {
    return smallestFreePhaseName(taken)
  }
  if (PHASE_NUMBER.test(trimmed)) {
    let number = 2
    while (taken.has(`${trimmed} (${number})`)) {
      number += 1
    }
    return `${trimmed} (${number})`
  }

  const numbered = COPY_NUMBER.exec(trimmed)
  const base = numbered
    ? numbered[1]!
    : trimmed.endsWith(COPY_SUFFIX)
      ? trimmed.slice(0, -COPY_SUFFIX.length)
      : trimmed
  if (!taken.has(`${base} Copy`)) {
    return `${base} Copy`
  }
  let number = 2
  while (taken.has(`${base} Copy ${number}`)) {
    number += 1
  }
  return `${base} Copy ${number}`
}

/** Trim a typed name. An empty result becomes the smallest free `Phase N`. */
export function commitPhaseName(current: string, taken: ReadonlySet<string>): string {
  const trimmed = current.trim()
  if (trimmed !== '') {
    return trimmed
  }
  return smallestFreePhaseName(taken)
}

export function placeActivePhase<T extends { id: string; isDeepSleep: boolean }>(
  phases: readonly T[],
  id: string,
  targetIndex: number,
): T[] {
  const activeSlots: number[] = []
  const active: T[] = []
  phases.forEach((phase, index) => {
    if (!phase.isDeepSleep) {
      activeSlots.push(index)
      active.push(phase)
    }
  })
  const from = active.findIndex((phase) => phase.id === id)
  if (from < 0) {
    return phases.slice()
  }
  const clamped = Math.max(0, Math.min(targetIndex, active.length - 1))
  if (clamped === from) {
    return phases.slice()
  }
  const reordered = active.slice()
  const [moved] = reordered.splice(from, 1)
  reordered.splice(clamped, 0, moved!)
  const next = phases.slice()
  activeSlots.forEach((slot, index) => {
    next[slot] = reordered[index]!
  })
  return next
}

export function insertAfterPhase<T extends { id: string }>(
  phases: readonly T[],
  sourceId: string,
  created: T,
): T[] {
  const index = phases.findIndex((phase) => phase.id === sourceId)
  if (index < 0) {
    return phases.slice()
  }
  const next = phases.slice()
  next.splice(index + 1, 0, created)
  return next
}
