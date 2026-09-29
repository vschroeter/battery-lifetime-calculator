import { ref, watch } from 'vue'
import type { ImportNotice } from '@/lib/import'
import { createExampleProfile } from '@/lib/exampleProfile'
import {
  decodeProfileToken,
  encodeProfileHash,
  profilesEqual,
  profileTokenFromHash,
} from '@/lib/profileUrl'
import { useCalculatorStore } from '@/stores/calculator'

export type ProfileUrlFeedback =
  | { kind: 'error'; error: unknown }
  | { kind: 'notices'; notices: ImportNotice[] }
  | { kind: 'normalized' }
  | { kind: 'encode-failed' }
  | { kind: 'copied' }
  | { kind: 'manual-copy'; url: string }

const feedback = ref<ProfileUrlFeedback | null>(null)
const hashPresent = ref(false)

let live = false
let suspendDepth = 0
let installed = false
let encodeErrorVisible = false

function urlWithHash(hash: string): string {
  const url = new URL(window.location.href)
  url.hash = hash.replace(/^#/u, '')
  return `${url.pathname}${url.search}${url.hash}`
}

function hashMatchesStore(state: ReturnType<typeof useCalculatorStore>['state']): boolean {
  const token = profileTokenFromHash(window.location.hash)
  if (token === null) {
    return false
  }
  try {
    return token === profileTokenFromHash(encodeProfileHash(state))
  } catch {
    return false
  }
}

function publishProfile(state: ReturnType<typeof useCalculatorStore>['state']): boolean {
  if (hashMatchesStore(state)) {
    hashPresent.value = true
    live = true
    encodeErrorVisible = false
    return true
  }

  try {
    const next = urlWithHash(encodeProfileHash(state))
    window.history.replaceState(window.history.state, '', next)
    hashPresent.value = true
    live = true
    encodeErrorVisible = false
    return true
  } catch {
    if (!encodeErrorVisible) {
      encodeErrorVisible = true
      feedback.value = { kind: 'encode-failed' }
    }
    return false
  }
}

function clearProfileHash(): void {
  const url = new URL(window.location.href)
  url.hash = ''
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
  hashPresent.value = false
  live = false
}

function loadFromLocation(store: ReturnType<typeof useCalculatorStore>): void {
  const token = profileTokenFromHash(window.location.hash)
  if (token === null) {
    if (live) {
      suspendDepth += 1
      try {
        store.resetToESP32Preset()
      } finally {
        suspendDepth -= 1
      }
    }
    hashPresent.value = false
    live = false
    return
  }

  try {
    const decoded = decodeProfileToken(token)
    suspendDepth += 1
    try {
      store.replaceState(decoded.state)
    } finally {
      suspendDepth -= 1
    }
    hashPresent.value = true
    live = true
    if (!decoded.changedByParser) {
      return
    }
    if (!publishProfile(store.state)) {
      return
    }
    feedback.value =
      decoded.notices.length > 0
        ? { kind: 'notices', notices: decoded.notices }
        : { kind: 'normalized' }
  } catch (error) {
    suspendDepth += 1
    try {
      store.resetToESP32Preset()
    } finally {
      suspendDepth -= 1
    }
    clearProfileHash()
    feedback.value = { kind: 'error', error }
  }
}

function install(store: ReturnType<typeof useCalculatorStore>): void {
  watch(
    () => store.state,
    (state) => {
      if (suspendDepth > 0) {
        return
      }
      if (!live && profilesEqual(state, createExampleProfile())) {
        return
      }
      publishProfile(state)
    },
    { deep: true, flush: 'sync' },
  )
  loadFromLocation(store)
  window.addEventListener('hashchange', () => loadFromLocation(store))
}

export function useProfileUrl() {
  const store = useCalculatorStore()
  if (!installed) {
    installed = true
    install(store)
  }

  async function copyProfileLink(): Promise<void> {
    if (!publishProfile(store.state)) {
      return
    }
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      feedback.value = { kind: 'copied' }
    } catch {
      feedback.value = { kind: 'manual-copy', url }
    }
  }

  function resetToExample(): void {
    suspendDepth += 1
    try {
      store.resetToESP32Preset()
    } finally {
      suspendDepth -= 1
    }
    clearProfileHash()
  }

  function publishImportedProfile(): boolean {
    return publishProfile(store.state)
  }

  return {
    feedback,
    hashPresent,
    copyProfileLink,
    resetToExample,
    publishImportedProfile,
  }
}
