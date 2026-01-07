import { type Ref } from 'vue'
import { getMessage, type Locale } from '@/i18n/messages'

export function useI18nLite(locale: Ref<Locale>) {
  const t = (key: string) => getMessage(locale.value, key)

  return {
    t,
    locale,
  }
}

