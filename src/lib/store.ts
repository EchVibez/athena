import { useMemo, useSyncExternalStore } from 'react'
import * as idb from './idb'
import { loadStroke, storeStroke, type StoredStroke } from './ink'
import { getPrefs } from './prefs'
import type { AssetMeta, Kind, Note, Page, Paper, VaultId } from './types'
import { uuid } from './util'

/* ---------- Change notification ---------- */

let version = 0
const subs = new Set<() => void>()
function emit() {
  version++
  subs.forEach((f) => f())
}
export function subscribe(f: () => void) {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
export function useVersion() {
  return useSyncExternalStore(subscribe, () => version)
}

/* ---------- Outbox (what still has to reach Supabase) ---------- */

export type Table = 'notes' | 'pages' | 'assets'
let onDirty: () => void = () => {}
export function setDirtyListener(f: () => void) {
  onDirty = f
}
async function markDirty(table: Table, id: string) {
  await idb.put('outbox', { table, id }, `${table}:${id}`)
  onDirty()
}

/* ---------- Notes ---------- */

const notes = new Map<string, Note>()
let ready = false

export async function init() {
  const all = await idb.getAll<Note>('notes')
  for (const n of all) notes.set(n.id, n)
  const metas = await idb.getAll<AssetMeta>('assets')
  for (const a of metas) assets.set(a.id, a)
  ready = true
  emit()
}

export const isReady = () => ready

export function allNotes(): Note[] {
  const out: Note[] = []
  notes.forEach((n) => {
    if (!n.deleted) out.push(n)
  })
  return out
}

export function deletedNotes(): Note[] {
  const out: Note[] = []
  notes.forEach((n) => {
    if (n.deleted) out.push(n)
  })
  return out
}

export function getNote(id: string): Note | undefined {
  const n = notes.get(id)
  return n && !n.deleted ? n : undefined
}

export function useNotes(): Note[] {
  const v = useVersion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => allNotes(), [v])
}

export function useNote(id: string | undefined): Note | undefined {
  useVersion()
  return id ? getNote(id) : undefined
}

async function writeNote(n: Note) {
  notes.set(n.id, n)
  emit()
  await idb.put('notes', n)
  await markDirty('notes', n.id)
}

export interface NewNote {
  vault: VaultId
  title?: string
  kind?: Kind
  format?: 'ink' | 'text'
  folder?: string
  tags?: string[]
  links?: string[]
  text?: string
  paper?: Paper
}

export async function createNote(o: NewNote): Promise<Note> {
  const now = Date.now()
  const n: Note = {
    id: uuid(),
    vault: o.vault,
    title: o.title?.trim() || 'Namnlös',
    kind: o.kind ?? 'anteckning',
    format: o.format ?? 'ink',
    folder: o.folder?.trim() ?? '',
    tags: o.tags ?? [],
    links: o.links ?? [],
    status: o.kind === 'uppgift' ? 'olost' : undefined,
    text: o.format === 'text' ? (o.text ?? '') : undefined,
    pages: [],
    paper: o.paper ?? getPrefs().paper,
    created: now,
    updated: now,
  }
  if (n.format === 'ink') {
    const p = blankPage(n.id)
    n.pages = [p.id]
    await writePage(p)
  }
  await writeNote(n)
  return n
}

export async function updateNote(id: string, patch: Partial<Note>) {
  const n = notes.get(id)
  if (!n) return
  await writeNote({ ...n, ...patch, updated: Date.now() })
}

export async function deleteNote(id: string) {
  const n = notes.get(id)
  if (!n) return
  await writeNote({ ...n, deleted: true, updated: Date.now() })
}

export async function restoreNote(id: string) {
  const n = notes.get(id)
  if (!n) return
  await writeNote({ ...n, deleted: false, updated: Date.now() })
}

/** Gone for good, here and (once synced) everywhere: pages too. */
export async function purgeNote(id: string) {
  const n = notes.get(id)
  if (!n) return
  for (const pid of n.pages) {
    const p = await loadPage(pid)
    if (p) await writePage({ ...p, strokes: [], objects: [], deleted: true, updated: Date.now() })
  }
  await writeNote({ ...n, title: '', text: '', pages: [], links: [], deleted: true, updated: Date.now(), importKey: undefined })
  notes.delete(id)
  emit()
}

export async function addLink(from: string, to: string) {
  const n = notes.get(from)
  if (!n || from === to || n.links.includes(to)) return
  await updateNote(from, { links: [...n.links, to] })
}

export async function removeLink(from: string, to: string) {
  const n = notes.get(from)
  if (!n) return
  await updateNote(from, { links: n.links.filter((l) => l !== to) })
}

/* ---------- Pages ---------- */

interface StoredPage extends Omit<Page, 'strokes'> {
  strokes: StoredStroke[]
}

const pages = new Map<string, Page>()
const pageListeners = new Map<string, Set<(p: Page) => void>>()

export function blankPage(noteId: string, paper?: Paper): Page {
  return { id: uuid(), noteId, paper, strokes: [], objects: [], updated: Date.now() }
}

function decodePage(s: StoredPage): Page {
  return { ...s, strokes: (s.strokes || []).map(loadStroke), objects: s.objects || [] }
}

export function encodePage(p: Page): StoredPage {
  return { ...p, strokes: p.strokes.map(storeStroke) }
}

export async function loadPage(id: string): Promise<Page | undefined> {
  const c = pages.get(id)
  if (c) return c
  const s = await idb.get<StoredPage>('pages', id)
  if (!s) return undefined
  const p = decodePage(s)
  pages.set(id, p)
  return p
}

export async function loadPages(note: Note): Promise<Page[]> {
  const out: Page[] = []
  for (const id of note.pages) {
    let p = await loadPage(id)
    if (!p) {
      // The page has not arrived from another device yet: show an empty one meanwhile.
      p = { id, noteId: note.id, strokes: [], objects: [], updated: 0 }
    }
    out.push(p)
  }
  return out
}

async function writePage(p: Page) {
  pages.set(p.id, p)
  await idb.put('pages', encodePage(p))
  await markDirty('pages', p.id)
}

const pendingSaves = new Map<string, number>()

/** Called by the editor on every change; written to disk shortly after. */
export function savePage(p: Page) {
  const page = { ...p, updated: Date.now() }
  pages.set(p.id, page)
  window.clearTimeout(pendingSaves.get(p.id))
  pendingSaves.set(
    p.id,
    window.setTimeout(() => {
      pendingSaves.delete(p.id)
      const latest = pages.get(p.id)
      if (latest) void writePage(latest)
    }, 400),
  )
  const n = notes.get(p.noteId)
  if (n) {
    notes.set(n.id, { ...n, updated: Date.now() })
    emit()
    touchNote(n.id)
  }
  return page
}

const touchTimers = new Map<string, number>()
function touchNote(id: string) {
  window.clearTimeout(touchTimers.get(id))
  touchTimers.set(
    id,
    window.setTimeout(() => {
      const n = notes.get(id)
      if (n) void writeNote(n)
    }, 1500),
  )
}

export async function flushSaves() {
  for (const [id, t] of pendingSaves) {
    window.clearTimeout(t)
    const p = pages.get(id)
    if (p) await writePage(p)
  }
  pendingSaves.clear()
}

window.addEventListener('pagehide', () => void flushSaves())
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flushSaves()
})

export async function addPage(noteId: string, after?: string, paper?: Paper): Promise<Page | undefined> {
  const n = notes.get(noteId)
  if (!n) return
  const p = blankPage(noteId, paper)
  await writePage(p)
  const list = [...n.pages]
  const i = after ? list.indexOf(after) : -1
  list.splice(i >= 0 ? i + 1 : list.length, 0, p.id)
  await updateNote(noteId, { pages: list })
  return p
}

export async function removePage(noteId: string, pageId: string) {
  const n = notes.get(noteId)
  if (!n) return
  const p = await loadPage(pageId)
  if (p) await writePage({ ...p, deleted: true, updated: Date.now() })
  await updateNote(noteId, { pages: n.pages.filter((x) => x !== pageId) })
}

export async function movePage(noteId: string, pageId: string, dir: -1 | 1) {
  const n = notes.get(noteId)
  if (!n) return
  const list = [...n.pages]
  const i = list.indexOf(pageId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
  await updateNote(noteId, { pages: list })
}

export function onPageChanged(id: string, f: (p: Page) => void) {
  let s = pageListeners.get(id)
  if (!s) pageListeners.set(id, (s = new Set()))
  s.add(f)
  return () => {
    s!.delete(f)
  }
}

/* ---------- Assets (images) ---------- */

const assets = new Map<string, AssetMeta>()
const urlCache = new Map<string, string>()
const bitmapCache = new Map<string, Promise<ImageBitmap | null>>()
let remoteFetch: ((id: string) => Promise<Blob | null>) | null = null

export function setRemoteAssetFetcher(f: (id: string) => Promise<Blob | null>) {
  remoteFetch = f
}

export async function putAsset(blob: Blob, id = uuid()): Promise<string> {
  const meta: AssetMeta = { id, mime: blob.type || 'image/jpeg', size: blob.size, updated: Date.now() }
  assets.set(id, meta)
  await idb.put('blobs', blob, id)
  await idb.put('assets', meta)
  await markDirty('assets', id)
  return id
}

export async function getAssetBlob(id: string): Promise<Blob | null> {
  const b = await idb.get<Blob>('blobs', id)
  if (b) return b
  if (!remoteFetch) return null
  const r = await remoteFetch(id)
  if (r) await idb.put('blobs', r, id)
  return r
}

export async function assetUrl(id: string): Promise<string | null> {
  const c = urlCache.get(id)
  if (c) return c
  const b = await getAssetBlob(id)
  if (!b) return null
  const u = URL.createObjectURL(b)
  urlCache.set(id, u)
  return u
}

export function assetBitmap(id: string): Promise<ImageBitmap | null> {
  let p = bitmapCache.get(id)
  if (!p) {
    p = getAssetBlob(id).then((b) => (b ? createImageBitmap(b).catch(() => null) : null))
    bitmapCache.set(id, p)
    p.then((r) => {
      if (!r) bitmapCache.delete(id)
    })
  }
  return p
}

export function assetMeta(id: string) {
  return assets.get(id)
}

/* ---------- Applying what other devices wrote ---------- */

export async function applyRemoteNote(n: Note) {
  const local = notes.get(n.id)
  if (local && local.updated >= n.updated) return false
  notes.set(n.id, n)
  await idb.put('notes', n)
  await idb.del('outbox', `notes:${n.id}`)
  emit()
  return true
}

export async function applyRemotePage(s: StoredPage) {
  const cached = pages.get(s.id)
  const local = cached ? cached.updated : ((await idb.get<StoredPage>('pages', s.id))?.updated ?? -1)
  if (local >= s.updated) return false
  if (pendingSaves.has(s.id)) return false
  await idb.put('pages', s)
  await idb.del('outbox', `pages:${s.id}`)
  const p = decodePage(s)
  if (cached) pages.set(s.id, p)
  pageListeners.get(s.id)?.forEach((f) => f(p))
  emit()
  return true
}

export async function applyRemoteAsset(a: AssetMeta) {
  const local = assets.get(a.id)
  if (local && local.updated >= a.updated) return false
  assets.set(a.id, a)
  await idb.put('assets', a)
  return true
}

/* ---------- Bulk (import, restore) ---------- */

export async function putImported(ns: Note[], ps: Page[]) {
  for (const p of ps) await writePage(p)
  for (const n of ns) await writeNote(n)
}

export function noteByImportKey(key: string): Note | undefined {
  for (const n of notes.values()) if (n.importKey === key && !n.deleted) return n
}

export async function wipeLocal() {
  await idb.clearAll()
  notes.clear()
  pages.clear()
  assets.clear()
  emit()
}

export function folderList(vault: VaultId): string[] {
  const s = new Set<string>()
  for (const n of allNotes()) if (n.vault === vault && n.folder) s.add(n.folder)
  return [...s].sort((a, b) => a.localeCompare(b, 'sv', { numeric: true }))
}

export function tagList(vault?: VaultId): string[] {
  const s = new Set<string>()
  for (const n of allNotes()) if (!vault || n.vault === vault) n.tags.forEach((t) => s.add(t))
  return [...s].sort((a, b) => a.localeCompare(b, 'sv'))
}
