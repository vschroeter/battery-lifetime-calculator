import { describe, expect, it } from 'vitest'
import {
  commitCapacity,
  commitEfficiency,
  selfDischargeBand,
  withCell,
  withChemistry,
  withEfficiencyPreset,
} from '@/lib/batteryPresets'
import { createExampleProfile } from '@/lib/exampleProfile'

describe('battery presets', () => {
  const battery = createExampleProfile().battery

  it('writes chemistry defaults, clears the cell, and leaves capacity', () => {
    const next = withChemistry({ ...battery, capacity_mAh: 1000, cellId: 'pouch-1000' }, 'alkaline')
    expect(next.chemistryId).toBe('alkaline')
    expect(next.cellId).toBeNull()
    expect(next.capacity_mAh).toBe(1000)
    expect(next.usablePercent).toBe(50)
    expect(next.selfDischargePercentPerMonth).toBe(0.25)
    expect(selfDischargeBand(next.chemistryId)).toEqual({ min: 0, max: 2, step: 0.01 })
  })

  it('leaves the numbers alone when chemistry is cleared', () => {
    const chosen = withChemistry(battery, 'li-ion')
    const custom = withChemistry({ ...chosen, cellId: '18650', capacity_mAh: 3000 }, null)
    expect(custom.chemistryId).toBeNull()
    expect(custom.cellId).toBeNull()
    expect(custom.capacity_mAh).toBe(3000)
    expect(custom.selfDischargePercentPerMonth).toBe(2)
    expect(selfDischargeBand(null)).toEqual({ min: 0, max: 5, step: 0.1 })
  })

  it('writes only capacity when a cell is chosen', () => {
    const chemistry = withChemistry(battery, 'li-socl2')
    const cell = withCell(chemistry, 'aa')
    expect(cell.capacity_mAh).toBe(2600)
    expect(cell.cellId).toBe('aa')
    expect(cell.selfDischargePercentPerMonth).toBe(chemistry.selfDischargePercentPerMonth)
    expect(withCell(cell, null).capacity_mAh).toBe(2600)
    expect(withCell(cell, null).cellId).toBeNull()
  })

  it('clears the cell when capacity is typed and the preset when efficiency is typed', () => {
    const cell = withCell(withChemistry(battery, 'li-ion'), '18650')
    expect(commitCapacity(cell, 1200).cellId).toBeNull()
    expect(commitCapacity(cell, 1200).chemistryId).toBe('li-ion')

    const preset = withEfficiencyPreset(battery, 'buck')
    expect(preset).toMatchObject({ efficiencyPercent: 90, efficiencyPresetId: 'buck' })
    const typed = commitEfficiency(preset, 90)
    expect(typed.efficiencyPercent).toBe(90)
    expect(typed.efficiencyPresetId).toBeNull()
  })
})
