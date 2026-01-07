/**
 * Shared color constants and utilities for phase visualization
 */

export const PHASE_COLORS = [
  '#1976d2',
  '#388e3c',
  '#f57c00',
  '#d32f2f',
  '#7b1fa2',
  '#0288d1',
  '#c2185b',
  '#00796b',
]

export const DEEP_SLEEP_COLOR = '#9e9e9e'
export const SELF_DISCHARGE_COLOR = '#ff9800'
export const UNDEFINED_COLOR = '#000000'

/**
 * Get color for a phase based on its index among non-DeepSleep phases
 * @param index - Index of the phase among non-DeepSleep phases (0-based)
 * @returns Color hex string
 */
export function getPhaseColorByIndex(index: number): string {
  return PHASE_COLORS[index % PHASE_COLORS.length] ?? UNDEFINED_COLOR
}

