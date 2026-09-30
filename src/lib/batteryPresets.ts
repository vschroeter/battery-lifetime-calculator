import type {
  BatteryConfig,
  ChemistryId,
  EfficiencyPresetId,
} from '@/types/calculator'

export interface CellPreset {
  id: string
  capacity_mAh: number
  labelKey: string
}

export interface ChemistryPreset {
  id: ChemistryId
  labelKey: string
  selfDischargePercentPerMonth: number
  usablePercent: number
  sliderMin: number
  sliderMax: number
  sliderStep: number
  cells: readonly CellPreset[]
}

export interface SliderBand {
  min: number
  max: number
  step: number
}

/** Slider when no chemistry is selected. The field still accepts the full legal range. */
export const CUSTOM_SELF_DISCHARGE_BAND: SliderBand = { min: 0, max: 5, step: 0.1 }

export const EFFICIENCY_SLIDER: SliderBand = { min: 60, max: 100, step: 1 }

export const EFFICIENCY_PRESETS = [
  { id: 'at-battery', percent: 100, labelKey: 'efficiencyAtBattery' },
  { id: 'buck', percent: 90, labelKey: 'efficiencyBuck' },
  { id: 'buck-boost', percent: 80, labelKey: 'efficiencyBuckBoost' },
] as const satisfies readonly {
  id: EfficiencyPresetId
  percent: number
  labelKey: string
}[]

const HALF_AA: CellPreset = { id: 'half-aa', capacity_mAh: 1200, labelKey: 'cellHalfAa' }
const AA_LIFE_S2: CellPreset = { id: 'aa', capacity_mAh: 3500, labelKey: 'cellAa' }
const AA_ALKALINE: CellPreset = { id: 'aa', capacity_mAh: 2500, labelKey: 'cellAa' }
const AA_NIMH: CellPreset = { id: 'aa', capacity_mAh: 2000, labelKey: 'cellAa' }
const AAA_LIFE_S2: CellPreset = { id: 'aaa', capacity_mAh: 1250, labelKey: 'cellAaa' }
const AAA_ALKALINE: CellPreset = { id: 'aaa', capacity_mAh: 1200, labelKey: 'cellAaa' }
const AAA_NIMH: CellPreset = { id: 'aaa', capacity_mAh: 800, labelKey: 'cellAaa' }

export const CHEMISTRIES: readonly ChemistryPreset[] = [
  {
    id: 'li-socl2',
    labelKey: 'chemistryLiSocl2',
    selfDischargePercentPerMonth: 0.08,
    usablePercent: 85,
    sliderMin: 0,
    sliderMax: 1,
    sliderStep: 0.01,
    cells: [HALF_AA, { id: 'aa', capacity_mAh: 2600, labelKey: 'cellAa' }],
  },
  {
    id: 'li-mno2',
    labelKey: 'chemistryLiMno2',
    selfDischargePercentPerMonth: 0.08,
    usablePercent: 90,
    sliderMin: 0,
    sliderMax: 1,
    sliderStep: 0.01,
    cells: [
      { id: 'cr2032', capacity_mAh: 225, labelKey: 'cellCr2032' },
      { id: 'cr2450', capacity_mAh: 620, labelKey: 'cellCr2450' },
      { id: 'cr123a', capacity_mAh: 1500, labelKey: 'cellCr123a' },
    ],
  },
  {
    id: 'li-fes2',
    labelKey: 'chemistryLiFes2',
    selfDischargePercentPerMonth: 0.04,
    usablePercent: 90,
    sliderMin: 0,
    sliderMax: 1,
    sliderStep: 0.01,
    cells: [AAA_LIFE_S2, AA_LIFE_S2],
  },
  {
    id: 'alkaline',
    labelKey: 'chemistryAlkaline',
    selfDischargePercentPerMonth: 0.25,
    usablePercent: 50,
    sliderMin: 0,
    sliderMax: 2,
    sliderStep: 0.01,
    cells: [AAA_ALKALINE, AA_ALKALINE],
  },
  {
    id: 'li-ion',
    labelKey: 'chemistryLiIon',
    selfDischargePercentPerMonth: 2,
    usablePercent: 80,
    sliderMin: 0,
    sliderMax: 8,
    sliderStep: 0.1,
    cells: [
      { id: 'pouch-1000', capacity_mAh: 1000, labelKey: 'cellPouch1000' },
      { id: '18650', capacity_mAh: 3000, labelKey: 'cell18650' },
    ],
  },
  {
    id: 'lifepo4',
    labelKey: 'chemistryLiFePo4',
    selfDischargePercentPerMonth: 1.5,
    usablePercent: 90,
    sliderMin: 0,
    sliderMax: 5,
    sliderStep: 0.1,
    cells: [{ id: '18650', capacity_mAh: 1500, labelKey: 'cell18650' }],
  },
  {
    id: 'nimh-lsd',
    labelKey: 'chemistryNimhLsd',
    selfDischargePercentPerMonth: 1,
    usablePercent: 80,
    sliderMin: 0,
    sliderMax: 5,
    sliderStep: 0.1,
    cells: [AAA_NIMH, AA_NIMH],
  },
]

export function chemistryById(id: ChemistryId): ChemistryPreset {
  const chemistry = CHEMISTRIES.find((item) => item.id === id)
  if (!chemistry) {
    throw new Error(`Unknown chemistry ${id}`)
  }
  return chemistry
}

export function selfDischargeBand(chemistryId: ChemistryId | null): SliderBand {
  if (chemistryId === null) {
    return CUSTOM_SELF_DISCHARGE_BAND
  }
  const chemistry = chemistryById(chemistryId)
  return {
    min: chemistry.sliderMin,
    max: chemistry.sliderMax,
    step: chemistry.sliderStep,
  }
}

export function cellsFor(chemistryId: ChemistryId | null): readonly CellPreset[] {
  if (chemistryId === null) {
    return []
  }
  return chemistryById(chemistryId).cells
}

export function findCell(chemistryId: ChemistryId | null, cellId: string): CellPreset | null {
  return cellsFor(chemistryId).find((cell) => cell.id === cellId) ?? null
}

export function chemistryLabelKey(id: ChemistryId): string {
  return chemistryById(id).labelKey
}

export function cellLabelKey(chemistryId: ChemistryId | null, cellId: string): string {
  return findCell(chemistryId, cellId)?.labelKey ?? 'presetCustom'
}

export function isChemistryId(value: string): value is ChemistryId {
  return CHEMISTRIES.some((chemistry) => chemistry.id === value)
}

export function isEfficiencyPresetId(value: string): value is EfficiencyPresetId {
  return EFFICIENCY_PRESETS.some((preset) => preset.id === value)
}

export function efficiencyPresetById(id: EfficiencyPresetId) {
  const preset = EFFICIENCY_PRESETS.find((item) => item.id === id)
  if (!preset) {
    throw new Error(`Unknown efficiency preset ${id}`)
  }
  return preset
}

/** Choosing Custom clears the chemistry and its cell, and leaves the numbers as typed. */
export function withChemistry(
  battery: BatteryConfig,
  chemistryId: ChemistryId | null,
): BatteryConfig {
  if (chemistryId === null) {
    return { ...battery, chemistryId: null, cellId: null }
  }
  const chemistry = chemistryById(chemistryId)
  return {
    ...battery,
    chemistryId,
    cellId: null,
    usablePercent: chemistry.usablePercent,
    selfDischargePercentPerMonth: chemistry.selfDischargePercentPerMonth,
  }
}

/** Choosing Custom clears the cell and leaves the milliamp-hours as typed. */
export function withCell(battery: BatteryConfig, cellId: string | null): BatteryConfig {
  if (cellId === null) {
    return { ...battery, cellId: null }
  }
  const cell = findCell(battery.chemistryId, cellId)
  if (!cell) {
    return battery
  }
  return { ...battery, cellId: cell.id, capacity_mAh: cell.capacity_mAh }
}

export function withEfficiencyPreset(
  battery: BatteryConfig,
  presetId: EfficiencyPresetId,
): BatteryConfig {
  const preset = efficiencyPresetById(presetId)
  return {
    ...battery,
    efficiencyPercent: preset.percent,
    efficiencyPresetId: preset.id,
  }
}

export function commitCapacity(battery: BatteryConfig, capacity_mAh: number): BatteryConfig {
  return { ...battery, capacity_mAh, cellId: null }
}

export function commitEfficiency(battery: BatteryConfig, efficiencyPercent: number): BatteryConfig {
  return { ...battery, efficiencyPercent, efficiencyPresetId: null }
}

/**
 * The short link layout used before presets existed.
 * It decodes as 100% with the “already at the battery” preset and Custom chemistry.
 */
export function isLegacyBatteryEncoding(battery: BatteryConfig): boolean {
  return (
    battery.efficiencyPercent === 100 &&
    battery.chemistryId === null &&
    battery.cellId === null &&
    battery.efficiencyPresetId === 'at-battery'
  )
}

/** 0 is Custom. Any other missing index is an invalid code. */
export function encodeChemistry(chemistryId: ChemistryId | null): number {
  if (chemistryId === null) {
    return 0
  }
  return CHEMISTRIES.findIndex((chemistry) => chemistry.id === chemistryId) + 1
}

export function decodeChemistry(code: number): ChemistryId | null | undefined {
  if (!Number.isInteger(code) || code < 0) {
    return undefined
  }
  if (code === 0) {
    return null
  }
  return CHEMISTRIES[code - 1]?.id
}

export function encodeCell(chemistryId: ChemistryId | null, cellId: string | null): number {
  if (cellId === null) {
    return 0
  }
  const index = cellsFor(chemistryId).findIndex((cell) => cell.id === cellId)
  if (index < 0) {
    throw new Error(`Cell ${cellId} is not in the selected chemistry`)
  }
  return index + 1
}

export function decodeCell(
  chemistryId: ChemistryId | null,
  code: number,
): string | null | undefined {
  if (!Number.isInteger(code) || code < 0) {
    return undefined
  }
  if (code === 0) {
    return null
  }
  return cellsFor(chemistryId)[code - 1]?.id
}

export function encodeEfficiencyPreset(presetId: EfficiencyPresetId | null): number {
  if (presetId === null) {
    return 0
  }
  return EFFICIENCY_PRESETS.findIndex((preset) => preset.id === presetId) + 1
}

export function decodeEfficiencyPreset(code: number): EfficiencyPresetId | null | undefined {
  if (!Number.isInteger(code) || code < 0) {
    return undefined
  }
  if (code === 0) {
    return null
  }
  return EFFICIENCY_PRESETS[code - 1]?.id
}
