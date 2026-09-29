import { describe, expect, it } from 'vitest'
import {
  commitPhaseName,
  duplicatePhaseName,
  insertAfterPhase,
  placeActivePhase,
  smallestFreePhaseName,
} from '@/lib/phaseList'

function taken(...names: string[]): Set<string> {
  return new Set(names)
}

describe('smallestFreePhaseName', () => {
  it('starts at Phase 1 and skips exact matches only', () => {
    expect(smallestFreePhaseName(taken())).toBe('Phase 1')
    expect(smallestFreePhaseName(taken('Phase 1', 'Phase 2 Copy', 'phase 3'))).toBe('Phase 2')
    expect(smallestFreePhaseName(taken('Phase 1', 'Phase 2', 'DeepSleep'))).toBe('Phase 3')
  })
})

describe('duplicatePhaseName', () => {
  it('numbers an exact Phase N name', () => {
    expect(duplicatePhaseName('Phase 2', taken('Phase 2'))).toBe('Phase 2 (2)')
    expect(duplicatePhaseName('Phase 2', taken('Phase 2', 'Phase 2 (2)'))).toBe('Phase 2 (3)')
  })

  it('appends Copy for any other name and then a number', () => {
    expect(duplicatePhaseName('TX', taken('TX'))).toBe('TX Copy')
    expect(duplicatePhaseName('TX', taken('TX', 'TX Copy'))).toBe('TX Copy 2')
    expect(duplicatePhaseName('TX Copy', taken('TX', 'TX Copy'))).toBe('TX Copy 2')
    expect(duplicatePhaseName('TX Copy 5', taken('TX Copy 5'))).toBe('TX Copy')
    expect(duplicatePhaseName('Phase 2 (2)', taken('Phase 2 (2)'))).toBe('Phase 2 (2) Copy')
  })

  it('uses the smallest free Phase N when the source is blank', () => {
    expect(duplicatePhaseName('   ', taken('Phase 1'))).toBe('Phase 2')
  })
})

describe('commitPhaseName', () => {
  it('trims a typed name and fills a blank one', () => {
    expect(commitPhaseName('  TX  ', taken('Phase 1'))).toBe('TX')
    expect(commitPhaseName('   ', taken('Phase 1', 'DeepSleep'))).toBe('Phase 2')
    expect(commitPhaseName('Phase 2 ', taken('Phase 2 '))).toBe('Phase 2')
  })
})

describe('placeActivePhase', () => {
  const phases = [
    { id: 'a', isDeepSleep: false },
    { id: 'sleep', isDeepSleep: true },
    { id: 'b', isDeepSleep: false },
  ]

  it('reorders active phases and leaves DeepSleep in place', () => {
    expect(placeActivePhase(phases, 'b', 0).map((phase) => phase.id)).toEqual(['b', 'sleep', 'a'])
    expect(placeActivePhase(phases, 'a', 0).map((phase) => phase.id)).toEqual(['a', 'sleep', 'b'])
  })
})

describe('insertAfterPhase', () => {
  it('inserts the copy directly after the source', () => {
    const phases = [
      { id: 'a' },
      { id: 'sleep' },
      { id: 'b' },
    ]
    expect(insertAfterPhase(phases, 'a', { id: 'copy' }).map((phase) => phase.id)).toEqual([
      'a',
      'copy',
      'sleep',
      'b',
    ])
  })
})
