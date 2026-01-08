/**
 * Shared color constants and utilities for phase visualization
 */

import * as d3 from 'd3'

export const DEEP_SLEEP_COLOR = '#9e9e9e'
export const SELF_DISCHARGE_COLOR = '#ff9800'
export const UNDEFINED_COLOR = '#000000'

/**
 * Get color for a phase based on its index among non-DeepSleep phases
 * Uses d3.interpolateYlGnBu color scheme for active phases
 * @param index - Index of the phase among non-DeepSleep phases (0-based)
 * @param totalCount - Total number of active phases (for proper color distribution)
 * @returns Color hex string
 */
export function getPhaseColorByIndex(index: number, totalCount: number = 1): string {

  const reservedColorCount = 4;

  const min = 0.3
  const max = 0.9

  if (totalCount === 0) {
    return d3.interpolateYlGnBu(min) // Fallback
  }

  if (totalCount <= reservedColorCount) {
    return d3.interpolateYlGnBu(min + (index / reservedColorCount) * (max - min))
  }

  // Distribute active phases across the color scheme
  // Use 0.1 to 0.9 range to avoid the very light and very dark ends
  const t = totalCount > 1
    ? min + (index / (totalCount - 1)) * (max - min)
    : min

  return d3.interpolateYlGnBu(t)
}

/**
 * Get color for a phase result based on its phaseId
 * @param phaseId - ID of the phase
 * @param nonDeepSleepPhaseIds - Array of non-DeepSleep phase IDs (in order)
 * @param isDeepSleep - Whether this phase is a DeepSleep phase
 * @returns Color hex string
 */
export function getColorForPhaseId(
  phaseId: string,
  nonDeepSleepPhaseIds: string[],
  isDeepSleep: boolean,
): string {
  // Check if this is the self-discharge virtual phase
  if (phaseId === 'self-discharge-virtual') {
    return SELF_DISCHARGE_COLOR
  }

  // Check if this is a DeepSleep phase
  if (isDeepSleep) {
    return DEEP_SLEEP_COLOR
  }

  // For active phases, find the index among non-DeepSleep phases
  const phaseIndex = nonDeepSleepPhaseIds.findIndex((id) => id === phaseId)

  if (phaseIndex === -1 || nonDeepSleepPhaseIds.length === 0) {
    return getPhaseColorByIndex(0, 1) // Fallback
  }

  return getPhaseColorByIndex(phaseIndex, nonDeepSleepPhaseIds.length)
}

