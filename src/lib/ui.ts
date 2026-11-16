import { useSyncExternalStore } from 'react'
import type { Kind, VaultId } from './types'

export interface NewNoteDefaults {
  vault?: VaultId
  kind?: Kind
  folder?: string
  format?: 'ink' | 'text'
  title?: string
  linkFrom?: string
}

interface UIState {
  switcher: boolean
  newNote: NewNoteDefaults | null
  calc: boolean
  drawer: boolean
  toast: { text: string; id: number } | null
  lastVault: VaultId
}

let state: UIState = {
  switcher: false,
  newNote: null,
  calc: false,
  drawer: false,
  toast: null,
  lastVault: (localStorage.getItem('athena.lastVault') as VaultId) || 'fysik',
}
const subs = new Set<() => void>()

export function setUI(patch: Partial<UIState>) {
  state = { ...state, ...patch }
  if (patch.lastVault) localStorage.setItem('athena.lastVault', patch.lastVault)
  subs.forEach((f) => f())
}

export function useUI(): UIState {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => state,
  )
}

export const getUI = () => state

let toastTimer: number | undefined
export function toast(text: string) {
  window.clearTimeout(toastTimer)
  setUI({ toast: { text, id: Date.now() } })
  toastTimer = window.setTimeout(() => setUI({ toast: null }), 2600)
}
