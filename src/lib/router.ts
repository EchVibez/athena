import { useSyncExternalStore } from 'react'
import type { VaultId } from './types'

export type Route =
  | { name: 'home' }
  | { name: 'vault'; vault: VaultId; folder?: string }
  | { name: 'graph'; vault: VaultId | 'alla' }
  | { name: 'note'; id: string }
  | { name: 'settings' }
  | { name: 'trash' }

function parseHash(h: string): Route {
  const parts = h.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  switch (parts[0]) {
    case 'v':
      if (parts[2] === 'graf') return { name: 'graph', vault: parts[1] as VaultId }
      return { name: 'vault', vault: (parts[1] as VaultId) || 'fysik', folder: parts[2] }
    case 'graf':
      return { name: 'graph', vault: (parts[1] as VaultId | 'alla') || 'alla' }
    case 'n':
      return { name: 'note', id: parts[1] }
    case 'installningar':
      return { name: 'settings' }
    case 'papperskorg':
      return { name: 'trash' }
    default:
      return { name: 'home' }
  }
}

export function href(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/'
    case 'vault':
      return `#/v/${r.vault}${r.folder ? '/' + encodeURIComponent(r.folder) : ''}`
    case 'graph':
      return r.vault === 'alla' ? '#/graf/alla' : `#/v/${r.vault}/graf`
    case 'note':
      return `#/n/${r.id}`
    case 'settings':
      return '#/installningar'
    case 'trash':
      return '#/papperskorg'
  }
}

let current = parseHash(location.hash)
let currentHash = location.hash
const subs = new Set<() => void>()
/** Hashes visited in this session, so "back" knows whether there is anywhere to go back to. */
const trail: string[] = [location.hash || '#/']

window.addEventListener('hashchange', () => {
  currentHash = location.hash
  current = parseHash(location.hash)
  if (trail.length > 1 && trail[trail.length - 2] === location.hash) trail.pop()
  else trail.push(location.hash)
  subs.forEach((f) => f())
})

export function go(r: Route, replace = false) {
  const h = href(r)
  if (replace) history.replaceState(null, '', h)
  else if (location.hash !== h) location.hash = h
  if (replace) {
    trail[trail.length - 1] = h
    currentHash = h
    current = parseHash(h)
    subs.forEach((f) => f())
  }
}

export function back(fallback: Route = { name: 'home' }) {
  if (trail.length > 1) history.back()
  else go(fallback, true)
}

export function useRoute(): Route {
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => currentHash,
  )
  return current
}
