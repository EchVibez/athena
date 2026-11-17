import { strFromU8, strToU8, unzip, zip, type Unzipped } from 'fflate'
import * as idb from './idb'
import { allNotes, encodePage, getNote, loadPage, noteByImportKey, putAsset, putImported } from './store'
import type { AssetMeta, Kind, Note, Page, Paper, VaultId } from './types'
import { uuid } from './util'
import { loadStroke } from './ink'

/* Import packages (material prepared outside the app) and full backups, both as .zip. */

interface ImportNote {
  key: string
  title: string
  kind: Kind
  format?: 'ink' | 'text'
  folder?: string
  tags?: string[]
  links?: string[]
  text?: string
  pages?: string[]
  status?: Note['status']
  paper?: Paper
}

interface ImportManifest {
  format: 'athena-import'
  version: 1
  vault: VaultId
  notes: ImportNote[]
}

export interface ImportResult {
  added: number
  skipped: number
  pages: number
}

function unzipAsync(data: Uint8Array): Promise<Unzipped> {
  return new Promise((res, rej) => unzip(data, (err, out) => (err ? rej(err) : res(out))))
}

export async function importZip(file: Blob, progress?: (done: number, total: number) => void): Promise<ImportResult> {
  const raw = await unzipAsync(new Uint8Array(await file.arrayBuffer()))
  // Zips made on Windows can use backslashes in paths.
  const files: Unzipped = {}
  for (const [k, v] of Object.entries(raw)) files[k.replace(/\\/g, '/').replace(/^\.\//, '')] = v
  const mf = files['manifest.json']
  if (!mf) throw new Error('Filen saknar manifest.json – är det verkligen ett Athena-paket?')
  const manifest = JSON.parse(strFromU8(mf))
  if (manifest.format === 'athena-backup') return restoreBackup(files, progress)
  if (manifest.format !== 'athena-import') throw new Error('Okänt paketformat.')
  return importPackage(manifest as ImportManifest, files, progress)
}

async function importPackage(m: ImportManifest, files: Unzipped, progress?: (d: number, t: number) => void): Promise<ImportResult> {
  const now = Date.now()
  const keyToId = new Map<string, string>()
  const fresh: { src: ImportNote; note: Note }[] = []
  let skipped = 0
  for (const src of m.notes) {
    const existing = noteByImportKey(src.key)
    if (existing) {
      keyToId.set(src.key, existing.id)
      skipped++
      continue
    }
    const id = uuid()
    keyToId.set(src.key, id)
    fresh.push({
      src,
      note: {
        id,
        vault: m.vault,
        title: src.title,
        kind: src.kind,
        format: src.format ?? (src.text ? 'text' : 'ink'),
        folder: src.folder ?? '',
        tags: src.tags ?? [],
        links: [],
        status: src.status ?? (src.kind === 'uppgift' ? 'olost' : undefined),
        text: src.text,
        pages: [],
        paper: src.paper ?? 'rutor',
        importKey: src.key,
        created: now,
        updated: now,
      },
    })
  }
  const total = fresh.reduce((s, f) => s + (f.src.pages?.length ?? 0), 0)
  let done = 0
  const pages: Page[] = []
  for (const { src, note } of fresh) {
    if (note.format === 'ink') {
      for (const path of src.pages ?? []) {
        const bytes = files[path]
        if (!bytes) continue
        const type = path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
        const asset = await putAsset(new Blob([bytes], { type }))
        const p: Page = { id: uuid(), noteId: note.id, bg: asset, paper: 'blank', strokes: [], objects: [], updated: now }
        pages.push(p)
        note.pages.push(p.id)
        progress?.(++done, total)
      }
      if (!note.pages.length) {
        const p: Page = { id: uuid(), noteId: note.id, strokes: [], objects: [], updated: now }
        pages.push(p)
        note.pages.push(p.id)
      }
    }
    // A key may also point at a note from an earlier package (e.g. maths linking to physics).
    note.links = (src.links ?? []).map((k) => keyToId.get(k) ?? noteByImportKey(k)?.id).filter((x): x is string => !!x)
  }
  await putImported(
    fresh.map((f) => f.note),
    pages,
  )
  return { added: fresh.length, skipped, pages: pages.length }
}

/* ---------- Backups ---------- */

export async function exportBackup(): Promise<Blob> {
  const notes = allNotes()
  const pageRows: any[] = []
  const assetIds = new Set<string>()
  for (const n of notes) {
    for (const pid of n.pages) {
      const p = await loadPage(pid)
      if (!p) continue
      pageRows.push(encodePage(p))
      if (p.bg) assetIds.add(p.bg)
      for (const o of p.objects) if (o.type === 'image') assetIds.add(o.asset)
    }
  }
  const out: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify({ format: 'athena-backup', version: 1, created: new Date().toISOString() })),
    'notes.json': strToU8(JSON.stringify(notes)),
    'pages.json': strToU8(JSON.stringify(pageRows)),
  }
  const metas: AssetMeta[] = []
  for (const id of assetIds) {
    const meta = await idb.get<AssetMeta>('assets', id)
    const blob = await idb.get<Blob>('blobs', id)
    if (!meta || !blob) continue
    metas.push(meta)
    out[`blobs/${id}`] = new Uint8Array(await blob.arrayBuffer())
  }
  out['assets.json'] = strToU8(JSON.stringify(metas))
  const data = await new Promise<Uint8Array>((res, rej) => zip(out, { level: 0 }, (e, d) => (e ? rej(e) : res(d))))
  return new Blob([data as BlobPart], { type: 'application/zip' })
}

async function restoreBackup(files: Unzipped, progress?: (d: number, t: number) => void): Promise<ImportResult> {
  const notes = JSON.parse(strFromU8(files['notes.json'])) as Note[]
  const pageRows = JSON.parse(strFromU8(files['pages.json'])) as any[]
  const metas = JSON.parse(strFromU8(files['assets.json'] ?? strToU8('[]'))) as AssetMeta[]
  let done = 0
  for (const a of metas) {
    const bytes = files[`blobs/${a.id}`]
    if (bytes && !(await idb.get('blobs', a.id))) await putAsset(new Blob([bytes as BlobPart], { type: a.mime }), a.id)
    progress?.(++done, metas.length)
  }
  const newNotes = notes.filter((n) => {
    const local = getNote(n.id)
    return !local || local.updated < n.updated
  })
  const pages: Page[] = pageRows.map((r) => ({ ...r, strokes: (r.strokes ?? []).map(loadStroke) }))
  await putImported(newNotes, pages.filter((p) => newNotes.some((n) => n.id === p.noteId)))
  return { added: newNotes.length, skipped: notes.length - newNotes.length, pages: pages.length }
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
