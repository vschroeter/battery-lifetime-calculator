import { describe, expect, it } from 'vitest'
import { serializeConfig } from '@/lib/export'
import { createExampleProfile } from '@/lib/exampleProfile'
import { ConfigImportError } from '@/lib/import'
import {
  decodeProfileToken,
  encodeProfileHash,
  encodeProfileValue,
  profileTokenFromHash,
} from '@/lib/profileUrl'
import type { Phase } from '@/types/calculator'

describe('profile URL', () => {
  it('round-trips a profile with row ids and without parser changes', () => {
    const state = createExampleProfile()
    state.phases[0] = { ...state.phases[0]!, name: 'Temperatur °C', currentUnit: 'µA' }
    state.leakageCurrents = [{ id: 'leakage-custom', label: 'LDO', current: 2, currentUnit: 'nA' }]
    const hash = encodeProfileHash(state)
    const token = profileTokenFromHash(hash)

    expect(hash.startsWith('#cfg=')).toBe(true)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)

    const decoded = decodeProfileToken(token!)
    expect(decoded.changedByParser).toBe(false)
    expect(decoded.notices).toEqual([])
    expect(decoded.state.phases.map((phase) => phase.id)).toEqual(['phase-0', 'phase-1'])
    expect(decoded.state.phases[0]).toMatchObject({
      name: 'Temperatur °C',
      currentUnit: 'µA',
      isDeepSleep: false,
    })
    expect(decoded.state.leakageCurrents).toEqual([
      { id: 'leak-0', label: 'LDO', current: 2, currentUnit: 'nA' },
    ])
    expect(encodeProfileHash(decoded.state)).toBe(hash)
  })

  it('drops deep-sleep schedule fields and restores the unused defaults', () => {
    const state = createExampleProfile()
    state.phases[1] = {
      ...state.phases[1]!,
      duration: 5,
      durationUnit: 'min',
      frequency: 3,
      frequencyUnit: 'perDay',
    }

    const hash = encodeProfileHash(state)
    const decoded = decodeProfileToken(profileTokenFromHash(hash)!)

    expect(decoded.changedByParser).toBe(false)
    expect(decoded.state.phases[1]).toMatchObject({
      isDeepSleep: true,
      duration: 0,
      durationUnit: 's',
      frequency: 0,
      frequencyUnit: 'perHour',
    })
    expect(encodeProfileHash(decoded.state)).toBe(hash)
  })

  it('round-trips a month rate and a minute interval', () => {
    const state = createExampleProfile()
    state.phases[0] = { ...state.phases[0]!, frequency: 2, frequencyUnit: 'perMonth' }
    const decoded = decodeProfileToken(profileTokenFromHash(encodeProfileHash(state))!)
    expect(decoded.state.phases[0]).toMatchObject({ frequency: 2, frequencyUnit: 'perMonth' })

    state.phases[0] = { ...state.phases[0]!, frequency: 10, frequencyUnit: 'everyMinute' }
    const again = decodeProfileToken(profileTokenFromHash(encodeProfileHash(state))!)
    expect(again.state.phases[0]).toMatchObject({ frequency: 10, frequencyUnit: 'everyMinute' })
  })

  it('encodes the example profile far below the compact JSON token', () => {
    const state = createExampleProfile()
    const json = JSON.stringify(JSON.parse(serializeConfig(state)))
    const jsonToken = btoa(json).replace(/=+$/u, '')
    const packed = profileTokenFromHash(encodeProfileHash(state))

    expect(packed!.length).toBeLessThan(100)
    expect(packed!.length).toBeLessThan(jsonToken.length / 2)
  })

  it('marks a missing deep-sleep phase as changed by the parser', () => {
    const state = createExampleProfile()
    state.phases = state.phases.filter((phase) => !phase.isDeepSleep)

    const decoded = decodeProfileToken(profileTokenFromHash(encodeProfileHash(state))!)
    expect(decoded.changedByParser).toBe(true)
    expect(decoded.notices).toEqual([{ code: 'addedDefaultDeepSleep' }])
    expect(decoded.state.phases.some((phase) => phase.isDeepSleep)).toBe(true)
  })

  it('marks an extra deep-sleep phase as changed by the parser', () => {
    const state = createExampleProfile()
    const extra: Phase = { ...state.phases[1]!, id: 'sleep-2', name: 'Extra sleep' }
    state.phases.push(extra)

    const decoded = decodeProfileToken(profileTokenFromHash(encodeProfileHash(state))!)
    expect(decoded.changedByParser).toBe(true)
    expect(decoded.notices).toEqual([{ code: 'droppedDeepSleep', count: 1 }])
    expect(decoded.state.phases.filter((phase) => phase.isDeepSleep)).toHaveLength(1)
  })

  it('rejects a token that is not a positional profile', () => {
    expect(() => decodeProfileToken('not-json')).toThrow(ConfigImportError)
    expect(() => decodeProfileToken(encodeProfileValue([99]))).toThrow(ConfigImportError)
    expect(() =>
      decodeProfileToken(
        encodeProfileValue([1, [1000, 80, 0], [['Active', 0, 80, 9, 0.2, 1, 1, 0]], []]),
      ),
    ).toThrow(ConfigImportError)
  })

  it('reads a pre-preset battery as 100% already at the battery', () => {
    const token = encodeProfileValue([
      1,
      [1000, 80, 0],
      [
        ['Active', 0, 80, 2, 0.2, 1, 1, 0],
        ['DeepSleep', 1, 0.01, 2],
      ],
      [],
    ])
    const decoded = decodeProfileToken(token)
    expect(decoded.state.battery).toMatchObject({
      efficiencyPercent: 100,
      chemistryId: null,
      cellId: null,
      efficiencyPresetId: 'at-battery',
    })
  })

  it('keeps a stored 100% with an empty efficiency preset empty', () => {
    const state = createExampleProfile()
    state.battery = { ...state.battery, efficiencyPresetId: null }
    const decoded = decodeProfileToken(profileTokenFromHash(encodeProfileHash(state))!)
    expect(decoded.state.battery.efficiencyPercent).toBe(100)
    expect(decoded.state.battery.efficiencyPresetId).toBeNull()
    expect(encodeProfileHash(decoded.state)).toBe(encodeProfileHash(state))
  })

  it('round-trips a chemistry and its cell', () => {
    const state = createExampleProfile()
    state.battery = {
      ...state.battery,
      chemistryId: 'li-socl2',
      cellId: 'aa',
      capacity_mAh: 2600,
      usablePercent: 85,
      selfDischargePercentPerMonth: 0.08,
      efficiencyPercent: 90,
      efficiencyPresetId: 'buck',
    }
    const decoded = decodeProfileToken(profileTokenFromHash(encodeProfileHash(state))!)
    expect(decoded.state.battery).toMatchObject(state.battery)
  })

  it('ignores a hash that is not a profile link', () => {
    expect(profileTokenFromHash('')).toBeNull()
    expect(profileTokenFromHash('#section')).toBeNull()
  })
})
