import { useMemo } from 'react'
import { allNotes, useVersion } from './store'
import type { Note, VaultId } from './types'
import { norm } from './util'

/* Links come from two places, as in Obsidian: [[Titel]] written in a text note, and the
   link button on any note (drawn notes have no text to write links in). */

const WIKI = /\[\[([^\]|#\n]+)(?:#[^\]|\n]*)?(?:\|[^\]\n]*)?\]\]/g

export function wikiTitles(text: string | undefined): string[] {
  if (!text) return []
  const out: string[] = []
  for (const m of text.matchAll(WIKI)) out.push(m[1].trim())
  return out
}

export function resolveTitle(title: string, vault: VaultId, notes = allNotes()): Note | undefined {
  const t = norm(title)
  let other: Note | undefined
  for (const n of notes) {
    if (norm(n.title) !== t) continue
    if (n.vault === vault) return n
    other ??= n
  }
  return other
}

export interface LinkIndex {
  out: Map<string, Set<string>>
  in: Map<string, Set<string>>
  unresolved: Map<string, string[]>
}

let cache: { v: number; idx: LinkIndex } | null = null

export function buildIndex(notes = allNotes(), v = -1): LinkIndex {
  if (cache && cache.v === v && v >= 0) return cache.idx
  const ids = new Set(notes.map((n) => n.id))
  const out = new Map<string, Set<string>>()
  const inn = new Map<string, Set<string>>()
  const unresolved = new Map<string, string[]>()
  const add = (a: string, b: string) => {
    if (a === b || !ids.has(b)) return
    if (!out.has(a)) out.set(a, new Set())
    out.get(a)!.add(b)
    if (!inn.has(b)) inn.set(b, new Set())
    inn.get(b)!.add(a)
  }
  for (const n of notes) {
    n.links.forEach((l) => add(n.id, l))
    for (const t of wikiTitles(n.text)) {
      const target = resolveTitle(t, n.vault, notes)
      if (target) add(n.id, target.id)
      else {
        if (!unresolved.has(n.id)) unresolved.set(n.id, [])
        unresolved.get(n.id)!.push(t)
      }
    }
  }
  const idx = { out, in: inn, unresolved }
  if (v >= 0) cache = { v, idx }
  return idx
}

export function useLinkIndex(): LinkIndex {
  const v = useVersion()
  return useMemo(() => buildIndex(allNotes(), v), [v])
}

export function neighbours(idx: LinkIndex, id: string): Set<string> {
  const s = new Set<string>()
  idx.out.get(id)?.forEach((x) => s.add(x))
  idx.in.get(id)?.forEach((x) => s.add(x))
  return s
}
