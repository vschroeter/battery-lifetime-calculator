import { useCalculatorStore } from '@/stores/calculator'
import { useLocale } from '@/composables/useLocale'
import type { FieldRule } from '@/lib/fields'

const RULE_MESSAGE: Record<FieldRule, string> = {
  nonNegative: 'fieldNonNegative',
  positive: 'fieldPositive',
  usableRange: 'fieldUsableRange',
  selfDischargeRange: 'fieldSelfDischargeRange',
  efficiencyRange: 'fieldEfficiencyRange',
}

export function useFieldMessage() {
  const store = useCalculatorStore()
  const { i18n } = useLocale()

  function message(key: string): string {
    const rule = store.issueRule(key)
    if (!rule) {
      return ''
    }
    return i18n.t(RULE_MESSAGE[rule])
  }

  return { message }
}
