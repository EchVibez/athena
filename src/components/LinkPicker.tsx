import { useEffect, useMemo, useRef, useState } from 'react'
import { createNote, useNotes } from '../lib/store'
import { vaultName, type Note } from '../lib/types'
import { fuzzy } from '../lib/util'
import { KindGlyph } from './NoteRow'
import { Sheet } from './ui'

/** Pick a note to link to, or create it on the spot. */
export function LinkPicker({ open, from, onClose, onPick }: { open: boolean; from: Note; onClose: () => void; onPick: (id: string) => void }) {
  const notes = useNotes()
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) {
      setQ('')
      window.setTimeout(() => input.current?.focus(), 320)
    }
  }, [open])
  const list = useMemo(() => {
    const cands = notes.filter((n) => n.id !== from.id && !from.links.includes(n.id))
    if (!q.trim()) return cands.filter((n) => n.vault === from.vault).sort((a, b) => b.updated - a.updated).slice(0, 30)
    return cands
      .map((n) => ({ n, s: fuzzy(q, n.title) * 2 + fuzzy(q, n.folder) + (n.vault === from.vault ? 3 : 0) }))
      .filter((x) => x.s > 3)
      .sort((a, b) => b.s - a.s)
      .slice(0, 30)
      .map((x) => x.n)
  }, [notes, q, from])
  return (
    <Sheet open={open} onClose={onClose} title="Länka till">
      <input ref={input} className="field-big" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök anteckning…" />
      <div className="pick-list">
        {list.map((n) => (
          <button key={n.id} className="pick" onClick={() => onPick(n.id)}>
            <KindGlyph note={n} />
            <span className="pick-title">{n.title}</span>
            <small>{[n.vault !== from.vault ? vaultName(n.vault) : '', n.folder].filter(Boolean).join(' · ')}</small>
          </button>
        ))}
        {q.trim() && !notes.some((n) => n.title.toLowerCase() === q.trim().toLowerCase()) && (
          <button
            className="pick create"
            onClick={async () => {
              const n = await createNote({ vault: from.vault, title: q.trim(), folder: from.folder })
              onPick(n.id)
            }}
          >
            <span className="pick-title">Skapa ”{q.trim()}” och länka</span>
          </button>
        )}
        {!list.length && !q.trim() && <div className="muted pad">Inga fler anteckningar att länka till här.</div>}
      </div>
    </Sheet>
  )
}
