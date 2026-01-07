import { inject, type Ref } from 'vue'
import type { Locale } from '@/i18n/messages'

export function useLocale() {
  const locale = inject<Ref<Locale>>('locale')
  const i18n = inject<{
    t: (key: string) => string
    locale: Ref<Locale>
  }>('i18n')

  if (!locale || !i18n) {
    throw new Error('useLocale must be used within a component that provides locale')
  }

  return {
    locale,
    i18n,
  }
}

