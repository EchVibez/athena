import { useSyncExternalStore } from 'react'
import type { Paper } from './types'

export type Theme = 'system' | 'dark' | 'light'
export type PaperTone = 'auto' | 'light' | 'dark'

export interface Prefs {
  theme: Theme
  paperTone: PaperTone
  paper: Paper
  /** Let a finger draw even after a pen has been used on this device. */
  fingerDraws: boolean
  snap: boolean
  pressure: boolean
  penSeen: boolean
  deg: boolean
  supabaseUrl: string
  supabaseKey: string
  sidebar: boolean
  rightPanel: boolean
}

const KEY = 'athena.prefs'

const defaults: Prefs = {
  theme: 'system',
  paperTone: 'light',
  paper: 'rutor',
  fingerDraws: false,
  snap: true,
  pressure: true,
  penSeen: false,
  deg: true,
  supabaseUrl: '',
  supabaseKey: '',
  sidebar: true,
  rightPanel: false,
}

function load(): Prefs {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...defaults }
  }
}

let prefs = load()
const subs = new Set<() => void>()

export function getPrefs() {
  return prefs
}

export function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* private mode: keep in memory */
  }
  if ('theme' in patch) applyTheme()
  subs.forEach((f) => f())
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => prefs,
  )
}

export function resolvedTheme(): 'dark' | 'light' {
  if (prefs.theme === 'system') return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  return prefs.theme
}

export function applyTheme() {
  const t = resolvedTheme()
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#000000' : '#ffffff')
}

matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (prefs.theme === 'system') {
    applyTheme()
    subs.forEach((f) => f())
  }
})

export function paperIsDark(): boolean {
  if (prefs.paperTone === 'auto') return resolvedTheme() === 'dark'
  return prefs.paperTone === 'dark'
}
