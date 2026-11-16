import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import * as idb from './idb'
import { getPrefs } from './prefs'
import { applyRemoteAsset, applyRemoteNote, applyRemotePage, setDirtyListener, setRemoteAssetFetcher, type Table } from './store'
import type { AssetMeta, Note } from './types'

/* Athena is local-first: every change lands in IndexedDB and the outbox. When the person is
   signed in, the outbox is pushed to Supabase and other devices' changes are pulled back
   (last write wins, per note and per page). */

export type SyncState = 'local' | 'signedout' | 'syncing' | 'synced' | 'offline' | 'error'

interface Status {
  state: SyncState
  email?: string
  error?: string
  last?: number
  pending: number
}

let status: Status = { state: 'local', pending: 0 }
const subs = new Set<() => void>()
function set(patch: Partial<Status>) {
  status = { ...status, ...patch }
  subs.forEach((f) => f())
}
export function useSync(): Status {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => status,
  )
}

export function config(): { url: string; key: string } | null {
  const p = getPrefs()
  // People often paste the REST address (…/rest/v1/); the client wants the project root.
  const url = (p.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/+$/, '')
  const key = (p.supabaseKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  return url && key ? { url, key } : null
}

let client: SupabaseClient | null = null
let clientKey = ''
let uid: string | null = null
let channel: ReturnType<SupabaseClient['channel']> | null = null

function getClient(): SupabaseClient | null {
  const c = config()
  if (!c) return null
  const k = c.url + '|' + c.key
  if (!client || k !== clientKey) {
    client = createClient(c.url, c.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'athena.auth' } })
    clientKey = k
  }
  return client
}

/* ---------- Start ---------- */

let started = false

export async function startSync() {
  setDirtyListener(() => {
    void countPending()
    schedulePush()
  })
  setRemoteAssetFetcher(downloadAsset)
  void countPending()
  const c = getClient()
  if (!c) {
    set({ state: 'local' })
    return
  }
  if (!started) {
    started = true
    window.addEventListener('online', () => void syncNow())
    window.addEventListener('offline', () => set({ state: 'offline' }))
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void syncNow()
    })
    window.setInterval(() => void syncNow(), 60_000)
  }
  c.auth.onAuthStateChange((_ev, session) => {
    const id = session?.user.id ?? null
    if (id && id !== uid) {
      uid = id
      set({ email: session!.user.email ?? undefined })
      subscribeRealtime()
      void syncNow()
    } else if (!id) {
      uid = null
      unsubscribeRealtime()
      set({ state: 'signedout', email: undefined })
    }
  })
  const { data } = await c.auth.getSession()
  if (!data.session) set({ state: 'signedout' })
}

/** Re-read the configuration (after it was edited in Settings). */
export async function restartSync() {
  unsubscribeRealtime()
  uid = null
  client = null
  clientKey = ''
  await startSync()
}

async function countPending() {
  const keys = await idb.getAllKeys('outbox')
  set({ pending: keys.length })
}

/* ---------- Auth ---------- */

export async function signIn(email: string, password: string) {
  const c = getClient()
  if (!c) throw new Error('Synk är inte inställd.')
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(authMessage(error.message))
}

export async function signUp(email: string, password: string) {
  const c = getClient()
  if (!c) throw new Error('Synk är inte inställd.')
  const { data, error } = await c.auth.signUp({ email, password })
  if (error) throw new Error(authMessage(error.message))
  return !data.session // true: a confirmation mail was sent
}

export async function signOut() {
  await getClient()?.auth.signOut()
}

function authMessage(m: string) {
  if (/invalid login/i.test(m)) return 'Fel e-post eller lösenord.'
  if (/email not confirmed/i.test(m)) return 'Bekräfta din e-post först (kolla inkorgen).'
  if (/already registered/i.test(m)) return 'Det finns redan ett konto med den e-posten.'
  if (/password should be/i.test(m)) return 'Lösenordet måste vara minst 6 tecken.'
  if (/fetch/i.test(m)) return 'Kunde inte nå servern. Är du ansluten?'
  return m
}

/* ---------- Push ---------- */

let pushTimer: number | undefined
let running: Promise<void> | null = null
let again = false

export function schedulePush() {
  window.clearTimeout(pushTimer)
  pushTimer = window.setTimeout(() => void syncNow(true), 1200)
}

export function syncNow(pushOnly = false): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    try {
      do {
        again = false
        await run(pushOnly)
      } while (again)
    } finally {
      running = null
    }
  })()
  return running
}

async function run(pushOnly: boolean) {
  const c = getClient()
  if (!c || !uid) return
  if (!navigator.onLine) {
    set({ state: 'offline' })
    return
  }
  set({ state: 'syncing', error: undefined })
  try {
    await push(c)
    if (!pushOnly) await pull(c)
    await countPending()
    set({ state: 'synced', last: Date.now() })
  } catch (e: any) {
    console.warn('[athena] sync', e)
    set({ state: navigator.onLine ? 'error' : 'offline', error: String(e?.message ?? e) })
  }
}

async function push(c: SupabaseClient) {
  const keys = (await idb.getAllKeys('outbox')) as string[]
  if (!keys.length) return
  const by: Record<Table, string[]> = { notes: [], pages: [], assets: [] }
  for (const k of keys) {
    const [t, id] = k.split(':') as [Table, string]
    by[t]?.push(id)
  }

  // Assets first, so a page never points at an image other devices cannot fetch.
  for (const id of by.assets) {
    const a = await idb.get<AssetMeta>('assets', id)
    if (!a) {
      await idb.del('outbox', `assets:${id}`)
      continue
    }
    if (!a.deleted) {
      const blob = await idb.get<Blob>('blobs', id)
      if (blob) {
        const up = await c.storage.from('assets').upload(`${uid}/${id}`, blob, { upsert: true, contentType: a.mime })
        if (up.error && !/exists/i.test(up.error.message)) throw up.error
      }
    }
    const { error } = await c.from('assets').upsert({ id, user_id: uid, mime: a.mime, size: a.size, updated: a.updated, deleted: !!a.deleted })
    if (error) throw error
    await clearIfUnchanged('assets', id, a.updated)
  }

  for (let i = 0; i < by.pages.length; i += 12) {
    const ids = by.pages.slice(i, i + 12)
    const rows: any[] = []
    for (const id of ids) {
      const p = await idb.get<any>('pages', id)
      if (p) rows.push({ id, user_id: uid, note_id: p.noteId, data: p, updated: p.updated, deleted: !!p.deleted })
      else await idb.del('outbox', `pages:${id}`)
    }
    if (rows.length) {
      const { error } = await c.from('pages').upsert(rows)
      if (error) throw error
      for (const r of rows) await clearIfUnchanged('pages', r.id, r.updated)
    }
  }

  for (let i = 0; i < by.notes.length; i += 50) {
    const ids = by.notes.slice(i, i + 50)
    const rows: any[] = []
    for (const id of ids) {
      const n = await idb.get<Note>('notes', id)
      if (n) rows.push({ id, user_id: uid, data: n, updated: n.updated, deleted: !!n.deleted })
      else await idb.del('outbox', `notes:${id}`)
    }
    if (rows.length) {
      const { error } = await c.from('notes').upsert(rows)
      if (error) throw error
      for (const r of rows) await clearIfUnchanged('notes', r.id, r.updated)
    }
  }
}

async function clearIfUnchanged(table: Table, id: string, updated: number) {
  const cur = await idb.get<any>(table, id)
  if (!cur || cur.updated === updated) await idb.del('outbox', `${table}:${id}`)
}

/* ---------- Pull ---------- */

async function pull(c: SupabaseClient) {
  for (const table of ['assets', 'notes', 'pages'] as const) {
    const ck = `cursor:${uid}:${table}`
    let cur = (await idb.get<{ t: string; id: string }>('meta', ck)) ?? { t: '1970-01-01T00:00:00Z', id: '' }
    // Look a little back in time: rows committed late can carry an earlier timestamp.
    let since = { t: new Date(Date.parse(cur.t) - 15_000).toISOString(), id: '' }
    for (;;) {
      const q = c
        .from(table)
        .select('*')
        .or(`synced_at.gt."${since.t}",and(synced_at.eq."${since.t}",id.gt.${since.id || '00000000-0000-0000-0000-000000000000'})`)
        .order('synced_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(300)
      const { data, error } = await q
      if (error) throw error
      if (!data?.length) break
      for (const row of data) {
        if (table === 'notes') await applyRemoteNote({ ...(row.data as Note), deleted: row.deleted })
        else if (table === 'pages') await applyRemotePage({ ...row.data, deleted: row.deleted })
        else await applyRemoteAsset({ id: row.id, mime: row.mime, size: row.size, updated: row.updated, deleted: row.deleted })
      }
      const last = data[data.length - 1]
      since = { t: last.synced_at, id: last.id }
      if (Date.parse(last.synced_at) >= Date.parse(cur.t)) cur = { t: last.synced_at, id: last.id }
      if (data.length < 300) break
    }
    await idb.put('meta', cur, ck)
  }
}

/* ---------- Realtime ---------- */

let pullTimer: number | undefined
function schedulePull() {
  window.clearTimeout(pullTimer)
  pullTimer = window.setTimeout(() => void syncNow(), 700)
}

function subscribeRealtime() {
  const c = getClient()
  if (!c || !uid) return
  unsubscribeRealtime()
  channel = c.channel('athena-' + uid)
  for (const table of ['notes', 'pages', 'assets']) {
    channel.on('postgres_changes' as any, { event: '*', schema: 'public', table, filter: `user_id=eq.${uid}` }, () => schedulePull())
  }
  channel.subscribe()
}

function unsubscribeRealtime() {
  if (channel && client) void client.removeChannel(channel)
  channel = null
}

/* ---------- Assets ---------- */

async function downloadAsset(id: string): Promise<Blob | null> {
  const c = getClient()
  if (!c || !uid) return null
  const { data, error } = await c.storage.from('assets').download(`${uid}/${id}`)
  if (error) return null
  return data
}
