/* A tiny promise wrapper around IndexedDB. Everything Athena keeps lives here first;
   Supabase is a mirror that other devices read from. */

export type StoreName = 'notes' | 'pages' | 'assets' | 'blobs' | 'outbox' | 'meta'

const DB_NAME = 'athena'
const DB_VERSION = 1

let dbp: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('pages')) db.createObjectStore('pages', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs')
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox')
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function get<T = any>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await open()
  return wrap(db.transaction(store).objectStore(store).get(key))
}

export async function getAll<T = any>(store: StoreName): Promise<T[]> {
  const db = await open()
  return wrap(db.transaction(store).objectStore(store).getAll())
}

export async function getAllKeys(store: StoreName): Promise<IDBValidKey[]> {
  const db = await open()
  return wrap(db.transaction(store).objectStore(store).getAllKeys())
}

export async function put(store: StoreName, value: any, key?: IDBValidKey): Promise<void> {
  const db = await open()
  await wrap(db.transaction(store, 'readwrite').objectStore(store).put(value, key))
}

export async function putMany(store: StoreName, values: any[]): Promise<void> {
  if (!values.length) return
  const db = await open()
  const tx = db.transaction(store, 'readwrite')
  const os = tx.objectStore(store)
  for (const v of values) os.put(v)
  await new Promise<void>((res, rej) => {
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
    tx.onabort = () => rej(tx.error)
  })
}

export async function del(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await open()
  await wrap(db.transaction(store, 'readwrite').objectStore(store).delete(key))
}

export async function clearAll(): Promise<void> {
  const db = await open()
  const names: StoreName[] = ['notes', 'pages', 'assets', 'blobs', 'outbox', 'meta']
  const tx = db.transaction(names, 'readwrite')
  for (const n of names) tx.objectStore(n).clear()
  await new Promise<void>((res, rej) => {
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
}
