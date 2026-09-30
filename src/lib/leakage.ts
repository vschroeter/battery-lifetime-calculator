import type { LeakageSourceResult } from '@/types/calculator'

export const LEAKAGE_PHASE_ID = 'leakage-currents-virtual'

export interface LeakageNameLabels {
  /** Localized section title, used for the group and for a single blank source. */
  group: string
  /** Localized "Leakage {n}" fallback for a blank source inside the group. */
  source: string
}

export function leakageSourceName(
  label: string,
  index: number,
  labels: LeakageNameLabels,
): string {
  const trimmed = label.trim()
  if (trimmed) {
    return trimmed
  }
  return labels.source.replace('{n}', String(index))
}

/**
 * One source uses its label. A blank single source uses the section title.
 * Two or more sources use the section title for the parent.
 */
export function leakageAggregateName(
  sources: LeakageSourceResult[],
  labels: LeakageNameLabels,
): string {
  if (sources.length === 1) {
    const trimmed = sources[0]!.label.trim()
    return trimmed || labels.group
  }
  return labels.group
}

export function leakageShareLit(
  highlightedId: string | null,
  sourceIds: readonly string[],
): boolean {
  if (highlightedId === null) {
    return true
  }
  return highlightedId === LEAKAGE_PHASE_ID || sourceIds.includes(highlightedId)
}

/** The total row. A source lights it while the nest is closed or there is only one source. */
export function leakageParentLit(
  highlightedId: string | null,
  sourceIds: readonly string[],
  nestOpen: boolean,
): boolean {
  if (highlightedId === null) {
    return true
  }
  if (highlightedId === LEAKAGE_PHASE_ID) {
    return true
  }
  if (!sourceIds.includes(highlightedId)) {
    return false
  }
  return !nestOpen || sourceIds.length < 2
}

/** A source row lights for itself and for the group. */
export function leakageSourceLit(highlightedId: string | null, sourceId: string): boolean {
  if (highlightedId === null) {
    return true
  }
  return highlightedId === LEAKAGE_PHASE_ID || highlightedId === sourceId
}
